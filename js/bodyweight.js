// ── Body Weight Module ──
// Stats, chart, calendar, entry sheet, photo handling.

import { state } from './state.js';
import { getBWData, saveBWData, bwGetWeight, bwGetPhoto, saveBWEmpty } from './store.js';
import { dateToStr, fmtDateLabel, resizeImage, MONTHS, initSheetSwipe } from './utils.js';
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
  const f = v => v != null ? v.toFixed(1) : '\u2014';
  document.getElementById('bwStats').innerHTML =
    `<div class="bw-stat"><div class="bw-stat-val">${f(current)}</div><div class="bw-stat-lbl">Current</div></div>
     <div class="bw-stat"><div class="bw-stat-val" style="color:var(--green)">${f(min)}</div><div class="bw-stat-lbl">Min</div></div>
     <div class="bw-stat"><div class="bw-stat-val" style="color:var(--accent)">${f(max)}</div><div class="bw-stat-lbl">Max</div></div>
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
  const today = dateToStr(new Date());
  document.getElementById('bwCalMonthLbl').textContent = `${MONTHS[state.bwCalMon]} ${state.bwCalYear}`;

  const firstDow = new Date(state.bwCalYear, state.bwCalMon, 1).getDay();
  const daysInMon = new Date(state.bwCalYear, state.bwCalMon + 1, 0).getDate();


  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="bw-cal-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDow; i++) html += `<div class="bw-cal-day cal-empty"></div>`;
  for (let d = 1; d <= daysInMon; d++) {
    const ds = `${state.bwCalYear}-${String(state.bwCalMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFuture = ds > today;
    const cls = [
      'bw-cal-day',
      isFuture ? 'future' : '',
      ds === today ? 'today' : '',
      data[ds] ? 'has-data' : '',
      ds === state.bwSelDate ? 'selected' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="openBWEntry('${ds}')">${d}</div>`;
  }
  const remain = 42 - (firstDow + daysInMon);
  for (let i = 0; i < remain; i++) html += `<div class="bw-cal-day cal-empty"></div>`;
  document.getElementById('bwCalGrid').innerHTML = html;
}

export function openBWDeleteConfirm() { document.getElementById('bwConfirmOverlay').classList.add('open'); }
export function closeBWDeleteConfirm() { document.getElementById('bwConfirmOverlay').classList.remove('open'); }
export function confirmDeleteAllBW() {
  // Delete all photo docs from Firestore in background
  const data = getBWData();
  Object.entries(data).forEach(([dateStr, val]) => {
    if (bwGetPhoto(val) === 'cloud') deletePhoto('bw-photos', dateStr);
  });
  saveBWEmpty();
  state.bwSelDate = null;
  state.bwCurrentPhoto = null;
  closeBWDeleteConfirm();
  buildWeightView();
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
  const rawPhoto = existing ? bwGetPhoto(existing) : null;

  document.getElementById('bwSheetDate').textContent = fmtDateLabel(dateStr);
  document.getElementById('bwInput').value = w || '';
  document.getElementById('bwBtnDel').classList.toggle('visible', !!existing);

  // Load photo from cache/Firestore if it's stored remotely
  if (rawPhoto === 'cloud') {
    state.bwCurrentPhoto = null; // show loading state
    bwRenderPhotoArea();
    loadPhoto('bw-photos', dateStr).then(base64 => {
      if (state.bwSelDate === dateStr) { // still on same entry
        state.bwCurrentPhoto = base64 || 'cloud';
        bwRenderPhotoArea();
      }
    });
  } else {
    state.bwCurrentPhoto = rawPhoto;
    bwRenderPhotoArea();
  }

  document.getElementById('bwOverlay').classList.add('open');
  setTimeout(() => document.getElementById('bwInput').focus(), 380);
}

export function closeBWEntry() {
  const sheet = document.getElementById('bwSheet');
  sheet.style.transform = '';
  sheet.style.transition = '';
  document.getElementById('bwOverlay').classList.remove('open');
  state.bwCurrentPhoto = null;
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

  // Prevent concurrent saves
  const saveBtn = document.getElementById('bwBtnSave');
  const deleteBtn = document.getElementById('bwBtnDel');
  const spinner = document.getElementById('bwSaveSpinner');
  const hasPhoto = state.bwCurrentPhoto && isBase64(state.bwCurrentPhoto);

  if (hasPhoto) {
    saveBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    spinner.style.display = 'flex';
  }

  const data = getBWData();
  const dateStr = state.bwSelDate;
  const weight = Math.round(val * 10) / 10;

  // Delete old photo from Firestore if being replaced or removed
  const oldPhoto = bwGetPhoto(data[dateStr]);
  if (oldPhoto && oldPhoto === 'cloud' && state.bwCurrentPhoto !== oldPhoto) {
    deletePhoto('bw-photos', dateStr);
  }

  if (hasPhoto) {
    // Save photo to its own Firestore doc + IndexedDB cache
    try {
      await savePhoto('bw-photos', dateStr, state.bwCurrentPhoto);
      data[dateStr] = { w: weight, p: 'cloud' };
    } catch {
      // Offline — keep base64 inline, will be migrated on next login
      data[dateStr] = { w: weight, p: state.bwCurrentPhoto };
    }
  } else if (state.bwCurrentPhoto) {
    // Already a cloud marker or other — preserve it
    data[dateStr] = { w: weight, p: state.bwCurrentPhoto };
  } else {
    data[dateStr] = weight;
  }

  saveBWData(data);
  closeBWEntry();
  buildWeightView();
}

export function openDeleteBWConfirm() {
  document.getElementById('deleteBWEntryOverlay').classList.add('open');
}

export function closeDeleteBWConfirm() {
  document.getElementById('deleteBWEntryOverlay').classList.remove('open');
}

export function confirmDeleteBWEntry() {
  const data = getBWData();
  const dateStr = state.bwSelDate;
  const photo = bwGetPhoto(data[dateStr]);
  if (photo === 'cloud') deletePhoto('bw-photos', dateStr);
  delete data[dateStr];
  saveBWData(data);
  state.bwSelDate = null;
  closeDeleteBWConfirm();
  closeBWEntry();
  buildWeightView();
}

// ── Photo Functions ──

function bwRenderPhotoArea() {
  const area = document.getElementById('bwPhotoArea');
  if (state.bwCurrentPhoto && state.bwCurrentPhoto !== 'cloud') {
    area.innerHTML = `
      <div class="bw-thumb-wrap">
        <img class="bw-thumb-img" src="${state.bwCurrentPhoto}" onclick="bwViewPhoto()" />
        <button class="bw-thumb-remove" onclick="bwRemovePhoto()"><i class="bi bi-trash3"></i></button>
      </div>`;
  } else if (state.bwCurrentPhoto === 'cloud') {
    // Photo exists remotely but couldn't be loaded (offline)
    area.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:0.8rem;padding:10px 0;">\ud83d\udcf7 Photo saved (offline — connect to view)</div>`;
  } else {
    area.innerHTML = `<button class="bw-add-photo-btn" onclick="document.getElementById('bwFileInput').click()">\ud83d\udcf7&nbsp; Add Progress Photo <span style="font-size:0.75rem;opacity:0.5;">(optional)</span></button>`;
  }
}

export function bwOnFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  resizeImage(file, 700, 0.72, base64 => {
    state.bwCurrentPhoto = base64;
    bwRenderPhotoArea();
  });
}

export function bwRemovePhoto() { state.bwCurrentPhoto = null; bwRenderPhotoArea(); }

export function bwViewPhoto() {
  if (!state.bwCurrentPhoto || state.bwCurrentPhoto === 'cloud') return;
  document.getElementById('bwViewerImg').src = state.bwCurrentPhoto;
  document.getElementById('bwViewer').classList.add('open');
}

export function closeBWViewer() { document.getElementById('bwViewer').classList.remove('open'); }
