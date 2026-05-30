// ── localStorage Service ──
// All persistent data access in one place.
// Every save also calls _cloudSave() in the background for Firestore sync.
// The cloud module registers its save function via setCloudSaver().

import { dateToStr } from './utils.js';

let _cloudSave = () => {};

export function setCloudSaver(fn) { _cloudSave = fn; }

// localStorage write that survives quota exceedance. Returns true on success.
// On quota error: logs, dispatches a global event so the UI can warn the user,
// and returns false so callers can avoid acting as if persistence succeeded.
let _quotaWarned = false;
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('localStorage quota exceeded for key:', key);
      if (!_quotaWarned) {
        _quotaWarned = true;
        try { window.dispatchEvent(new CustomEvent('rsr-quota-exceeded', { detail: { key } })); } catch {}
      }
      return false;
    }
    throw e;
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
  _exHistByDateCache = null;
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
            const ds = dateToStr(parsed);
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

// ── Weight Goal ──
export function getWeightGoal() {
  const v = localStorage.getItem('trainer_weight_goal');
  return v ? parseFloat(v) : null;
}
export function saveWeightGoal(kg) {
  if (kg === null) {
    localStorage.removeItem('trainer_weight_goal');
    _cloudSave('sections', 'weightgoal', 'null');
  } else {
    safeSetItem('trainer_weight_goal', kg.toString());
    _cloudSave('sections', 'weightgoal', kg.toString());
  }
}

// ── User Theme ──
export function saveUserTheme(name) {
  safeSetItem('trainer_user_theme', name);
  _cloudSave('sections', 'usertheme', name);
}

// ── User Height ──
export function getUserHeight() {
  const v = localStorage.getItem('trainer_user_height');
  return v ? parseFloat(v) : null;
}
export function saveUserHeight(cm) {
  safeSetItem('trainer_user_height', cm.toString());
  _cloudSave('sections', 'userheight', cm.toString());
}
export function clearUserHeight() {
  localStorage.removeItem('trainer_user_height');
  _cloudSave('sections', 'userheight', 'null');
}

// ── User Profile (age / sex / activity / goal) ──
// Used by the macro calculator wizard. Stored as one JSON blob so we don't
// add four more localStorage keys + sync sections.
export function getUserProfile() {
  try { return JSON.parse(localStorage.getItem('trainer_user_profile')) || {}; }
  catch { return {}; }
}
export function saveUserProfile(profile) {
  const v = JSON.stringify(profile || {});
  safeSetItem('trainer_user_profile', v);
  _cloudSave('sections', 'userprofile', v);
}

// Backward-compat helpers (old entries are plain numbers, new are {w,p} objects)
export function bwGetWeight(val) { return typeof val === 'object' && val ? Number(val.w) : Number(val); }
// Returns array of photo markers (e.g. ['cloud','cloud']) or empty array
export function bwGetPhotos(val) {
  if (typeof val !== 'object' || !val || !val.p) return [];
  if (Array.isArray(val.p)) return val.p;
  return [val.p]; // migrate old single-string format
}
export function bwHasPhoto(val) { return bwGetPhotos(val).length > 0; }

// ── Nutrition Lab Meals ──
const DEFAULT_MEALS = [
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
  {
    id: 'default_meal_4',
    name: 'Pizza Slice',
    type: 'saved',
    image: 'assets/foods/saved-meals/pizza-slice.jpg',
    ingredients: [
      {name:'White Bread',    grams:80,  p:9,   c:49,  f:3.2, cal:212, img:'assets/foods/grains/white-bread.jpg'},
      {name:'Tomato Sauce',   grams:30,  p:1.6, c:6.7, f:0.3, cal:9,   img:'assets/foods/oils-and-condiments/tomato-sauce.jpg'},
      {name:'Mozzarella',     grams:40,  p:22,  c:2.2, f:22,  cal:120, img:'assets/foods/dairy/mozzarella.jpg'},
      {name:'Olive Oil',      grams:5,   p:0,   c:0,   f:100, cal:44,  img:'assets/foods/oils-and-condiments/olive-oil.jpg'},
    ],
    notes: '',
    favorite: false,
    createdAt: '2025-01-01',
  },
  {
    id: 'default_meal_5',
    name: 'Burger',
    type: 'saved',
    image: 'assets/foods/saved-meals/burger.jpg',
    ingredients: [
      {name:'White Bread',             grams:90,  p:9,    c:49, f:3.2, cal:239, img:'assets/foods/grains/white-bread.jpg'},
      {name:'Ground Beef lean (cooked)', grams:120, p:26,   c:0,  f:15,  cal:305, img:'assets/foods/meat/ground-beef.jpg'},
      {name:'Cheddar Cheese',          grams:20,  p:25,   c:1.3,f:33,  cal:80,  img:'assets/foods/dairy/cheddar-cheese.jpg'},
      {name:'Lettuce',                 grams:15,  p:1.4,  c:2.9,f:0.2, cal:2,   img:'assets/foods/vegetables/lettuce.jpg'},
      {name:'Tomato',                  grams:25,  p:0.9,  c:3.9,f:0.2, cal:5,   img:'assets/foods/vegetables/tomato.jpg'},
      {name:'Ketchup',                 grams:15,  p:1,    c:26, f:0.2, cal:17,  img:'assets/foods/oils-and-condiments/ketchup.jpg'},
    ],
    notes: '',
    favorite: false,
    createdAt: '2025-01-01',
  },
];

