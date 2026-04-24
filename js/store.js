// ── localStorage Service ──
// All persistent data access in one place.
// Every save also calls _cloudSave() in the background for Firestore sync.
// The cloud module registers its save function via setCloudSaver().

let _cloudSave = () => {};

export function setCloudSaver(fn) { _cloudSave = fn; }

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('localStorage quota exceeded for key:', key);
    } else {
      throw e;
    }
  }
}

// Debounce rapid writes to the same Firestore document (e.g. ingredient adjustments, notes)
const _debounceMap = {};
function _debouncedCloudSave(section, docId, value, delay = 900) {
  const key = `${section}/${docId}`;
  clearTimeout(_debounceMap[key]);
  _debounceMap[key] = setTimeout(() => { delete _debounceMap[key]; _cloudSave(section, docId, value); }, delay);
}

// ── Exercise History (date-keyed) ──
export function getExHist(name) {
  try { return JSON.parse(localStorage.getItem('trainer_exhist_' + name)) || {}; } catch { return {}; }
}
export function saveExHist(name, data) {
  const v = JSON.stringify(data);
  safeSetItem('trainer_exhist_' + name, v);
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
              safeSetItem(histKey, JSON.stringify(existing));
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
  safeSetItem('trainer_plans', v);
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
  safeSetItem('trainer_notes_' + name, t);
  _debouncedCloudSave('notes', encodeURIComponent(name), t);
}

// ── Body Weight ──
export function getBWData() {
  try { return JSON.parse(localStorage.getItem('trainer_bw') || '{}'); } catch { return {}; }
}
export function saveBWData(data) {
  const v = JSON.stringify(data);
  safeSetItem('trainer_bw', v);
  _cloudSave('sections', 'bodyweight', v);
}

export function saveBWEmpty() {
  localStorage.removeItem('trainer_bw');
  _cloudSave('sections', 'bodyweight', '{}');
}

// Backward-compat helpers (old entries are plain numbers, new are {w,p} objects)
export function bwGetWeight(val) { return typeof val === 'object' && val ? Number(val.w) : Number(val); }
export function bwGetPhoto(val) { return typeof val === 'object' && val ? (val.p || null) : null; }

// ── Nutrition Lab Meals ──
const DEFAULT_MEALS = [
  {
    id: 'default_meal_1',
    name: 'High-Protein Breakfast',
    type: 'saved',
    image: 'assets/foods/saved-meals/Egg-Savory-Oats.webp',
    ingredients: [
      {name:'Eggs (whole, cooked)',  grams:150, p:13,   c:1.1,  f:11,  cal:155, img:'assets/foods/dairy/eggs.jpg'},
      {name:'Oats',                  grams:80,  p:13.2, c:67.7, f:6.5, cal:382, img:'assets/foods/grains/oats.jpg'},
      {name:'Greek Yogurt',          grams:150, p:10,   c:3.6,  f:0.7, cal:61,  img:'assets/foods/dairy/greek-yogurt.jpg'},
    ],
    notes: '',
    favorite: false,
    createdAt: '2025-01-01',
  },
  {
    id: 'default_meal_2',
    name: 'Chicken & Rice',
    type: 'saved',
    image: 'assets/foods/saved-meals/teriyaki-chicken-rice-bowl.jpg',
    ingredients: [
      {name:'Chicken Breast (cooked)', grams:200, p:31,  c:0,  f:3.6, cal:156, img:'assets/foods/meat/chicken-breast.jpg'},
      {name:'White Rice (cooked)',     grams:200, p:2.7, c:28, f:0.3, cal:126, img:'assets/foods/grains/white-rice.jpg'},
      {name:'Broccoli',               grams:150, p:2.8, c:7,  f:0.4, cal:43,  img:'assets/foods/vegetables/broccoli.jpg'},
    ],
    notes: '',
    favorite: false,
    createdAt: '2025-01-01',
  },
  {
    id: 'default_meal_3',
    name: 'Salmon & Sweet Potato',
    type: 'saved',
    image: 'assets/foods/saved-meals/Spicy-Salmon-Sweet-Potato.jpg',
    ingredients: [
      {name:'Salmon (cooked)',  grams:180, p:20,  c:0,  f:13,  cal:197, img:'assets/foods/seafood/salmon.jpg'},
      {name:'Sweet Potato',    grams:200, p:1.6, c:20, f:0.1, cal:87,  img:'assets/foods/vegetables/sweet-potato.jpg'},
      {name:'Spinach',         grams:100, p:2.9, c:3.6,f:0.4, cal:30,  img:'assets/foods/vegetables/spinach.jpg'},
    ],
    notes: '',
    favorite: false,
    createdAt: '2025-01-01',
  },
];

