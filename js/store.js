// ── localStorage Service ──
// All persistent data access in one place.
// Every save also calls _cloudSave() in the background for Firestore sync.
// The cloud module registers its save function via setCloudSaver().

let _cloudSave = () => {};

export function setCloudSaver(fn) { _cloudSave = fn; }

// ── Exercise History (date-keyed) ──
export function getExHist(name) {
  try { return JSON.parse(localStorage.getItem('trainer_exhist_' + name)) || {}; } catch { return {}; }
}
export function saveExHist(name, data) {
  const v = JSON.stringify(data);
  localStorage.setItem('trainer_exhist_' + name, v);
  _cloudSave('exhist', encodeURIComponent(name), v);
}

/** Delete the most recent log entry for an exercise. */
export function deleteLastLog(name) {
  const hist = getExHist(name);
  const entries = Object.entries(hist).sort(([a], [b]) => b.localeCompare(a));
  if (entries.length === 0) return;
  delete hist[entries[0][0]];
  saveExHist(name, hist);
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

/** Migrate old single-entry format to date-keyed history (runs once) */
export function migrateOldExLogs() {
  if (localStorage.getItem('trainer_migrated')) return;
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
  localStorage.setItem('trainer_migrated', '1');
}

// ── Plans ──
export function getPlans() {
  try { return JSON.parse(localStorage.getItem('trainer_plans') || '[]'); } catch { return []; }
}
export function savePlans(plans) {
  const v = JSON.stringify(plans);
  localStorage.setItem('trainer_plans', v);
  _cloudSave('sections', 'plans', v);
}
export function getPlan(id) {
  return getPlans().find(p => p.id === id);
}

// ── Exercise Notes ──
export function getNotes(name) {
  try { return localStorage.getItem('trainer_notes_' + name) || ''; } catch { return ''; }
}
export function saveNotesData(name, text) {
  const t = text.slice(0, 250);
  localStorage.setItem('trainer_notes_' + name, t);
  _cloudSave('notes', encodeURIComponent(name), t);
}

// ── Body Weight ──
export function getBWData() {
  try { return JSON.parse(localStorage.getItem('trainer_bw') || '{}'); } catch { return {}; }
}
export function saveBWData(data) {
  const v = JSON.stringify(data);
  localStorage.setItem('trainer_bw', v);
  // Skip cloud if data is very large (may contain base64 progress photos)
  if (v.length < 900000) _cloudSave('sections', 'bodyweight', v);
}

export function saveBWEmpty() {
  localStorage.removeItem('trainer_bw');
  _cloudSave('sections', 'bodyweight', '{}');
}

// Backward-compat helpers (old entries are plain numbers, new are {w,p} objects)
export function bwGetWeight(val) { return typeof val === 'object' && val ? Number(val.w) : Number(val); }
export function bwGetPhoto(val) { return typeof val === 'object' && val ? (val.p || null) : null; }

// ── Nutrition Lab Meals ──
export function getNLMeals() {
  try { return JSON.parse(localStorage.getItem('trainer_meals')) || []; } catch { return []; }
}
export function saveNLMeals(m) {
  const v = JSON.stringify(m);
  localStorage.setItem('trainer_meals', v);
  _cloudSave('sections', 'meals', v);
}

// ── Personal Records ──
export function getPRs() {
  try { return JSON.parse(localStorage.getItem('trainer_prs')) || {}; } catch { return {}; }
}
export function savePRs(prs) {
  const v = JSON.stringify(prs);
  localStorage.setItem('trainer_prs', v);
  _cloudSave('sections', 'prs', v);
}

// ── Macro Goals ──
export function getMacroGoals() {
  try { return JSON.parse(localStorage.getItem('trainer_macro_goals')) || null; } catch { return null; }
}
export function saveMacroGoals(goals) {
  const v = JSON.stringify(goals);
  localStorage.setItem('trainer_macro_goals', v);
  _cloudSave('sections', 'macrogoals', v);
}

// ── Macro Goals History (date-stamped snapshots) ──
export function getMacroGoalsLog() {
  try { return JSON.parse(localStorage.getItem('trainer_macro_goals_log')) || []; } catch { return []; }
}
export function saveMacroGoalsLog(log) {
  const v = JSON.stringify(log);
  localStorage.setItem('trainer_macro_goals_log', v);
  _cloudSave('sections', 'macrogoalslog', v);
}
/** Look up the goals that were active on a given date */
export function getGoalsForDate(dateStr) {
  const log = getMacroGoalsLog();
  if (log.length === 0) return getMacroGoals(); // backward compat
  let match = null;
  for (const entry of log) {
    if (entry.date <= dateStr) match = entry;
    else break;
  }
  if (!match) match = log[0]; // date before first entry — use earliest known goals
  return { calories: match.calories, protein: match.protein, carbs: match.carbs, fat: match.fat };
}

// ── Custom Ingredients ──
export function getCustomIngs() {
  try { return JSON.parse(localStorage.getItem('trainer_custom_ings')) || []; } catch { return []; }
}
export function saveCustomIngs(c) {
  const v = JSON.stringify(c);
  localStorage.setItem('trainer_custom_ings', v);
  _cloudSave('sections', 'customings', v);
}
