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

// ── Macro Goals (date-keyed map) ──
// Each entry is either a goals object { calories, protein, carbs, fat } or null (explicit deletion).
// Deletion only affects that exact date; subsequent dates skip it and inherit from earlier goals.

export const DEFAULT_MACRO_GOALS = { calories: 2700, protein: 270, carbs: 203, fat: 90 };

export function getMacroGoalsMap() {
  try { return JSON.parse(localStorage.getItem('trainer_macro_goals_map')) || {}; } catch { return {}; }
}
export function saveMacroGoalsMap(map) {
  const v = JSON.stringify(map);
  localStorage.setItem('trainer_macro_goals_map', v);
  _cloudSave('sections', 'macrogoalsmap', v);
}

/** Set or delete a goal for a specific date. Pass null to delete. */
export function setGoalForDate(dateStr, goals) {
  const map = getMacroGoalsMap();
  map[dateStr] = goals;
  saveMacroGoalsMap(map);
}

/** Remove a map entry entirely (date goes back to inheriting). */
export function removeGoalEntry(dateStr) {
  const map = getMacroGoalsMap();
  delete map[dateStr];
  saveMacroGoalsMap(map);
}

/**
 * Look up the goals that apply on a given date.
 * 1. Exact match → return it (object = goal, null = deleted).
 * 2. Walk backwards, skip deletions, return first real goal.
 * 3. No entries → DEFAULT_MACRO_GOALS.
 */
export function getGoalsForDate(dateStr) {
  const map = getMacroGoalsMap();
  // Exact-date check
  if (dateStr in map) return map[dateStr];
  // Walk backwards for inheritance (skip deletions)
  const dates = Object.keys(map).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] < dateStr && map[dates[i]] !== null) return map[dates[i]];
  }
  return DEFAULT_MACRO_GOALS;
}

/** One-time migration from old format (goals + log + skip) → date-keyed map */
export function migrateMacroGoalsToMap() {
  if (localStorage.getItem('trainer_macro_goals_map')) return; // already migrated
  const map = {};
  // Old goals log
  try {
    const log = JSON.parse(localStorage.getItem('trainer_macro_goals_log')) || [];
    log.forEach(e => { if (e.date) map[e.date] = { calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat }; });
  } catch { /* ignore */ }
  // If no log, seed from single-object goals
  if (Object.keys(map).length === 0) {
    try {
      const g = JSON.parse(localStorage.getItem('trainer_macro_goals'));
      if (g && (g.calories || g.protein)) map['2020-01-01'] = g;
    } catch { /* ignore */ }
  }
  // Old skipped dates → null entries
  try {
    const skip = JSON.parse(localStorage.getItem('trainer_macro_skip')) || [];
    skip.forEach(d => { map[d] = null; });
  } catch { /* ignore */ }
  if (Object.keys(map).length > 0) saveMacroGoalsMap(map);
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
