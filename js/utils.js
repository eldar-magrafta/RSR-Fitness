// ── Utility Functions ──

/** Escape a string for safe insertion into HTML */
export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shared swipe-down-to-dismiss for bottom sheets */
export function initSheetSwipe(overlayId, sheetId, closeFn) {
  const overlay = document.getElementById(overlayId);
  const sheet = document.getElementById(sheetId);
  let _sd = null;
  sheet.addEventListener('touchstart', e => {
    if (e.touches[0].clientY - sheet.getBoundingClientRect().top > 50) return;
    _sd = { startY: e.touches[0].clientY };
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (!_sd) return;
    const dy = Math.max(0, e.touches[0].clientY - _sd.startY);
    e.preventDefault();
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${dy}px)`;
    overlay.style.background = `rgba(0,0,0,${Math.max(0.05, 0.65 - dy / 400)})`;
  }, { passive: false });
  sheet.addEventListener('touchend', e => {
    if (!_sd) return;
    const dy = e.changedTouches[0].clientY - _sd.startY;
    sheet.style.transition = '';
    overlay.style.background = '';
    if (dy > 120) {
      sheet.style.transform = 'translateY(110%)';
      setTimeout(closeFn, 250);
    } else {
      sheet.style.transform = 'translateY(0)';
    }
    _sd = null;
  });
}

/** Format a Date to 'YYYY-MM-DD' string */
export function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format 'YYYY-MM-DD' to readable label like 'Mon, 3 Apr' */
export function fmtDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Resize an image file (File object) and return base64 JPEG via callback */
export function resizeImage(file, maxSize, quality, cb) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = maxSize;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/** Month names array */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Render a month calendar grid HTML.
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {object} opts
 * @param {function} opts.hasData - (dateStr) => truthy if day has data
 * @param {string}   [opts.selected] - selected date string
 * @param {boolean}  [opts.disableFuture] - disable clicks on future days
 * @param {string}   opts.onClick - function name for onclick (receives dateStr)
 * @param {function} [opts.badge] - (dateStr) => badge HTML string or ''
 */
export function renderCalendarGrid(year, month, opts) {
  const today = dateToStr(new Date());
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(d => `<div class="bw-cal-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDow; i++)
    html += '<div class="bw-cal-day cal-empty"></div>';

  for (let d = 1; d <= daysInMon; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFuture = ds > today;
    const hasData = opts.hasData(ds);
    const cls = ['bw-cal-day',
      isFuture && opts.markFuture !== false ? 'future' : '',
      ds === today ? 'today' : '',
      hasData ? 'has-data' : '',
      opts.selected && ds === opts.selected ? 'selected' : '',
    ].filter(Boolean).join(' ');
    const disabled = opts.disableFuture && isFuture;
    const click = disabled ? '' : ` onclick="${opts.onClick}('${ds}')"`;
    const extra = opts.badge ? opts.badge(ds) : '';
    html += `<div class="${cls}"${click}>${d}${extra}</div>`;
  }

  const remain = 42 - (firstDow + daysInMon);
  for (let i = 0; i < remain; i++)
    html += '<div class="bw-cal-day cal-empty"></div>';

  return html;
}

/** Get max weight from an exercise history entry (supports old {w,r} and new {sets:[]} formats) */
export function exHistMaxWeight(entry) {
  if (entry.sets) return Math.max(...entry.sets.map(s => parseFloat(s.w) || 0));
  return parseFloat(entry.w) || 0;
}

/** Get reps array from an exercise history entry */
export function exHistTotalReps(entry) {
  if (entry.sets) return entry.sets.map(s => parseInt(s.r) || 0);
  return [parseInt(entry.r) || 0];
}

/** Calculate macro totals for a meal */
export function calcMealTotals(meal) {
  let p = 0, c = 0, f = 0, cal = 0;
  (meal.ingredients || []).forEach(i => { const m = i.grams / 100; p += i.p * m; c += i.c * m; f += i.f * m; cal += i.cal * m; });
  return { p: Math.round(p * 10) / 10, c: Math.round(c * 10) / 10, f: Math.round(f * 10) / 10, cal: Math.round(cal) };
}
