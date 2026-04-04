// ── Shared Application State ──
// Single source of truth for all mutable UI state.
// Import this object in any module that needs to read or write state.

export const state = {
  // Navigation
  currentTab: 'exercises',
  currentMuscleKey: null,
  currentPlanId: null,
  currentExerciseName: null,
  navContext: 'home',    // 'home'|'exercise-list'|'plans'|'plan-detail'|'picker'|'weight'|'nutrition'|'nl-meal'|'nl-picker'|'nl-browse'|'ex-history'

  // Body Weight
  bwCalYear: new Date().getFullYear(),
  bwCalMon: new Date().getMonth(),
  bwRange: 30,
  bwSelDate: null,
  bwCurrentPhoto: null,

  // Nutrition Lab
  nlSortBy: 'date',
  nlFavOnly: false,
  nlCurrentMealId: null,
  nlPickerIng: null,
  nlPickerGrams: 100,
  nlBrowseMode: false,
  nlCustomPhotoBase64: null,

  // Exercise History
  exHistRange: 0,
  exHistCalYear: new Date().getFullYear(),
  exHistCalMon: new Date().getMonth(),
  exHistSelectedDate: null,

  // Summary
  summaryRange: 'week',

  // Drag state (plans)
  _drag: null,
  _dragOrigItems: null,

  // Remove exercise confirmation
  _pendingRemovePlanId: null,
  _pendingRemoveExName: null,
};
