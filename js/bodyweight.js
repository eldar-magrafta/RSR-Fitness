// ── Body Weight Module ──
// Stats, chart, calendar, entry sheet, photo handling.

import { state } from './state.js';
import { getBWData, saveBWData, bwGetWeight, bwGetPhotos, bwHasPhoto, saveBWEmpty, getWeightGoal, saveWeightGoal, getUserHeight, saveUserHeight, clearUserHeight } from './store.js';
import { dateToStr, fmtDateLabel, resizeImage, MONTHS, initSheetSwipe, renderCalendarGrid, openConfirmDialog, MIN_CAL_YEAR } from './utils.js';
import { savePhoto, loadPhoto, deletePhoto, isBase64 } from './storage.js';
import { getUid } from './cloud.js';

// ── Weight Goal ──

function renderBWGoalRow() {
  const row = document.getElementById('bwGoalRow');
  const goal = getWeightGoal();
  if (goal) {
    row.innerHTML = `<span class="bw-goal-label"><i class="bi bi-bullseye"></i> Goal: <b>${goal.toFixed(1)} kg</b></span>
      <button class="bw-goal-edit-btn" onclick="bwEditGoal()"><i class="bi bi-pencil"></i></button>
      <button class="bw-goal-edit-btn" onclick="bwClearGoal()"><i class="bi bi-x-lg"></i></button>`;
  } else {
    row.innerHTML = `<button class="bw-goal-set-btn" onclick="bwEditGoal()"><i class="bi bi-bullseye"></i> Set Weight Goal</button>`;
  }
}

export function bwEditGoal() {
  const current = getWeightGoal();
  const inp = document.getElementById('goalInput');
  inp.value = current ? current.toString() : '';
  document.getElementById('goalBtnClear').classList.toggle('visible', !!current);
  document.getElementById('goalOverlay').classList.add('open');
  setTimeout(() => inp.focus(), 250);
}

export function closeGoalSheet() {
  document.getElementById('goalOverlay').classList.remove('open');
}

export function saveGoalFromSheet() {
  const val = parseFloat(document.getElementById('goalInput').value);
  if (!val || val <= 0 || val > 500) return;
  saveWeightGoal(val);
  closeGoalSheet();
  buildWeightView();
}

export function clearGoalFromSheet() {
  saveWeightGoal(null);
  closeGoalSheet();
  buildWeightView();
}

export function bwClearGoal() {
  saveWeightGoal(null);
  buildWeightView();
}

// ── Build / Refresh ──

export function buildWeightView() {
  document.querySelectorAll('#bodyWeightView .bw-range-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.days) === state.bwRange);
  });
  renderBWStats();
  renderBWChart();
  renderBWGoalRow();
  renderBWCalendar();
  renderBMICard();
}

// ── Stats Strip ──

function renderBWStats() {
  const data = getBWData();
  const vals = Object.values(data).map(bwGetWeight).filter(v => v > 0);
  const today = dateToStr(new Date());
  const sorted = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const lastEntry = sorted.length ? bwGetWeight(sorted[sorted.length - 1][1]) : null;
  const current = data[today] ? bwGetWeight(data[today]) : lastEntry;
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const f = v => v != null ? v.toFixed(1) : '—';
  document.getElementById('bwStats').innerHTML =
    `<div class="bw-stat"><div class="bw-stat-val">${f(current)}</div><div class="bw-stat-lbl">Current</div></div>
     <div class="bw-stat"><div class="bw-stat-val color-green">${f(min)}</div><div class="bw-stat-lbl">Min</div></div>
     <div class="bw-stat"><div class="bw-stat-val color-red">${f(max)}</div><div class="bw-stat-lbl">Max</div></div>
     <div class="bw-stat"><div class="bw-stat-val">${f(avg)}</div><div class="bw-stat-lbl">Avg</div></div>`;
}

