// ── Active Workout Session ──
// Walks a plan top-to-bottom. Sets are checked off, optional rest timer
// counts down between sets, and on Finish everything is committed via the
// existing exercise-history pipeline.

import { state } from './state.js';
import { getPlan, getExHist, saveExHist, getLog } from './store.js';
import { findExercise } from './exercises.js';
import { showView, setHeader } from './navigation.js';
import { escHtml, openConfirmDialog } from './utils.js';
import { checkForNewPR, showNewPRToast } from './prs.js';
import { renderPlans, showPlanDetail } from './plans.js';

const STORAGE_KEY = 'trainer_active_session';
const DEFAULT_REST_SEC = 150;

let _restInterval = null;
let _restEndAt = 0;
let _restPausedMs = 0;
let _wakeLock = null;

// ── Persistence ──

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

function saveSession(s) {
  if (!s) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function hasActiveSession() {
  return !!loadSession();
}

export function getActiveSessionPlanId() {
  return loadSession()?.planId || null;
}

// ── Session lifecycle ──

export function startSession(planId) {
  const plan = getPlan(planId);
  if (!plan) return;

  const items = plan.exercises
    .map((it, idx) => {
      if (it && typeof it === 'object' && it.title !== undefined) {
        return { kind: 'title', text: it.text || it.title, srcIdx: idx };
      }
      return { kind: 'ex', name: it, sets: [], srcIdx: idx };
    });

  const session = {
    planId,
    planName: plan.name,
    startedAt: Date.now(),
    items,
    currentIdx: items.findIndex(i => i.kind === 'ex'),
    restSec: DEFAULT_REST_SEC,
  };
  if (session.currentIdx >= 0) session.items[session.currentIdx].sets.push({ w: '', r: '' });
  saveSession(session);
  openSessionView();
}

export function resumeSession() {
  const s = loadSession();
  if (!s) return;
  openSessionView();
}

export function discardSession() {
  saveSession(null);
  stopRest();
  releaseWakeLock();
}

// ── View ──

export function openSessionView() {
  const s = loadSession();
  if (!s) return;

  showView('activeSessionView');
  setHeader('Workout', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'session';
  requestWakeLock();
  renderSession();
}

export function renderSession() {
  const s = loadSession();
  if (!s) return;

  const totalEx = s.items.filter(i => i.kind === 'ex').length;
  const doneEx = s.items.filter(i => i.kind === 'ex' && i.sets.some(isSetCommitted)).length;
  const doneSets = s.items.reduce((sum, i) => i.kind === 'ex' ? sum + i.sets.filter(isSetCommitted).length : sum, 0);
  const elapsedMin = Math.floor((Date.now() - s.startedAt) / 60000);

  let html = `
    <div class="session-progress-card">
      <div class="session-progress-row">
        <div class="session-progress-stat"><div class="session-progress-num">${doneEx}/${totalEx}</div><div class="session-progress-label">exercises</div></div>
        <div class="session-progress-stat"><div class="session-progress-num">${doneSets}</div><div class="session-progress-label">sets</div></div>
        <div class="session-progress-stat"><div class="session-progress-num">${elapsedMin}<span class="session-progress-unit">m</span></div><div class="session-progress-label">elapsed</div></div>
      </div>
    </div>
    <div class="session-list">`;

  s.items.forEach((it, idx) => {
    if (it.kind === 'title') {
      html += `<div class="session-section-title">${escHtml(it.text)}</div>`;
      return;
    }
    const isCurrent = idx === s.currentIdx;
    const hasLogged = it.sets.some(isSetCommitted);
    const stateCls = isCurrent ? 'current' : hasLogged ? 'done' : 'upcoming';
    const found = findExercise(it.name);
    const groupName = found ? found.groupName : '';
    const thumbSrc = found ? (found.ex.thumb || found.ex.gif || '') : '';
    const isCloudThumb = thumbSrc.startsWith('cloud:');
    const showThumb = thumbSrc && !isCloudThumb;
    const thumbHtml = showThumb
      ? `<img class="session-card-thumb" src="${thumbSrc}" loading="lazy" decoding="async" />`
      : (isCloudThumb ? '<div class="session-card-thumb-ph"></div>' : '');

    if (!isCurrent) {
      const filled = it.sets.filter(isSetCommitted);
      const summary = filled.length
        ? filled.map(s2 => `${s2.w}×${s2.r}`).join(' · ')
        : groupName;
      html += `
        <div class="session-card ${stateCls}" data-idx="${idx}">
          <div class="session-card-row" onclick="sessionFocus(${idx})">
            <span class="session-status-dot"></span>
            ${thumbHtml}
            <div class="session-card-info">
              <div class="session-card-name">${escHtml(it.name)}</div>
              <div class="session-card-sub">${escHtml(summary)}</div>
            </div>
            <span class="session-card-arrow">${hasLogged ? '✓' : '›'}</span>
          </div>
        </div>`;
      return;
    }

    // current — expanded
    html += `
      <div class="session-card current" data-idx="${idx}">
        <div class="session-card-head">
          <span class="session-status-dot"></span>
          ${thumbHtml}
          <div class="session-card-info">
            <div class="session-card-name">${escHtml(it.name)}</div>
            <div class="session-card-sub">${escHtml(groupName || '')}</div>
          </div>
        </div>
        <div class="session-sets" id="sessionSets_${idx}">
          ${it.sets.map((set, sIdx) => renderSetRow(idx, sIdx, set, it.name)).join('')}
        </div>
        <div class="session-set-actions">
          <button class="session-add-set-btn" onclick="sessionAddSet(${idx})"><i class="bi bi-plus-lg"></i> Add Set</button>
        </div>
      </div>`;
  });

  html += `</div>
    <div class="session-finish-wrap">
      <button class="session-finish-btn" onclick="sessionFinish()">Finish Workout</button>
    </div>`;

  document.getElementById('sessionContent').innerHTML = html;
}

function renderSetRow(exIdx, sIdx, set, exName) {
  const filled = isSetFilled(set);
  const committed = !!set.committed;
  const last = exName ? getLog(exName) : null;
  const lastSet = last && last.setList.length ? last.setList[Math.min(sIdx, last.setList.length - 1)] : null;
  const wPlaceholder = lastSet && lastSet.w > 0 ? `Last: ${lastSet.w}kg` : 'kg';
  const rPlaceholder = lastSet && lastSet.r > 0 ? `Last: ${lastSet.r} reps` : 'reps';
  const saveBtn = filled && !committed
    ? `<button class="session-set-save" onclick="sessionSaveSet(${exIdx}, ${sIdx})" title="Save set"><i class="bi bi-floppy"></i></button>`
    : '';
  return `
    <div class="session-set-row ${committed ? 'done' : ''}">
      <input class="session-set-input" type="number" inputmode="decimal" placeholder="${wPlaceholder}"
             value="${set.w || ''}" oninput="sessionUpdateSet(${exIdx}, ${sIdx}, 'w', this.value)"/>
      <span class="session-set-x">×</span>
      <input class="session-set-input" type="number" inputmode="numeric" placeholder="${rPlaceholder}"
             value="${set.r || ''}" oninput="sessionUpdateSet(${exIdx}, ${sIdx}, 'r', this.value)"/>
      ${saveBtn}
      <button class="session-set-del" onclick="sessionDeleteSet(${exIdx}, ${sIdx})" title="Remove"><i class="bi bi-x"></i></button>
    </div>`;
}

function isSetFilled(set) {
  const w = String(set.w ?? '').trim();
  const r = String(set.r ?? '').trim();
  return w !== '' && r !== '' && parseFloat(w) > 0 && parseInt(r) > 0;
}

function isSetCommitted(set) {
  return !!set.committed && isSetFilled(set);
}

// ── Set actions ──

export function sessionFocus(idx) {
  const s = loadSession();
  if (!s || s.items[idx]?.kind !== 'ex') return;
  s.currentIdx = idx;
  if (s.items[idx].sets.length === 0) s.items[idx].sets.push({ w: '', r: '' });
  saveSession(s);
  renderSession();
}

export function sessionAddSet(exIdx) {
  const s = loadSession();
  if (!s) return;
  const ex = s.items[exIdx];
  if (!ex || ex.kind !== 'ex') return;
  ex.sets.push({ w: '', r: '' });
  saveSession(s);
  renderSession();
}

export function sessionDeleteSet(exIdx, sIdx) {
  const s = loadSession();
  if (!s) return;
  const ex = s.items[exIdx];
  if (!ex || ex.kind !== 'ex') return;
  ex.sets.splice(sIdx, 1);
  saveSession(s);
  renderSession();
}

export function sessionUpdateSet(exIdx, sIdx, field, value) {
  const s = loadSession();
  if (!s) return;
  const ex = s.items[exIdx];
  if (!ex || ex.kind !== 'ex') return;
  const set = ex.sets[sIdx];
  if (!set) return;
  const wasFilled = isSetFilled(set);
  set[field] = value;
  // Editing a committed set un-commits it until the user re-saves.
  if (set.committed) set.committed = false;
  saveSession(s);
  // Toggle the save button visibility when the filled-state crosses the threshold.
  if (wasFilled !== isSetFilled(set)) renderSession();
}

export function sessionSaveSet(exIdx, sIdx) {
  const s = loadSession();
  if (!s) return;
  const ex = s.items[exIdx];
  if (!ex || ex.kind !== 'ex') return;
  const set = ex.sets[sIdx];
  if (!set || !isSetFilled(set) || set.committed) return;
  set.committed = true;
  saveSession(s);
  startRest(s.restSec);
  renderSession();
}

// ── Rest timer ──

function startRest(sec) {
  stopRest();
  _restEndAt = Date.now() + sec * 1000;
  _restPausedMs = 0;
  ensureRestChip();
  _restInterval = setInterval(updateRestChip, 250);
  updateRestChip();
}

function stopRest() {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  _restPausedMs = 0;
  const chip = document.getElementById('sessionRestChip');
  if (chip) chip.remove();
}

function ensureRestChip() {
  if (document.getElementById('sessionRestChip')) return;
  const chip = document.createElement('div');
  chip.id = 'sessionRestChip';
  chip.className = 'session-rest-chip';
  chip.innerHTML = `
    <button class="session-rest-adjust" onclick="sessionRestAdjust(-15)">−15</button>
    <div class="session-rest-center">
      <div class="session-rest-time" id="sessionRestTime">2:30</div>
      <div class="session-rest-label">until next set</div>
    </div>
    <button class="session-rest-adjust" onclick="sessionRestAdjust(15)">+15</button>
    <button class="session-rest-pause" id="sessionRestPause" onclick="sessionRestTogglePause()" title="Pause"><i class="bi bi-pause-fill"></i></button>
    <button class="session-rest-close" onclick="sessionRestSkip()" title="Skip rest"><i class="bi bi-x-lg"></i></button>`;
  document.getElementById('activeSessionView').appendChild(chip);
}

function updateRestChip() {
  const remainingMs = _restPausedMs || Math.max(0, _restEndAt - Date.now());
  const remaining = Math.ceil(remainingMs / 1000);
  const el = document.getElementById('sessionRestTime');
  if (!el) return;
  const m = Math.floor(remaining / 60);
  const sec = remaining % 60;
  el.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
  const chip = document.getElementById('sessionRestChip');
  if (chip) chip.classList.toggle('done', remaining === 0);
  if (remaining === 0) {
    if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    playRestBeep();
    setTimeout(() => { const c = document.getElementById('sessionRestChip'); if (c) c.remove(); }, 4000);
  }
}

export function sessionRestAdjust(delta) {
  if (_restPausedMs) {
    _restPausedMs = Math.max(0, _restPausedMs + delta * 1000);
  } else {
    _restEndAt += delta * 1000;
    if (_restEndAt < Date.now()) _restEndAt = Date.now();
    if (!_restInterval) _restInterval = setInterval(updateRestChip, 250);
  }
  updateRestChip();
}

export function sessionRestTogglePause() {
  const btn = document.getElementById('sessionRestPause');
  const chip = document.getElementById('sessionRestChip');
  if (_restPausedMs) {
    // Resume
    _restEndAt = Date.now() + _restPausedMs;
    _restPausedMs = 0;
    if (!_restInterval) _restInterval = setInterval(updateRestChip, 250);
    if (btn) { btn.innerHTML = '<i class="bi bi-pause-fill"></i>'; btn.title = 'Pause'; }
    if (chip) chip.classList.remove('paused');
  } else {
    // Pause
    _restPausedMs = Math.max(0, _restEndAt - Date.now());
    if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
    if (btn) { btn.innerHTML = '<i class="bi bi-play-fill"></i>'; btn.title = 'Resume'; }
    if (chip) chip.classList.add('paused');
  }
  updateRestChip();
}

export function sessionRestSkip() {
  stopRest();
}

function playRestBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}

// ── Wake lock ──

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) _wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* ignore */ }
}

