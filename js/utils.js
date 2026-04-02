// ── Utility Functions ──

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
