// ── Toast Notifications ──
// Single helper for the transient `pr-toast` bubbles shown across the app.
// (The session "Workout Complete!" toast is a different animated component
// and intentionally stays in session.js.)

/**
 * Show a transient toast.
 * @param {string} message - text content of the toast
 * @param {object} [opts]
 * @param {string} [opts.background] - inline background (e.g. a gradient); omit to use the .pr-toast default
 * @param {number} [opts.duration=2600] - ms before auto-removal
 * @param {boolean} [opts.replace=false] - remove any existing .pr-toast first
 */
export function showToast(message, opts = {}) {
  const { background, duration = 2600, replace = false } = opts;
  if (replace) {
    const existing = document.querySelector('.pr-toast');
    if (existing) existing.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'pr-toast';
  if (background) toast.style.background = background;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
}