function releaseWakeLock() {
  if (_wakeLock) { try { _wakeLock.release(); } catch { /* ignore */ } _wakeLock = null; }
}

// ── Finish ──

export function sessionFinish() {
  const s = loadSession();
  if (!s) return;

  // On finish, treat any filled-but-unsaved row as saved so the user
  // doesn't lose data they typed but forgot to confirm.
  s.items.forEach(it => {
    if (it.kind !== 'ex') return;
    it.sets.forEach(set => { if (isSetFilled(set)) set.committed = true; });
  });
  saveSession(s);

  const completedSets = s.items.reduce((sum, i) => i.kind === 'ex' ? sum + i.sets.filter(isSetCommitted).length : sum, 0);
  if (completedSets === 0) {
    openConfirmDialog({
      title: 'Discard Workout?',
      message: 'No sets were completed. Discard this session?',
      confirmLabel: 'Discard',
      onConfirm: () => exitSession(),
    });
    return;
  }

  openConfirmDialog({
    title: 'Finish Workout?',
    message: `Save ${completedSets} set${completedSets === 1 ? '' : 's'} to your history?`,
    confirmLabel: 'Finish',
    onConfirm: () => commitSession(s),
  });
}

function commitSession(s) {
  const dateStr = new Date(s.startedAt).toISOString().slice(0, 10);
  const newPRs = [];

  s.items.forEach(it => {
    if (it.kind !== 'ex') return;
    const doneSets = it.sets.filter(isSetCommitted);
    if (!doneSets.length) return;

    const sets = doneSets.map(x => ({ w: String(x.w), r: String(x.r) }));
    const hist = getExHist(it.name);
    hist[dateStr] = { sets };
    saveExHist(it.name, hist);

    const maxW = Math.max(...sets.map(x => parseFloat(x.w) || 0));
    if (maxW > 0) {
      const top = sets.reduce((a, b) => (parseFloat(b.w) || 0) > (parseFloat(a.w) || 0) ? b : a);
      const result = checkForNewPR(it.name, maxW, parseInt(top.r) || 0, sets.length, dateStr);
      if (result.isNew) newPRs.push({ name: it.name, weight: maxW });
    }
  });

  exitSession();
  showSessionToast(s, newPRs);
  newPRs.forEach((pr, i) => setTimeout(() => showNewPRToast(pr.name, pr.weight), 600 + i * 800));
}

