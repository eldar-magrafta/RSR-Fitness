// ── Workout Session Module ──
// "Start Workout" flow: walks through a plan exercise-by-exercise,
// with per-set logging, rest timer, session clock, and finish summary.

import { state } from './state.js';
import { getPlan, getExHist, saveExHist, getLog } from './store.js';
import { findExercise } from '../data/exercises.js';
import { showView, setHeader } from './navigation.js';
import { checkForNewPR, showNewPRToast } from './prs.js';
import { dateToStr } from './utils.js';

const today = () => dateToStr(new Date());

let _sessionTimer = null;
let _restTimer = null;
let _restRemaining = 0;
let _restDuration = 0;

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Start Session ──

export function startWorkout(planId) {
  const plan = getPlan(planId);
  if (!plan) return;

  const exercises = [];
  let currentSection = null;
  plan.exercises.forEach(item => {
    if (item && typeof item === 'object' && item.title !== undefined) {
      currentSection = item.title;
      return;
    }
    const found = findExercise(item);
    if (found) {
      exercises.push({ name: item, group: found.groupName, section: currentSection });
    }
  });

  if (exercises.length === 0) return;

  state.ws = {
    planId,
    planName: plan.name,
    exercises,
    currentIdx: 0,
    elapsed: 0,
    restSeconds: 90,
    logged: {},
    startedAt: Date.now(),
    finished: false,
  };

  showView('workoutSessionView');
  setHeader(plan.name, true);
  document.getElementById('fab').classList.add('hidden');
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  state.navContext = 'workout';

  _startSessionTimer();
  renderWorkout();
}

function _startSessionTimer() {
  clearInterval(_sessionTimer);
  _sessionTimer = setInterval(() => {
    if (state.ws && !state.ws.finished) {
      state.ws.elapsed++;
      const el = document.getElementById('wsTimerDisplay');
      if (el) el.textContent = fmtTime(state.ws.elapsed);
    }
  }, 1000);
}

// ── Render current exercise ──

