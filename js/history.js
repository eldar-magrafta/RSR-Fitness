// ── Exercise History Module ──
// Progression chart, calendar, entry logging with multi-set support.

import { state } from './state.js';
import { getExHist, saveExHist } from './store.js';
import { MONTHS, exHistMaxWeight, initSheetSwipe, renderCalendarGrid, openConfirmDialog } from './utils.js';
import { closeModal } from './exercises.js';
import { showView, setHeader } from './navigation.js';
import { checkForNewPR, showNewPRToast, recalcPR } from './prs.js';

function exHistToStr(d) { return d.toISOString().slice(0, 10); }

export function openExHistory() {
  const exName = state.currentExerciseName;
  closeModal(true);
  state.currentExerciseName = exName;
  showView('exHistoryView');
  setHeader(exName, true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'ex-history';
  state.exHistRange = 0;
  const now = new Date();
  state.exHistCalYear = now.getFullYear();
  state.exHistCalMon = now.getMonth();
  document.querySelectorAll('#exHistoryView .bw-range-btn').forEach((b, i) => b.classList.toggle('active', i === 2));
  renderExHistChart();
  renderExHistCal();
}

export function setExHistRange(days, btn) {
  state.exHistRange = days;
  document.querySelectorAll('#exHistoryView .bw-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderExHistChart();
}

// ── Chart ──

function renderExHistChart() {
  const svg = document.getElementById('exHistChartSvg');
  const tooltip = document.getElementById('exHistTooltip');
  const hist = getExHist(state.currentExerciseName);
  let entries = Object.entries(hist).filter(([, v]) => exHistMaxWeight(v) > 0).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => [d, exHistMaxWeight(v), v]);

  const today = exHistToStr(new Date());
  if (state.exHistRange > 0) {
    const cut = new Date(); cut.setDate(cut.getDate() - state.exHistRange);
    const cutStr = exHistToStr(cut);
    entries = entries.filter(([d]) => d >= cutStr && d <= today);
  }

  const cs = getComputedStyle(document.documentElement);
  const chartLbl = cs.getPropertyValue('--chart-label').trim() || '#8892a4';
  const chartGrid = cs.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.04)';
  const mutedCol = cs.getPropertyValue('--muted').trim() || '#8892a4';

  if (entries.length < 2) {
    svg.innerHTML = `<text x="170" y="75" text-anchor="middle" fill="${mutedCol}" font-size="12">Log on multiple days to see progression</text>`;
    return;
  }

  const W = 340, H = 140, pad = 30, pT = 15, pB = 22;
  const vals = entries.map(e => e[1]);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mn === mx) { mn -= 5; mx += 5; }
  const rng = mx - mn || 1;
  const xStep = (W - pad * 2) / (entries.length - 1);

  const pts = entries.map(([d, v], i) => {
    const x = pad + i * xStep;
    const y = pT + (1 - (v - mn) / rng) * (H - pT - pB);
    const raw = entries[i][2];
    return { x, y, d, v, raw };
  });

  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1].x.toFixed(1)},${H - pB} L${pts[0].x.toFixed(1)},${H - pB} Z`;
  const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--accent)"/>`).join('');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = mn + f * rng;
    const y = pT + (1 - f) * (H - pT - pB);
    return `<line x1="${pad}" x2="${W - pad}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${chartGrid}"/>
      <text x="${pad - 4}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${chartLbl}" font-size="8">${Math.round(v)}</text>`;
  }).join('');

  const step = Math.max(1, Math.floor(entries.length / 3));
  const xLabels = pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % step === 0).map(p => {
    const [y, m, d] = p.d.split('-');
    return `<text x="${p.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="${chartLbl}" font-size="8">${d}/${m}/${y.slice(2)}</text>`;
  }).join('');

  svg.innerHTML = `${gridLines}<path d="${area}" fill="url(#exGrad)" opacity="0.25"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round"/>${dots}${xLabels}<defs><linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>`;

  function showTip(clientX) {
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = ratio * W;
    let closest = pts[0], minD = 9999;
    pts.forEach(p => { const d = Math.abs(p.x - svgX); if (d < minD) { minD = d; closest = p; } });
    const [y, m, d] = closest.d.split('-');
    const raw = closest.raw;
    let tipText = closest.v + 'kg';
    if (raw.sets && raw.sets.length) {
      tipText += ` \u00b7 ${raw.sets.length} set${raw.sets.length > 1 ? 's' : ''}`;
    } else if (raw.r) {
      tipText += ` \u00d7 ${raw.r} reps`;
    }
    document.getElementById('exHistTooltipVal').textContent = tipText;
    document.getElementById('exHistTooltipDate').textContent = d + '/' + m + '/' + y;
    tooltip.classList.add('visible');
    const px = closest.x / W * rect.width;
    tooltip.style.left = Math.max(20, Math.min(rect.width - 80, px)) + 'px';
  }
  svg.ontouchstart = e => { e.preventDefault(); showTip(e.touches[0].clientX); };
  svg.ontouchmove = e => { e.preventDefault(); showTip(e.touches[0].clientX); };
  svg.ontouchend = () => setTimeout(() => tooltip.classList.remove('visible'), 1400);
}

// ── Calendar ──

function renderExHistCal() {
  document.getElementById('exHistCalTitle').textContent = MONTHS[state.exHistCalMon] + ' ' + state.exHistCalYear;
  const hist = getExHist(state.currentExerciseName);
  document.getElementById('exHistCalGrid').innerHTML = renderCalendarGrid(state.exHistCalYear, state.exHistCalMon, {
    hasData: ds => hist[ds],
    disableFuture: true,
    onClick: 'openExHistEntry',
  });
}