// Track default meals the user has explicitly deleted, so the "add new defaults"
// migration below doesn't resurrect them on every reload. Without this, deleting
// any default meal would respawn it the next time the app boots.
function getDeletedDefaultMealIds() {
  try { return new Set(JSON.parse(localStorage.getItem('trainer_deleted_default_meals')) || []); }
  catch { return new Set(); }
}
function saveDeletedDefaultMealIds(set) {
  const v = JSON.stringify([...set]);
  safeSetItem('trainer_deleted_default_meals', v);
  _cloudSave('sections', 'deleteddefaultmeals', v);
}
export function markDefaultMealDeleted(id) {
  if (!DEFAULT_MEALS.some(d => d.id === id)) return;
  const set = getDeletedDefaultMealIds();
  set.add(id);
  saveDeletedDefaultMealIds(set);
}

export function getNLMeals() {
  try {
    const raw = localStorage.getItem('trainer_meals');
    if (raw === null) { saveNLMeals(DEFAULT_MEALS); return DEFAULT_MEALS; }
    const meals = JSON.parse(raw) || [];
    const deletedDefaults = getDeletedDefaultMealIds();
    // Migrate: patch default meal images if missing
    let changed = false;
    meals.forEach(m => {
      const def = DEFAULT_MEALS.find(d => d.id === m.id);
      if (def?.image && !m.image) { m.image = def.image; changed = true; }
    });
    // Migrate: add any new default meals introduced after first install,
    // but skip ones the user previously deleted.
    DEFAULT_MEALS.forEach(def => {
      if (deletedDefaults.has(def.id)) return;
      if (!meals.some(m => m.id === def.id)) { meals.push(def); changed = true; }
    });
    if (changed) saveNLMeals(meals);
    return meals;
  } catch { return []; }
}
export function saveNLMeals(m) {
  // _cachedTotals is a runtime calc cache (see nutrition.js _mealTotals). It
  // gets mutated onto meal objects, so we strip it before persisting to keep
  // localStorage and Firestore free of derived data.
  const v = JSON.stringify(m, (key, val) => key === '_cachedTotals' ? undefined : val);
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

// Cache sorted dates and parsed map to avoid re-parsing on every getGoalsForDate() call
let _cachedGoalDates = null;
let _cachedGoalsMap = null;

export function invalidateGoalDatesCache() { _cachedGoalDates = null; _cachedGoalsMap = null; }

export function getMacroGoalsMap() {
  if (_cachedGoalsMap) return _cachedGoalsMap;
  try { _cachedGoalsMap = JSON.parse(localStorage.getItem('trainer_macro_goals_map')) || {}; } catch { _cachedGoalsMap = {}; }
  return _cachedGoalsMap;
}
export function saveMacroGoalsMap(map) {
  const v = JSON.stringify(map);
  safeSetItem('trainer_macro_goals_map', v);
  _cloudSave('sections', 'macrogoalsmap', v);
  _cachedGoalsMap = null;
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
let _exHistByDateCache = null;

export function invalidateExHistCache() { _exHistByDateCache = null; }

export function getAllExHistByDate() {
  if (_exHistByDateCache) return _exHistByDateCache;
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
  _exHistByDateCache = result;
  return result;
}

// ── Clear All Exercise Data (history + notes + PRs) ──
export function clearAllExerciseData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('trainer_exhist_') || k.startsWith('trainer_notes_'))) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('trainer_prs');
  _cloudSave('sections', 'prs', '{}');
  _exHistByDateCache = null;
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

// ── Custom Exercises ──
export function getCustomExercises() {
  try { return JSON.parse(localStorage.getItem('trainer_custom_exercises')) || []; } catch { return []; }
}
export function saveCustomExercises(list) {
  const v = JSON.stringify(list);
  safeSetItem('trainer_custom_exercises', v);
  _cloudSave('sections', 'customexercises', v);
}

// ── Prefs (rest timer default, auto-start timer, etc.) ──
const PREFS_DEFAULTS = {
  defaultRestSec: 150,
  autoStartTimer: true,
};
export function getPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem('trainer_prefs')) || {};
    return { ...PREFS_DEFAULTS, ...stored };
  } catch { return { ...PREFS_DEFAULTS }; }
}
export function savePrefs(prefs) {
  const v = JSON.stringify(prefs);
  safeSetItem('trainer_prefs', v);
  _cloudSave('sections', 'prefs', v);
}
