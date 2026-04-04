// ── My Trainer – Application Entry Point ──
// Imports all modules, registers window globals for inline handlers, runs init.

import { state } from './state.js';
import { migrateOldExLogs, getNLMeals } from './store.js';
import { showView, setHeader } from './navigation.js';
import { buildHome, showExercises, openModal, closeModal, handleOverlayClick, autoSaveExNotes, initModalSwipe } from './exercises.js';
import { renderPlans, openCreatePlan, closeCreatePlan, handleCreateOverlayClick, createPlan, donePlanDetail, setPlanEditMode, openDeletePlanConfirm, closeDeletePlanConfirm, confirmDeletePlan, showPlanDetail, openRemoveExConfirm, closeRemoveExConfirm, confirmRemoveEx, openAddTitle, closeAddTitle, handleTitleOverlayClick, saveTitle, showExercisePicker, togglePickerGroup, toggleExerciseInPlan, previewExercise } from './plans.js';
import { buildWeightView, setBWRange, bwPrevMonth, bwNextMonth, openBWEntry, closeBWEntry, handleBWOverlay, saveBWEntry, deleteBWEntry, bwOnFileSelect, bwRemovePhoto, bwViewPhoto, closeBWViewer, openBWDeleteConfirm, closeBWDeleteConfirm, confirmDeleteAllBW } from './bodyweight.js';
import { renderNLMeals, nlShowMeal, nlShowPicker, renderNLPicker, nlPickIngredient, nlCloseAmount, nlSetGrams, nlAdjustPickerGrams, nlConfirmAddIng, nlOpenCreateModal, nlCloseCreate, nlCreateMeal, nlDeleteMeal, nlToggleFav, nlDuplicateMeal, nlCopySummary, nlSetSort, nlToggleFavFilter, nlBrowseFoods, nlOpenCustomModal, nlCloseCustom, nlCustomPhotoSelected, nlSaveCustom, nlAdjustIng, nlRemoveIng, nlAutoSaveNotes, renderMacroGoals, openMacroGoalsModal, closeMacroGoalsModal, saveMacroGoalsFromModal } from './nutrition.js';
import { openExHistory, setExHistRange, exHistPrevMonth, exHistNextMonth, renderExHistSets, openExHistEntry, closeExHistEntry, saveExHistEntry, deleteExHistEntry } from './history.js';
import { rebuildAllPRs } from './prs.js';
import { openSummary, setSummaryRange } from './summary.js';

// ═══════════════════════════════════════════
// Tab Switching & Navigation (orchestration)
// ═══════════════════════════════════════════