export function exHistPrevMonth() {
  if (state.exHistCalYear <= 2026 && state.exHistCalMon === 0) return;
  if (state.exHistCalMon === 0) { state.exHistCalMon = 11; state.exHistCalYear--; } else state.exHistCalMon--;
  renderExHistCal();
}
export function exHistNextMonth() {
  if (state.exHistCalYear >= 2035 && state.exHistCalMon === 11) return;
  if (state.exHistCalMon === 11) { state.exHistCalMon = 0; state.exHistCalYear++; } else state.exHistCalMon++;
  renderExHistCal();
}
export function exHistJumpToDate(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  state.exHistCalYear = y;
  state.exHistCalMon = m - 1;
  renderExHistCal();
  openExHistEntry(dateStr);
}

// ── Entry Sheet ──

export function renderExHistSets(existingSets) {
  const count = parseInt(document.getElementById('exHistSetCount').value) || 3;
  const container = document.getElementById('exHistSetsContainer');
  let html = '';
  for (let i = 0; i < count; i++) {
    const s = existingSets && existingSets[i] ? existingSets[i] : {};
    html += `<div style="margin-bottom:10px;">
      <div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px;font-weight:600;">Set ${i + 1}</div>
      <div class="log-row">
        <div class="log-field"><label>Weight</label><div class="log-input-wrap"><input type="number" id="exHistW_${i}" placeholder="0" inputmode="decimal" value="${s.w || ''}"/><span>kg</span></div></div>
        <div class="log-field"><label>Reps</label><div class="log-input-wrap"><input type="number" id="exHistR_${i}" placeholder="0" inputmode="numeric" value="${s.r || ''}"/><span>reps</span></div></div>
      </div></div>`;
  }
  container.innerHTML = html;
}

export function openExHistEntry(dateStr) {
  state.exHistSelectedDate = dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  document.getElementById('exHistEntryDate').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hist = getExHist(state.currentExerciseName);
  const entry = hist[dateStr];
  if (entry) {
    let sets = [];
    let setCount = 3;
    if (entry.sets) { sets = entry.sets; setCount = sets.length; }
    else if (entry.w) { sets = [{ w: entry.w, r: entry.r }]; setCount = 1; }
    document.getElementById('exHistSetCount').value = setCount;
    renderExHistSets(sets);
    document.getElementById('exHistNotes').value = entry.n || '';
  } else {
    document.getElementById('exHistSetCount').value = 3;
    renderExHistSets();
    document.getElementById('exHistNotes').value = '';
  }
  document.getElementById('exHistBtnDel').style.display = entry ? '' : 'none';
  document.getElementById('exHistBtnDelTop').style.display = entry ? '' : 'none';
  document.getElementById('exHistEntryOverlay').classList.add('open');
  setTimeout(() => document.getElementById('exHistEntrySheet').style.transform = 'translateY(0)', 10);
}

export function closeExHistEntry() {
  const sheet = document.getElementById('exHistEntrySheet');
  sheet.style.transform = '';
  document.getElementById('exHistEntryOverlay').classList.remove('open');
}

/** Initialize swipe-down-to-dismiss on the Log Exercise sheet */
export function initExHistSheetSwipe() {
  initSheetSwipe('exHistEntryOverlay', 'exHistEntrySheet', closeExHistEntry);
}

export function saveExHistEntry() {
  if (!state.currentExerciseName || !state.exHistSelectedDate) return;
  const count = parseInt(document.getElementById('exHistSetCount').value) || 3;
  const sets = [];
  let hasData = false;
  for (let i = 0; i < count; i++) {
    const w = document.getElementById('exHistW_' + i).value.trim();
    const r = document.getElementById('exHistR_' + i).value.trim();
    sets.push({ w: w || '0', r: r || '0' });
    if (w || r) hasData = true;
  }
  if (!hasData) return;
  const n = document.getElementById('exHistNotes').value.trim();
  const hist = getExHist(state.currentExerciseName);
  hist[state.exHistSelectedDate] = { sets };
  if (n) hist[state.exHistSelectedDate].n = n;
  saveExHist(state.currentExerciseName, hist);

  // Check for new PR
  const maxW = Math.max(...sets.map(s => parseFloat(s.w) || 0));
  if (maxW > 0) {
    const topSet = sets.reduce((a, b) => (parseFloat(b.w) || 0) > (parseFloat(a.w) || 0) ? b : a);
    const result = checkForNewPR(state.currentExerciseName, maxW, parseInt(topSet.r) || 0, sets.length, state.exHistSelectedDate);
    if (result.isNew) showNewPRToast(state.currentExerciseName, maxW);
  }

  closeExHistEntry();
  renderExHistChart();
  renderExHistCal();
}

export function openDeleteExHistConfirm() {
  openConfirmDialog({
    title: 'Delete Entry?',
    message: 'This log entry will be permanently deleted.',
    confirmLabel: 'Delete',
    onConfirm: () => {
      if (!state.currentExerciseName || !state.exHistSelectedDate) return;
      const hist = getExHist(state.currentExerciseName);
      delete hist[state.exHistSelectedDate];
      saveExHist(state.currentExerciseName, hist);
      recalcPR(state.currentExerciseName);
      closeExHistEntry();
      renderExHistChart();
      renderExHistCal();
    },
  });
}

export function openDeleteAllExHist() {
  openConfirmDialog({
    title: 'Delete All History?',
    message: 'This will permanently remove every logged entry for this exercise. This cannot be undone.',
    confirmLabel: 'Yes, Delete Everything',
    onConfirm: () => {
      if (!state.currentExerciseName) return;
      saveExHist(state.currentExerciseName, {});
      recalcPR(state.currentExerciseName);
      renderExHistChart();
      renderExHistCal();
    },
  });
}
