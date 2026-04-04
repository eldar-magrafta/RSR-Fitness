// ── localStorage Service ──
// All persistent data access in one place.

// ── Exercise History (date-keyed) ──
export function getExHist(name) {
  try { return JSON.parse(localStorage.getItem('trainer_exhist_' + name)) || {}; } catch { return {}; }
}
export function saveExHist(name, data) {
  localStorage.setItem('trainer_exhist_' + name, JSON.stringify(data));
}

/** Get latest log for an exercise (newest date). Returns {setList, date} or null. */
export function getLog(name) {
  const hist = getExHist(name);
  const entries = Object.entries(hist).sort(([a], [b]) => b.localeCompare(a));
  if (entries.length === 0) return null;
  const [ds, e] = entries[0];
  const d = new Date(ds + 'T00:00:00');
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (e.sets && e.sets.length) {
    const setList = e.sets.map(s => ({ w: parseFloat(s.w) || 0, r: parseInt(s.r) || 0 }));
    return { setList, date };
  }
  return { setList: [{ w: parseFloat(e.w) || 0, r: parseInt(e.r) || 0 }], date };
}

export function saveLogData(name, weight, reps) {
  const today = new Date().toISOString().slice(0, 10);
  const hist = getExHist(name);
  hist[today] = { w: weight, r: reps };
  saveExHist(name, hist);
}

/** Migrate old single-entry format to date-keyed history */
export function migrateOldExLogs() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  keys.forEach(key => {
    if (key.startsWith('trainer_ex_') && !key.startsWith('trainer_exhist_')) {
      try {
        const name = key.replace('trainer_ex_', '');
        const old = JSON.parse(localStorage.getItem(key));
        if (old && old.weight) {
          const histKey = 'trainer_exhist_' + name;
          const existing = JSON.parse(localStorage.getItem(histKey) || '{}');
          const parsed = new Date(old.date);
          if (!isNaN(parsed)) {
            const ds = parsed.toISOString().slice(0, 10);
            if (!existing[ds]) {
              existing[ds] = { w: old.weight, r: old.reps };
              localStorage.setItem(histKey, JSON.stringify(existing));
            }
          }
        }
      } catch (e) { /* skip corrupted entries */ }
    }
  });
}

// ── Plans ──
export function getPlans() {
  try { return JSON.parse(localStorage.getItem('trainer_plans') || '[]'); } catch { return []; }
}
export function savePlans(plans) {
  localStorage.setItem('trainer_plans', JSON.stringify(plans));
}
export function getPlan(id) {
  return getPlans().find(p => p.id === id);
}

// ── Exercise Notes ──
export function getNotes(name) {
  try { return localStorage.getItem('trainer_notes_' + name) || ''; } catch { return ''; }
}
export function saveNotesData(name, text) {
  localStorage.setItem('trainer_notes_' + name, text.slice(0, 250));
}

// ── Body Weight ──
export function getBWData() {
  try { return JSON.parse(localStorage.getItem('trainer_bw') || '{}'); } catch { return {}; }
}
export function saveBWData(data) {
  localStorage.setItem('trainer_bw', JSON.stringify(data));
}

// Backward-compat helpers (old entries are plain numbers, new are {w,p} objects)
export function bwGetWeight(val) { return typeof val === 'object' && val ? Number(val.w) : Number(val); }
export function bwGetPhoto(val) { return typeof val === 'object' && val ? (val.p || null) : null; }

// ── Nutrition Lab Meals ──
export function getNLMeals() {
  try { return JSON.parse(localStorage.getItem('trainer_meals')) || []; } catch { return []; }
}
export function saveNLMeals(m) {
  localStorage.setItem('trainer_meals', JSON.stringify(m));
}

// ── Personal Records ──
export function getPRs() {
  try { return JSON.parse(localStorage.getItem('trainer_prs')) || {}; } catch { return {}; }
}
export function savePRs(prs) {
  localStorage.setItem('trainer_prs', JSON.stringify(prs));
}

// ── Macro Goals ──
export function getMacroGoals() {
  try { return JSON.parse(localStorage.getItem('trainer_macro_goals')) || null; } catch { return null; }
}
export function saveMacroGoals(goals) {
  localStorage.setItem('trainer_macro_goals', JSON.stringify(goals));
}

// ── Custom Ingredients ──
export function getCustomIngs() {
  try { return JSON.parse(localStorage.getItem('trainer_custom_ings')) || []; } catch { return []; }
}
export function saveCustomIngs(c) {
  localStorage.setItem('trainer_custom_ings', JSON.stringify(c));
}