export function renderWorkout() {
  const ws = state.ws;
  if (!ws || ws.finished) return;
  const container = document.getElementById('workoutSessionContent');
  const ex = ws.exercises[ws.currentIdx];
  const total = ws.exercises.length;
  const done = ws.currentIdx;
  const pct = Math.round((done / total) * 100);

  const log = getLog(ex.name);
  const lastText = log
    ? log.setList.map(s => `${s.w}kg × ${s.r}`).join(' / ')
    : null;

  const existingSets = ws.logged[ws.currentIdx];
  const setCount = existingSets ? existingSets.length : 3;

  let setsHtml = '';
  for (let i = 0; i < setCount; i++) {
    const s = existingSets && existingSets[i] ? existingSets[i] : {};
    setsHtml += `<div style="margin-bottom:10px;">
      <div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px;font-weight:600;">Set ${i + 1}</div>
      <div class="log-row">
        <div class="log-field"><label>Weight</label><div class="log-input-wrap"><input type="number" id="wsW_${i}" placeholder="0" inputmode="decimal" value="${s.w || ''}"/><span>kg</span></div></div>
        <div class="log-field"><label>Reps</label><div class="log-input-wrap"><input type="number" id="wsR_${i}" placeholder="0" inputmode="numeric" value="${s.r || ''}"/><span>reps</span></div></div>
      </div></div>`;
  }

  let upcomingHtml = '';
  for (let i = 0; i < total; i++) {
    const e = ws.exercises[i];
    if (e.section && (i === 0 || ws.exercises[i - 1].section !== e.section)) {
      upcomingHtml += `<div class="ws-section-divider">${_esc(e.section)}</div>`;
    }
    const isDone = i < ws.currentIdx;
    const isCurrent = i === ws.currentIdx;
    upcomingHtml += `<div class="ws-upcoming-item${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}" style="${isCurrent ? 'border-color:var(--accent);' : ''}">
      <div class="ws-upcoming-idx">${isDone ? '✓' : i + 1}</div>
      <span class="ws-upcoming-name">${_esc(e.name)}</span>
      ${isDone ? '<span class="ws-upcoming-check">✓</span>' : ''}
    </div>`;
  }

  container.innerHTML = `
    <div class="ws-timer-bar">
      <div class="ws-timer-display" id="wsTimerDisplay">${fmtTime(ws.elapsed)}</div>
      <div class="ws-timer-label">Session Time</div>
    </div>
    <div class="ws-progress-row">
      <div class="ws-progress-bar"><div class="ws-progress-fill" style="width:${pct}%"></div></div>
      <div class="ws-progress-text">${done}/${total}</div>
    </div>
    <div class="ws-current-card">
      <div class="ws-current-label">Exercise ${done + 1} of ${total}</div>
      <div class="ws-current-name">${_esc(ex.name)}</div>
      <div class="ws-current-group">${_esc(ex.group)}</div>
      ${lastText ? `<div class="ws-current-last">Last: ${lastText}</div>` : '<div class="ws-current-last none">No previous data</div>'}
      <div style="margin-bottom:14px;">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:6px;">Number of Sets</label>
        <select id="wsSetCount" onchange="wsChangeSetCount()" class="themed-select">
          ${[1,2,3,4,5].map(n => `<option value="${n}"${n === setCount ? ' selected' : ''}>${n} set${n > 1 ? 's' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="ws-sets-area" id="wsSetsArea">${setsHtml}</div>
    </div>
    <div class="ws-nav-row">
      <button class="ws-nav-btn" onclick="wsSkipExercise()"${done === 0 ? ' disabled' : ''}>← Prev</button>
      <button class="ws-nav-btn primary" onclick="wsSaveAndNext()">${done + 1 === total ? 'Finish' : 'Save & Next →'}</button>
    </div>
    <div class="ws-upcoming">
      <div class="ws-upcoming-title">Exercises</div>
      <div class="ws-upcoming-list">${upcomingHtml}</div>
    </div>`;
}

export function wsChangeSetCount() {
  const ws = state.ws;
  if (!ws) return;
  const count = parseInt(document.getElementById('wsSetCount').value) || 3;
  const current = _readCurrentSets();
  while (current.length < count) current.push({});
  while (current.length > count) current.pop();
  ws.logged[ws.currentIdx] = current;
  _renderSetsOnly(current);
}

function _renderSetsOnly(sets) {
  const area = document.getElementById('wsSetsArea');
  if (!area) return;
  let html = '';
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i] || {};
    html += `<div style="margin-bottom:10px;">
      <div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px;font-weight:600;">Set ${i + 1}</div>
      <div class="log-row">
        <div class="log-field"><label>Weight</label><div class="log-input-wrap"><input type="number" id="wsW_${i}" placeholder="0" inputmode="decimal" value="${s.w || ''}"/><span>kg</span></div></div>
        <div class="log-field"><label>Reps</label><div class="log-input-wrap"><input type="number" id="wsR_${i}" placeholder="0" inputmode="numeric" value="${s.r || ''}"/><span>reps</span></div></div>
      </div></div>`;
  }
  area.innerHTML = html;
}

function _readCurrentSets() {
  const sets = [];
  for (let i = 0; i < 5; i++) {
    const wEl = document.getElementById('wsW_' + i);
    const rEl = document.getElementById('wsR_' + i);
    if (!wEl) break;
    sets.push({ w: wEl.value.trim(), r: rEl.value.trim() });
  }
  return sets;
}

// ── Save & Navigate ──

export function wsSaveAndNext() {
  const ws = state.ws;
  if (!ws) return;

  _saveCurrentExercise();

  if (ws.currentIdx + 1 >= ws.exercises.length) {
    _finishWorkout();
    return;
  }

  ws.currentIdx++;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderWorkout();
  _showRestTimer();
}

export function wsSkipExercise() {
  const ws = state.ws;
  if (!ws || ws.currentIdx === 0) return;
  const currentSets = _readCurrentSets();
  ws.logged[ws.currentIdx] = currentSets;
  ws.currentIdx--;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderWorkout();
}

function _saveCurrentExercise() {
  const ws = state.ws;
  const sets = _readCurrentSets();
  ws.logged[ws.currentIdx] = sets;

  const ex = ws.exercises[ws.currentIdx];
  const hasData = sets.some(s => s.w || s.r);
  if (!hasData) return;

  const dateStr = today();
  const hist = getExHist(ex.name);
  const storeSets = sets.map(s => ({ w: s.w || '0', r: s.r || '0' }));
  hist[dateStr] = { sets: storeSets };
  saveExHist(ex.name, hist);

  const maxW = Math.max(...storeSets.map(s => parseFloat(s.w) || 0));
  if (maxW > 0) {
    const topSet = storeSets.reduce((a, b) => (parseFloat(b.w) || 0) > (parseFloat(a.w) || 0) ? b : a);
    const result = checkForNewPR(ex.name, maxW, parseInt(topSet.r) || 0, storeSets.length, dateStr);
    if (result.isNew) showNewPRToast(ex.name, maxW);
  }
}

// ── Rest Timer ──

function _showRestTimer() {
  _restDuration = state.ws.restSeconds;
  _restRemaining = _restDuration;
  const overlay = document.getElementById('wsRestOverlay');
  overlay.classList.add('open');
  _updateRestDisplay();
  _updateRestPresets();

  clearInterval(_restTimer);
  _restTimer = setInterval(() => {
    _restRemaining--;
    if (_restRemaining <= 0) {
      _restRemaining = 0;
      clearInterval(_restTimer);
      _tryVibrate();
    }
    _updateRestDisplay();
  }, 1000);
}

function _tryVibrate() {
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}
}

function _updateRestDisplay() {
  document.getElementById('wsRestTime').textContent = fmtTime(_restRemaining);
  const circ = document.getElementById('wsRestFill');
  if (circ) {
    const pct = _restDuration > 0 ? _restRemaining / _restDuration : 0;
    const C = 2 * Math.PI * 97;
    circ.style.strokeDasharray = C;
    circ.style.strokeDashoffset = C * (1 - pct);
  }
}

function _updateRestPresets() {
  document.querySelectorAll('.ws-rest-preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.secs) === state.ws.restSeconds);
  });
}

export function wsSetRestDuration(secs) {
  if (!state.ws) return;
  state.ws.restSeconds = secs;
  _restDuration = secs;
  _restRemaining = secs;
  clearInterval(_restTimer);
  _restTimer = setInterval(() => {
    _restRemaining--;
    if (_restRemaining <= 0) {
      _restRemaining = 0;
      clearInterval(_restTimer);
      _tryVibrate();
    }
    _updateRestDisplay();
  }, 1000);
  _updateRestDisplay();
  _updateRestPresets();
}

export function wsSkipRest() {
  clearInterval(_restTimer);
  document.getElementById('wsRestOverlay').classList.remove('open');
}

export function wsAddRestTime(secs) {
  _restRemaining = Math.max(0, _restRemaining + secs);
  _restDuration = Math.max(_restDuration, _restRemaining);
  _updateRestDisplay();
}

// ── Finish ──

function _finishWorkout() {
  const ws = state.ws;
  ws.finished = true;
  clearInterval(_sessionTimer);

  const totalExercises = ws.exercises.length;
  let totalSets = 0;
  let loggedExercises = 0;
  for (let i = 0; i < totalExercises; i++) {
    const sets = ws.logged[i] || [];
    const valid = sets.filter(s => s.w || s.r);
    if (valid.length > 0) {
      loggedExercises++;
      totalSets += valid.length;
    }
  }

  const container = document.getElementById('workoutSessionContent');
  container.innerHTML = `
    <div class="ws-finish-card">
      <div class="ws-finish-emoji">🏆</div>
      <div class="ws-finish-title">Workout Complete!</div>
      <div class="ws-finish-sub">${_esc(ws.planName)}</div>
      <div class="ws-finish-stats">
        <div class="ws-finish-stat">
          <div class="ws-finish-stat-val">${fmtTime(ws.elapsed)}</div>
          <div class="ws-finish-stat-lbl">Duration</div>
        </div>
        <div class="ws-finish-stat">
          <div class="ws-finish-stat-val">${loggedExercises}</div>
          <div class="ws-finish-stat-lbl">Exercises</div>
        </div>
        <div class="ws-finish-stat">
          <div class="ws-finish-stat-val">${totalSets}</div>
          <div class="ws-finish-stat-lbl">Total Sets</div>
        </div>
      </div>
    </div>
    <button class="ws-finish-btn" onclick="wsFinishAndReturn()">Done</button>`;

  setHeader('Workout Complete', false);
}

export function wsFinishAndReturn() {
  _cleanup();
  const planId = state.ws ? state.ws.planId : null;
  state.ws = null;
  _restoreTabBar('plans');
  if (planId) {
    const { showPlanDetail } = _getPlanModule();
    showPlanDetail(planId);
  } else {
    showView('plansView');
    setHeader('My Plans', false);
  }
}

export function wsQuitWorkout() {
  document.getElementById('wsQuitOverlay').classList.add('open');
}

export function wsConfirmQuit() {
  document.getElementById('wsQuitOverlay').classList.remove('open');
  if (state.ws && !state.ws.finished) {
    _saveCurrentExercise();
  }
  _cleanup();
  const planId = state.ws ? state.ws.planId : null;
  state.ws = null;
  _restoreTabBar('plans');
  if (planId) {
    const { showPlanDetail } = _getPlanModule();
    showPlanDetail(planId);
  } else {
    showView('plansView');
    setHeader('My Plans', false);
  }
}

export function wsCancelQuit() {
  document.getElementById('wsQuitOverlay').classList.remove('open');
}

function _cleanup() {
  clearInterval(_sessionTimer);
  clearInterval(_restTimer);
  _sessionTimer = null;
  _restTimer = null;
  document.getElementById('wsRestOverlay').classList.remove('open');
}

function _restoreTabBar(tab) {
  state.navContext = tab === 'plans' ? 'plans' : 'home';
  state.currentTab = tab;
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tabPlans').classList.add('active');
}

function _getPlanModule() {
  return { showPlanDetail: window.showPlanDetail };
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