export function setBWRange(days, btn) {
  state.bwRange = days;
  document.querySelectorAll('#bodyWeightView .bw-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBWChart();
}

// ── Chart ──

function renderBWChart() {
  const svg = document.getElementById('bwChartSvg');
  if (!svg) return;
  const data = getBWData();

  let entries = Object.entries(data)
    .filter(([, v]) => bwGetWeight(v) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => [d, bwGetWeight(v)]);

  if (state.bwRange > 0) {
    const cut = new Date(); cut.setDate(cut.getDate() - state.bwRange);
    entries = entries.filter(([d]) => d >= dateToStr(cut));
  }

  const cs = getComputedStyle(document.documentElement);
  const chartLbl = cs.getPropertyValue('--chart-label').trim() || 'rgba(255,255,255,0.3)';
  const chartGrid = cs.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.07)';
  const textFaint = cs.getPropertyValue('--text-faint').trim() || 'rgba(255,255,255,0.2)';

  if (entries.length < 2) {
    svg.setAttribute('viewBox', '0 0 300 120'); svg.setAttribute('height', '120');
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="${textFaint}" font-size="13" dominant-baseline="middle" font-family="-apple-system,sans-serif">Log weight on multiple days to see your trend</text>`;
    const clean = svg.cloneNode(true);
    svg.parentNode.replaceChild(clean, svg);
    return;
  }

  // Sparkline rendering — no axes, no grid, no labels. Just a smooth line
  // with a faint area fill, an end-point dot, and the optional goal line.
  // Min/max labels float at top-right and bottom-right so users still have
  // some scale reference without the full grid.
  const W = 340, H = 90, P = { t: 6, r: 30, b: 6, l: 6 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const vals = entries.map(([, v]) => v);
  const goal = getWeightGoal();
  const allVals = goal ? [...vals, goal] : vals;
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const spread = maxV - minV || 1;
  const xS = i => P.l + (i / (entries.length - 1)) * cW;
  const yS = v => P.t + cH - ((v - minV) / spread) * cH;
  const pts = entries.map(([d, v], i) => ({ x: xS(i), y: yS(v), d, v }));

  // Smoothed cubic-Bezier path through the points.
  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const cx1 = a.x + (b.x - a.x) / 3, cx2 = b.x - (b.x - a.x) / 3;
    linePath += ` C ${cx1.toFixed(1)} ${a.y.toFixed(1)}, ${cx2.toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(H - P.b).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(H - P.b).toFixed(1)} Z`;

  // Trend color: green if last >= first, otherwise carbs/red.
  const trendingUp = vals[vals.length - 1] >= vals[0];
  const stroke = trendingUp ? 'var(--green)' : 'var(--carbs)';
  const fill = trendingUp ? 'rgba(0,232,123,0.14)' : 'rgba(255,61,113,0.14)';

  const last = pts[pts.length - 1];
  const endDot = `<circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3" fill="${stroke}"/>`;

  // Compact min/max scale on the right edge so the sparkline still has context.
  const scaleLbls = `
    <text x="${W - 4}" y="${(yS(maxV) + 3).toFixed(1)}" text-anchor="end" fill="${chartLbl}" font-size="9" font-family="-apple-system,sans-serif">${maxV.toFixed(1)}</text>
    <text x="${W - 4}" y="${(yS(minV) + 3).toFixed(1)}" text-anchor="end" fill="${chartLbl}" font-size="9" font-family="-apple-system,sans-serif">${minV.toFixed(1)}</text>`;

  const goalLine = goal ? `<line x1="${P.l}" y1="${yS(goal).toFixed(1)}" x2="${(W - P.r).toFixed(1)}" y2="${yS(goal).toFixed(1)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>` : '';

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
  svg.innerHTML = `
    ${goalLine}
    <path d="${areaPath}" fill="${fill}"/>
    <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${endDot}
    ${scaleLbls}`;

  const clean = svg.cloneNode(true);
  svg.parentNode.replaceChild(clean, svg);

  const tooltip = document.getElementById('bwTooltip');
  function showTip(clientX) {
    const rect = clean.getBoundingClientRect();
    const relX = (clientX - rect.left) * (W / rect.width);
    let best = pts[0];
    pts.forEach(p => { if (Math.abs(p.x - relX) < Math.abs(best.x - relX)) best = p; });
    document.getElementById('bwTooltipVal').textContent = `${best.v.toFixed(1)} kg`;
    document.getElementById('bwTooltipDate').textContent = fmtDateLabel(best.d);
    const pct = ((best.x - P.l) / cW) * 100;
    tooltip.style.left = `${Math.min(Math.max(pct, 5), 65)}%`;
    tooltip.classList.add('visible');
  }
  clean.addEventListener('touchstart', e => { e.preventDefault(); showTip(e.touches[0].clientX); }, { passive: false });
  clean.addEventListener('touchmove', e => { e.preventDefault(); showTip(e.touches[0].clientX); }, { passive: false });
  clean.addEventListener('touchend', () => setTimeout(() => tooltip.classList.remove('visible'), 1400));
}

// ── Calendar ──

export function renderBWCalendar() {
  const data = getBWData();
  document.getElementById('bwCalMonthLbl').textContent = `${MONTHS[state.bwCalMon]} ${state.bwCalYear}`;
  document.getElementById('bwCalGrid').innerHTML = renderCalendarGrid(state.bwCalYear, state.bwCalMon, {
    hasData: ds => data[ds],
    selected: state.bwSelDate,
    onClick: 'openBWEntry',
    badge: ds => data[ds] && bwHasPhoto(data[ds]) ? '<span class="bw-cal-photo">📷</span>' : '',
  });
}

export function openBWDeleteConfirm() {
  openConfirmDialog({
    title: 'Delete All Weight Data?',
    message: 'This will permanently remove every weight entry and progress photo you\'ve logged. This cannot be undone.',
    confirmLabel: 'Yes, Delete Everything',
    onConfirm: () => {
      const data = getBWData();
      Object.entries(data).forEach(([dateStr, val]) => {
        const photos = bwGetPhotos(val);
        photos.forEach((p, i) => { if (p === 'cloud') deletePhoto('bw-photos', dateStr + '_' + i); });
      });
      saveBWEmpty();
      state.bwSelDate = null;
      state.bwCurrentPhotos = [];
      buildWeightView();
    },
  });
}

export function bwPrevMonth() {
  if (state.bwCalYear <= MIN_CAL_YEAR && state.bwCalMon === 0) return;
  if (state.bwCalMon === 0) { state.bwCalMon = 11; state.bwCalYear--; } else state.bwCalMon--;
  renderBWCalendar();
}
export function bwNextMonth() {
  if (state.bwCalYear >= 2035 && state.bwCalMon === 11) return;
  if (state.bwCalMon === 11) { state.bwCalMon = 0; state.bwCalYear++; } else state.bwCalMon++;
  renderBWCalendar();
}

// ── Entry Sheet ──

export function openBWEntry(dateStr) {
  if (dateStr > dateToStr(new Date())) return;
  state.bwSelDate = dateStr;
  const [y, m] = dateStr.split('-').map(Number);
  state.bwCalYear = y;
  state.bwCalMon = m - 1;
  renderBWCalendar();
  const existing = getBWData()[dateStr];
  const w = existing ? bwGetWeight(existing) : null;
  const photos = existing ? bwGetPhotos(existing) : [];

  document.getElementById('bwSheetDate').textContent = fmtDateLabel(dateStr);
  document.getElementById('bwInput').value = w || '';
  document.getElementById('bwBtnDelTop').style.display = existing ? '' : 'none';

  // Load photos — resolve cloud markers to base64
  state.bwCurrentPhotos = photos.map(() => null);
  bwRenderPhotoArea();

  photos.forEach((p, i) => {
    if (p === 'cloud') {
      // Try indexed key first, fall back to legacy non-indexed key
      loadPhoto('bw-photos', dateStr + '_' + i).then(base64 => {
        if (base64) {
          if (state.bwSelDate !== dateStr) return;
          state.bwCurrentPhotos[i] = base64;
          bwRenderPhotoArea();
        } else if (i === 0) {
          return loadPhoto('bw-photos', dateStr).then(legacy => {
            if (state.bwSelDate !== dateStr) return;
            state.bwCurrentPhotos[i] = legacy || 'cloud';
            bwRenderPhotoArea();
          });
        } else {
          if (state.bwSelDate !== dateStr) return;
          state.bwCurrentPhotos[i] = 'cloud';
          bwRenderPhotoArea();
        }
      });
    } else {
      state.bwCurrentPhotos[i] = p;
      bwRenderPhotoArea();
    }
  });
  if (photos.length === 0) bwRenderPhotoArea();

  document.getElementById('bwOverlay').classList.add('open');
  setTimeout(() => document.getElementById('bwInput').focus(), 380);
}

export function closeBWEntry() {
  const sheet = document.getElementById('bwSheet');
  sheet.style.transform = '';
  sheet.style.transition = '';
  document.getElementById('bwOverlay').classList.remove('open');
  state.bwCurrentPhotos = [];
  // Reset spinner state
  document.getElementById('bwSaveSpinner').style.display = 'none';
  document.getElementById('bwBtnSave').style.display = '';
}

export function initBWSheetSwipe() {
  initSheetSwipe('bwOverlay', 'bwSheet', closeBWEntry);
}

export function handleBWOverlay(e) {
  if (e.target === document.getElementById('bwOverlay')) closeBWEntry();
}

export async function saveBWEntry() {
  const val = parseFloat(document.getElementById('bwInput').value);
  const inp = document.getElementById('bwInput');
  if (!val || val <= 0 || val > 500) {
    const inputRow = inp.closest('.bw-input-row');
    inputRow.style.outline = '2px solid var(--accent)';
    inputRow.style.outlineOffset = '2px';
    inp.style.color = 'var(--accent)';
    setTimeout(() => {
      inputRow.style.outline = '';
      inputRow.style.outlineOffset = '';
      inp.style.color = '';
    }, 600);
    return;
  }

  const saveBtn = document.getElementById('bwBtnSave');
  const deleteBtn = document.getElementById('bwBtnDelTop');
  const spinner = document.getElementById('bwSaveSpinner');
  const photos = state.bwCurrentPhotos.filter(Boolean);
  const hasNewPhotos = photos.some(p => isBase64(p));

  if (hasNewPhotos) {
    saveBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    spinner.style.display = 'flex';
  }

  const data = getBWData();
  const dateStr = state.bwSelDate;
  const weight = Math.round(val * 10) / 10;

  // Delete old photos from Firestore that are no longer present
  const oldPhotos = bwGetPhotos(data[dateStr]);
  for (let i = 0; i < oldPhotos.length; i++) {
    if (oldPhotos[i] === 'cloud') {
      deletePhoto('bw-photos', dateStr + '_' + i);
    }
  }

  // Save new photos
  if (photos.length > 0) {
    const markers = [];
    for (let i = 0; i < photos.length; i++) {
      if (isBase64(photos[i])) {
        try {
          await savePhoto('bw-photos', dateStr + '_' + i, photos[i]);
          markers.push('cloud');
        } catch {
          markers.push(photos[i]);
        }
      } else if (photos[i] === 'cloud') {
        markers.push('cloud');
      } else {
        markers.push(photos[i]);
      }
    }
    data[dateStr] = { w: weight, p: markers };
  } else {
    data[dateStr] = weight;
  }

  saveBWData(data);
  closeBWEntry();
  buildWeightView();
}

export function openDeleteBWConfirm() {
  openConfirmDialog({
    title: 'Delete Entry?',
    message: 'This weight entry will be permanently deleted.',
    confirmLabel: 'Delete',
    onConfirm: () => {
      const data = getBWData();
      const dateStr = state.bwSelDate;
      const photos = bwGetPhotos(data[dateStr]);
      photos.forEach((p, i) => { if (p === 'cloud') deletePhoto('bw-photos', dateStr + '_' + i); });
      delete data[dateStr];
      saveBWData(data);
      state.bwSelDate = null;
      closeBWEntry();
      buildWeightView();
    },
  });
}

// ── Photo Functions ──

function bwRenderPhotoArea() {
  const area = document.getElementById('bwPhotoArea');
  const photos = state.bwCurrentPhotos;
  let html = '<div class="bw-photos-row">';

  photos.forEach((p, i) => {
    if (p && p !== 'cloud') {
      html += `<div class="bw-thumb-wrap">
        <img class="bw-thumb-img" src="${p}" onclick="bwViewPhoto(${i})" loading="lazy" decoding="async" />
        <button class="bw-thumb-remove" onclick="bwRemovePhoto(${i})"><i class="bi bi-trash3"></i></button>
      </div>`;
    } else if (p === 'cloud') {
      html += `<div class="bw-thumb-wrap"><div class="bw-thumb-placeholder">📷</div></div>`;
    } else if (p === null) {
      html += `<div class="bw-thumb-wrap"><div class="bw-thumb-loading"></div></div>`;
    }
  });

  if (photos.length < 3) {
    html += `<button class="bw-add-photo-btn-small" onclick="document.getElementById('bwFileInput').click()">📷<span>+</span></button>`;
  }

  html += '</div>';
  area.innerHTML = html;
}

export function bwOnFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  if (state.bwCurrentPhotos.length >= 3) return;
  resizeImage(file, 1200, 0.92, base64 => {
    state.bwCurrentPhotos.push(base64);
    bwRenderPhotoArea();
  });
}

