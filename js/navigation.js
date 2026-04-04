// ── Navigation Utilities ──
// Basic view switching and header management.

/** Show a single view by ID, hiding all others */
export function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/** Update header title, back button visibility, and optional action button */
export function setHeader(title, showBack, actionLabel, actionFn) {
  document.getElementById('headerTitle').textContent = title;
  document.getElementById('backBtn').classList.toggle('visible', showBack);
  const btn = document.getElementById('headerAction');
  if (actionLabel) {
    btn.innerHTML = actionLabel;
    btn.onclick = actionFn;
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}