function exitSession() {
  saveSession(null);
  stopRest();
  releaseWakeLock();
  showView('plansView');
  setHeader('My Plans', false);
  document.getElementById('fab').classList.remove('hidden');
  state.navContext = 'plans';
  renderPlans();
}

function showSessionToast(s, newPRs) {
  const totalSets = s.items.reduce((sum, i) => i.kind === 'ex' ? sum + i.sets.filter(isSetCommitted).length : sum, 0);
  const minutes = Math.max(1, Math.floor((Date.now() - s.startedAt) / 60000));
  const toast = document.createElement('div');
  toast.className = 'session-finish-toast';
  toast.innerHTML = `
    <div class="session-finish-icon">🎉</div>
    <div class="session-finish-title">Workout Complete!</div>
    <div class="session-finish-stats">${totalSets} set${totalSets === 1 ? '' : 's'} · ${minutes} min${newPRs.length ? ` · ${newPRs.length} PR${newPRs.length === 1 ? '' : 's'}` : ''}</div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('fade-out'), 2400);
  setTimeout(() => toast.remove(), 3000);
}

// ── Back-button hook ──

export function sessionHandleBack() {
  const s = loadSession();
  if (!s) return false;
  const anyDone = s.items.some(it => it.kind === 'ex' && it.sets.some(isSetCommitted));
  if (!anyDone) {
    exitSession();
    return true;
  }
  openConfirmDialog({
    title: 'Leave Workout?',
    message: 'Your in-progress session will be saved. You can resume from the plan.',
    confirmLabel: 'Leave',
    onConfirm: () => {
      stopRest();
      releaseWakeLock();
      showPlanDetail(s.planId);
    },
  });
  return true;
}
