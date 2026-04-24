// ── Shared Application State ──
// Single source of truth for all mutable UI state.
// Import this object in any module that needs to read or write state.

export const state = {
  // Navigation
  currentTab: 'exercises',
  currentMuscleKey: null,
  currentPlanId: null,
  currentExerciseName: null,
  navContext: 'home',    // 'home'|'exercise-list'|'plans'|'plan-detail'|'picker'|'weight'|'nutrition'|'nl-meal'|'nl-picker'|'nl-browse'|'ex-history'|'summary'|'exercise-log'

  // Body Weight
  bwCalYear: new Date().getFullYear(),
  bwCalMon: new Date().getMonth(),
  bwRange: 30,
  bwSelDate: null,
  bwCurrentPhoto: null,

  // Nutrition Lab
  nlViewMode: 'today',  // 'today' | 'saved'
  nlSortBy: 'date',
  nlFavOnly: false,
  nlCurrentMealId: null,
  nlPickerIng: null,
  nlPickerGrams: 100,
  nlBrowseMode: false,
  nlCustomPhotoBase64: null,
  nlCalYear: new Date().getFullYear(),
  nlCalMon: new Date().getMonth(),
  nlSelectedDate: new Date().toISOString().slice(0, 10),

  // Exercise History
  exHistRange: 0,
  exHistCalYear: new Date().getFullYear(),
  exHistCalMon: new Date().getMonth(),
  exHistSelectedDate: null,

  // Summary
  summaryRange: 'week',

  // Global Exercise Log
  exLogCalYear: new Date().getFullYear(),
  exLogCalMon: new Date().getMonth(),
  exLogSelectedDate: null,

  // Plans editing
  _planEditing: false,
  _pendingDeletePlanId: null,

  // Drag state (plans)
  _drag: null,
  _dragOrigItems: null,

  // Remove exercise confirmation
  _pendingRemovePlanId: null,
  _pendingRemoveExName: null,

  // Delete meal confirmation
  _pendingDeleteMealId: null,

  // Custom ingredient editing
  _editingCustomIdx: null,
  _pendingDeleteCustomIdx: null,
};

export function resetTransientState() {
  state.currentExerciseName = null;
  state.currentPlanId = null;
  state.currentMuscleKey = null;
  state._planEditing = false;
  state._pendingDeletePlanId = null;
  state._pendingRemovePlanId = null;
  state._pendingRemoveExName = null;
  state._pendingDeleteMealId = null;
  state._editingCustomIdx = null;
  state._pendingDeleteCustomIdx = null;
  state.nlCurrentMealId = null;
  state.nlPickerIng = null;
  state.nlPickerGrams = 100;
  state.nlBrowseMode = false;
  state.nlCustomPhotoBase64 = null;
  state.bwSelDate = null;
  state.bwCurrentPhoto = null;
  state.exHistSelectedDate = null;
  state.exLogSelectedDate = null;
  if (state._drag) {
    if (state._drag.ghost) state._drag.ghost.remove();
    state._drag = null;
  }
  state._dragOrigItems = null;
}
