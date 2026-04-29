// ── Body Weight Module ──
// Stats, chart, calendar, entry sheet, photo handling.

import { state } from './state.js';
import { getBWData, saveBWData, bwGetWeight, bwGetPhotos, bwHasPhoto, saveBWEmpty } from './store.js';
import { dateToStr, fmtDateLabel, resizeImage, MONTHS, initSheetSwipe, renderCalendarGrid, openConfirmDialog } from './utils.js';
import { savePhoto, loadPhoto, deletePhoto, isBase64 } from './storage.js';
import { getUid } from './cloud.js';

// ── Build / Refresh ──

export function buildWeightView() {
  // Sync range buttons to current state
  document.querySelectorAll('#bodyWeightView .bw-range-btn').forEach(btn => {
    const m = btn.getAttribute('onclick').match(/setBWRange\((\d+)/);
    const days = m ? parseInt(m[1]) : -1;
    btn.classList.toggle('active', days === state.bwRange);
  });
  renderBWStats();
  renderBWChart();
  renderBWCalendar();
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
     <div class="bw-stat"><div class="bw-stat-val color-accent">${f(max)}</div><div class="bw-stat-lbl">Max</div></div>
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

  const W = 340, H = 150, P = { t: 14, r: 18, b: 30, l: 42 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const vals = entries.map(([, v]) => v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const spread = maxV - minV || 1;
  const xS = i => P.l + (i / (entries.length - 1)) * cW;
  const yS = v => P.t + cH - ((v - minV) / spread) * cH;
  const pts = entries.map(([d, v], i) => ({ x: xS(i), y: yS(v), d, v }));

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cx1 = p.x + (c.x - p.x) / 3, cx2 = c.x - (c.x - p.x) / 3;
    linePath += ` C ${cx1} ${p.y}, ${cx2} ${c.y}, ${c.x} ${c.y}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H - P.b} L ${pts[0].x} ${H - P.b} Z`;

  const yLbls = [minV, (minV + maxV) / 2, maxV].map(v =>
    `<text x="${P.l - 6}" y="${yS(v)}" text-anchor="end" dominant-baseline="middle" fill="${chartLbl}" font-size="9" font-family="-apple-system,sans-serif">${v.toFixed(1)}</text>`
  ).join('');

  const xIdxs = entries.length <= 3
    ? entries.map((_, i) => i)
    : [0, Math.floor((entries.length - 1) / 2), entries.length - 1];
  const xLbls = [...new Set(xIdxs)].map(i => {
    const [ds] = entries[i]; const [y, m, d] = ds.split('-');
    const anchor = i === 0 ? 'start' : i === entries.length - 1 ? 'end' : 'middle';
    return `<text x="${xS(i)}" y="${H - P.b + 13}" text-anchor="${anchor}" fill="${chartLbl}" font-size="9" font-family="-apple-system,sans-serif">${d}/${m}/${y.slice(2)}</text>`;
  }).join('');

  const dots = pts.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`
  ).join('');

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
  svg.innerHTML = `
    <defs>
      <linearGradient id="bwG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(233,69,96,0.38)"/>
        <stop offset="100%" stop-color="rgba(233,69,96,0.0)"/>
      </linearGradient>
    </defs>
    <line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${chartGrid}" stroke-width="1"/>
    <path d="${areaPath}" fill="url(#bwG)"/>
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${yLbls}${xLbls}${dots}`;

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
  if (state.bwCalYear <= 2026 && state.bwCalMon === 0) return;
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
  document.getElementById('bwBtnDel').classList.toggle('visible', !!existing);

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
  const deleteBtn = document.getElementById('bwBtnDel');
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
        <img class="bw-thumb-img" src="${p}" onclick="bwViewPhoto(${i})" />
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
  resizeImage(file, 700, 0.72, base64 => {
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