export function getNLMeals() {
  try {
    const raw = localStorage.getItem('trainer_meals');
    if (raw === null) { saveNLMeals(DEFAULT_MEALS); return DEFAULT_MEALS; }
    const meals = JSON.parse(raw) || [];
    // Migrate: patch default meal images if missing
    let changed = false;
    meals.forEach(m => {
      const def = DEFAULT_MEALS.find(d => d.id === m.id);
      if (def?.image && !m.image) { m.image = def.image; changed = true; }
    });
    if (changed) saveNLMeals(meals);
    return meals;
  } catch { return []; }
}
export function saveNLMeals(m) {
  const v = JSON.stringify(m);
  safeSetItem('trainer_meals', v);
  _debouncedCloudSave('sections', 'meals', v);
}

// ── Personal Records ──
export function getPRs() {
  try { return JSON.parse(localStorage.getItem('trainer_prs')) || {}; } catch { return {}; }
}
export function savePRs(prs) {
  const v = JSON.stringify(prs);
  safeSetItem('trainer_prs', v);
  _cloudSave('sections', 'prs', v);
}

// ── Macro Goals (date-keyed map) ──
// Each entry is either a goals object { calories, protein, carbs, fat } or null (explicit deletion).
// Deletion only affects that exact date; subsequent dates skip it and inherit from earlier goals.

export const DEFAULT_MACRO_GOALS = { calories: 2700, protein: 270, carbs: 203, fat: 90 };

// Cache sorted dates to avoid re-sorting on every getGoalsForDate() call
let _cachedGoalDates = null;

export function invalidateGoalDatesCache() { _cachedGoalDates = null; }

export function getMacroGoalsMap() {
  try { return JSON.parse(localStorage.getItem('trainer_macro_goals_map')) || {}; } catch { return {}; }
}
export function saveMacroGoalsMap(map) {
  const v = JSON.stringify(map);
  safeSetItem('trainer_macro_goals_map', v);
  _cloudSave('sections', 'macrogoalsmap', v);
  // Invalidate cache when map changes
  _cachedGoalDates = null;
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
  // Cache sorted dates to avoid re-sorting on every call
  if (!_cachedGoalDates) {
    _cachedGoalDates = Object.keys(map).sort();
  }
  for (let i = _cachedGoalDates.length - 1; i >= 0; i--) {
    if (_cachedGoalDates[i] < dateStr && map[_cachedGoalDates[i]] !== null) return map[_cachedGoalDates[i]];
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

// ── All Exercise History (aggregated by date) ──
export function getAllExHistByDate() {
  const result = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('trainer_exhist_')) continue;
    const exName = key.slice('trainer_exhist_'.length);
    try {
      const hist = JSON.parse(localStorage.getItem(key)) || {};
      for (const [dateStr, entry] of Object.entries(hist)) {
        if (!result[dateStr]) result[dateStr] = [];
        result[dateStr].push({ name: exName, entry });
      }
    } catch { /* skip corrupted */ }
  }
  return result;
}

// ── Custom Ingredients ──
export function getCustomIngs() {
  try { return JSON.parse(localStorage.getItem('trainer_custom_ings')) || []; } catch { return []; }
}
export function saveCustomIngs(c) {
  const v = JSON.stringify(c);
  safeSetItem('trainer_custom_ings', v);
  _cloudSave('sections', 'customings', v);
}