function switchTab(tab) {
  state.currentTab = tab;
  document.getElementById('tabEx').classList.toggle('active', tab === 'exercises');
  document.getElementById('tabPlans').classList.toggle('active', tab === 'plans');
  document.getElementById('tabWeight').classList.toggle('active', tab === 'weight');
  document.getElementById('tabNutrition').classList.toggle('active', tab === 'nutrition');

  if (tab === 'exercises') {
    showView('homeView');
    setHeader('My Trainer \ud83d\udcaa', false);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'home';
    buildHome();
  } else if (tab === 'plans') {
    showView('plansView');
    setHeader('My Plans', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'plans';
    renderPlans();
  } else if (tab === 'weight') {
    showView('bodyWeightView');
    setHeader('Body Weight', false);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'weight';
    buildWeightView();
  } else if (tab === 'nutrition') {
    showView('nutritionView');
    setHeader('Nutrition Lab', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'nutrition';
    renderNLMeals();
    renderMacroGoals();
  }
}

function handleFab() {
  if (state.currentTab === 'plans') openCreatePlan();
  else if (state.currentTab === 'nutrition') nlOpenCreateModal();
}

function handleBack() {
  if (state.navContext === 'exercise-list') {
    showView('homeView');
    setHeader('My Trainer \ud83d\udcaa', false);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'home';
    state.currentMuscleKey = null;
  } else if (state.navContext === 'plan-detail') {
    state._planEditing = false;
    showView('plansView');
    setHeader('My Plans', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'plans';
    state.currentPlanId = null;
    renderPlans();
  } else if (state.navContext === 'picker') {
    showPlanDetail(state.currentPlanId);
  } else if (state.navContext === 'nl-meal') {
    showView('nutritionView');
    setHeader('Nutrition Lab', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'nutrition';
    state.nlCurrentMealId = null;
    renderNLMeals();
  } else if (state.navContext === 'nl-picker') {
    const meal = getNLMeals().find(m => m.id === state.nlCurrentMealId);
    showView('nlMealView');
    setHeader(meal ? meal.name : 'Meal', true, 'Delete', nlDeleteMeal);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'nl-meal';
  } else if (state.navContext === 'ex-history') {
    if (state.currentPlanId) showPlanDetail(state.currentPlanId);
    else switchTab('exercises');
  } else if (state.navContext === 'nl-browse') {
    showView('nutritionView');
    setHeader('Nutrition Lab', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'nutrition';
    renderNLMeals();
  } else if (state.navContext === 'summary') {
    switchTab(state.currentTab);
  }
}

// ═══════════════════════════════════════════
// Expose Functions to Window (inline onclick)
// ═══════════════════════════════════════════

// Navigation
window.switchTab = switchTab;
window.handleBack = handleBack;
window.handleFab = handleFab;

// Exercises
window.buildHome = buildHome;
window.showExercises = showExercises;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleOverlayClick = handleOverlayClick;
window.autoSaveExNotes = autoSaveExNotes;
window.openExHistory = openExHistory;

// Plans
window.renderPlans = renderPlans;
window.openCreatePlan = openCreatePlan;
window.closeCreatePlan = closeCreatePlan;
window.handleCreateOverlayClick = handleCreateOverlayClick;
window.createPlan = createPlan;
window.donePlanDetail = donePlanDetail;
window.setPlanEditMode = setPlanEditMode;
window.openDeletePlanConfirm = openDeletePlanConfirm;
window.closeDeletePlanConfirm = closeDeletePlanConfirm;
window.confirmDeletePlan = confirmDeletePlan;
window.showPlanDetail = showPlanDetail;
window.showExercisePicker = showExercisePicker;
window.togglePickerGroup = togglePickerGroup;
window.toggleExerciseInPlan = toggleExerciseInPlan;
window.previewExercise = previewExercise;
window.openRemoveExConfirm = openRemoveExConfirm;
window.closeRemoveExConfirm = closeRemoveExConfirm;
window.confirmRemoveEx = confirmRemoveEx;
window.openAddTitle = openAddTitle;
window.closeAddTitle = closeAddTitle;
window.handleTitleOverlayClick = handleTitleOverlayClick;
window.saveTitle = saveTitle;

// Body Weight
window.buildWeightView = buildWeightView;
window.setBWRange = setBWRange;
window.bwPrevMonth = bwPrevMonth;
window.bwNextMonth = bwNextMonth;
window.openBWEntry = openBWEntry;
window.closeBWEntry = closeBWEntry;
window.handleBWOverlay = handleBWOverlay;
window.saveBWEntry = saveBWEntry;
window.deleteBWEntry = deleteBWEntry;
window.bwOnFileSelect = bwOnFileSelect;
window.bwRemovePhoto = bwRemovePhoto;
window.bwViewPhoto = bwViewPhoto;
window.closeBWViewer = closeBWViewer;
window.openBWDeleteConfirm = openBWDeleteConfirm;
window.closeBWDeleteConfirm = closeBWDeleteConfirm;
window.confirmDeleteAllBW = confirmDeleteAllBW;

// Nutrition
window.renderNLMeals = renderNLMeals;
window.nlShowMeal = nlShowMeal;
window.nlShowPicker = nlShowPicker;
window.renderNLPicker = renderNLPicker;
window.nlPickIngredient = nlPickIngredient;
window.nlCloseAmount = nlCloseAmount;
window.nlSetGrams = nlSetGrams;
window.nlAdjustPickerGrams = nlAdjustPickerGrams;
window.nlConfirmAddIng = nlConfirmAddIng;
window.nlOpenCreateModal = nlOpenCreateModal;
window.nlCloseCreate = nlCloseCreate;
window.nlCreateMeal = nlCreateMeal;
window.nlDeleteMeal = nlDeleteMeal;
window.nlToggleFav = nlToggleFav;
window.nlDuplicateMeal = nlDuplicateMeal;
window.nlCopySummary = nlCopySummary;
window.nlSetSort = nlSetSort;
window.nlToggleFavFilter = nlToggleFavFilter;
window.nlBrowseFoods = nlBrowseFoods;
window.nlOpenCustomModal = nlOpenCustomModal;
window.nlCloseCustom = nlCloseCustom;
window.nlCustomPhotoSelected = nlCustomPhotoSelected;
window.nlSaveCustom = nlSaveCustom;
window.nlAdjustIng = nlAdjustIng;
window.nlRemoveIng = nlRemoveIng;
window.nlAutoSaveNotes = nlAutoSaveNotes;
window.renderMacroGoals = renderMacroGoals;
window.openMacroGoalsModal = openMacroGoalsModal;
window.closeMacroGoalsModal = closeMacroGoalsModal;
window.saveMacroGoalsFromModal = saveMacroGoalsFromModal;

// Summary
window.openSummary = openSummary;
window.setSummaryRange = setSummaryRange;

// Exercise History
window.setExHistRange = setExHistRange;
window.exHistPrevMonth = exHistPrevMonth;
window.exHistNextMonth = exHistNextMonth;
window.renderExHistSets = renderExHistSets;
window.openExHistEntry = openExHistEntry;
window.closeExHistEntry = closeExHistEntry;
window.saveExHistEntry = saveExHistEntry;
window.deleteExHistEntry = deleteExHistEntry;

// ═══════════════════════════════════════════
// Burger Menu & Theme
// ═══════════════════════════════════════════

function toggleBurgerMenu() {
  document.getElementById('burgerOverlay').classList.toggle('open');
  document.getElementById('burgerMenu').classList.toggle('open');
}

function closeBurgerMenu() {
  document.getElementById('burgerOverlay').classList.remove('open');
  document.getElementById('burgerMenu').classList.remove('open');
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = isLight ? '#f2f2f7' : '#0f0f1a';
}

function applyStoredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'light') {
    document.documentElement.classList.add('light');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = '#f2f2f7';
  }
}

window.toggleBurgerMenu = toggleBurgerMenu;
window.closeBurgerMenu = closeBurgerMenu;
window.toggleTheme = toggleTheme;

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

applyStoredTheme();
migrateOldExLogs();
rebuildAllPRs();
buildHome();
initModalSwipe();