export function bwRemovePhoto(idx) {
  state.bwCurrentPhotos.splice(idx, 1);
  bwRenderPhotoArea();
}

export function bwViewPhoto(idx) {
  const p = state.bwCurrentPhotos[idx];
  if (!p || p === 'cloud') return;
  document.getElementById('bwViewerImg').src = p;
  document.getElementById('bwViewer').classList.add('open');
}

export function closeBWViewer() { document.getElementById('bwViewer').classList.remove('open'); }

// ── BMI Card ──


function calcBMI(weightKg, heightCm) {
  const hm = heightCm / 100;
  return weightKg / (hm * hm);
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'var(--accent)' };
  if (bmi < 25) return { label: 'Normal', color: 'var(--green)' };
  if (bmi < 30) return { label: 'Overweight', color: '#ffb347' };
  return { label: 'Obese', color: 'var(--carbs, #ff3d71)' };
}

function getLatestWeight() {
  const data = getBWData();
  const sorted = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (!sorted.length) return null;
  return bwGetWeight(sorted[sorted.length - 1][1]);
}

function renderBMICard() {
  const container = document.getElementById('bmiCard');
  if (!container) return;

  const height = getUserHeight();
  const weight = getLatestWeight();

  if (!height) {
    container.innerHTML = `
      <div class="bmi-card bmi-card-prompt" onclick="bmiPromptHeight()">
        <i class="bi bi-rulers"></i>
        <div class="bmi-prompt-text">
          <div class="bmi-prompt-title">Set your height</div>
          <div class="bmi-prompt-sub">Tap to enter height and see your BMI</div>
        </div>
        <i class="bi bi-chevron-right"></i>
      </div>`;
    return;
  }

  if (!weight || weight <= 0) {
    container.innerHTML = `
      <div class="bmi-card">
        <div class="bmi-header">
          <span class="bmi-title">BMI</span>
          <button class="bmi-height-btn" onclick="bmiPromptHeight()"><i class="bi bi-rulers"></i> ${height} cm</button>
        </div>
        <div class="bmi-no-data">Log a weight entry to calculate BMI</div>
      </div>`;
    return;
  }

  const bmi = calcBMI(weight, height);
  const cat = getBMICategory(bmi);
  // Position on bar: BMI range 15 to 40
  const pct = Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));

  container.innerHTML = `
    <div class="bmi-card">
      <div class="bmi-header">
        <span class="bmi-title">BMI</span>
        <button class="bmi-height-btn" onclick="bmiPromptHeight()"><i class="bi bi-rulers"></i> ${height} cm</button>
      </div>
      <div class="bmi-value-row">
        <span class="bmi-value" style="color:${cat.color}">${bmi.toFixed(1)}</span>
        <span class="bmi-category" style="color:${cat.color}">${cat.label}</span>
      </div>
      <div class="bmi-bar-wrap">
        <div class="bmi-bar">
          <div class="bmi-bar-seg bmi-seg-under"></div>
          <div class="bmi-bar-seg bmi-seg-normal"></div>
          <div class="bmi-bar-seg bmi-seg-over"></div>
          <div class="bmi-bar-seg bmi-seg-obese"></div>
          <div class="bmi-bar-indicator" style="left:${pct}%"></div>
        </div>
        <div class="bmi-bar-labels">
          <span>18.5</span>
          <span>25</span>
          <span>30</span>
        </div>
      </div>
    </div>`;
}

export function bmiPromptHeight() {
  const current = getUserHeight();
  const inp = document.getElementById('heightInput');
  inp.value = current ? current.toString() : '';
  document.getElementById('heightBtnClear').classList.toggle('visible', !!current);
  document.getElementById('heightOverlay').classList.add('open');
  setTimeout(() => inp.focus(), 250);
}

export function closeHeightSheet() {
  document.getElementById('heightOverlay').classList.remove('open');
}

export function saveHeightFromSheet() {
  const val = parseFloat(document.getElementById('heightInput').value);
  if (!val || val < 50 || val > 300) return;
  saveUserHeight(Math.round(val));
  closeHeightSheet();
  renderBMICard();
}

export function clearHeightFromSheet() {
  clearUserHeight();
  closeHeightSheet();
  renderBMICard();
}
