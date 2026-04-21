// ── RSR Fitness – Application Entry Point ──
// Imports all modules, registers window globals for inline handlers, runs init.

import { state } from './state.js';
import { migrateOldExLogs, getNLMeals, migrateMacroGoalsToMap } from './store.js';
import { initFirebase, onAuthChange, loadFromCloud, signOutUser } from './cloud.js';
import { migratePhotosToStorage, preloadPhotoCache, migrateMealPhotosToStorage } from './storage.js';
import { showView, setHeader } from './navigation.js';
import { buildHome, showExercises, openModal, closeModal, handleOverlayClick, autoSaveExNotes, initModalSwipe, deleteExLog, globalExSearchHandler, groupExSearchHandler } from './exercises.js';
import { renderPlans, openCreatePlan, closeCreatePlan, handleCreateOverlayClick, createPlan, donePlanDetail, setPlanEditMode, openDeletePlanConfirm, closeDeletePlanConfirm, confirmDeletePlan, showPlanDetail, openRemoveExConfirm, closeRemoveExConfirm, confirmRemoveEx, openAddTitle, closeAddTitle, handleTitleOverlayClick, saveTitle, showExercisePicker, togglePickerGroup, toggleExerciseInPlan, previewExercise } from './plans.js';
import { buildWeightView, setBWRange, bwPrevMonth, bwNextMonth, openBWEntry, closeBWEntry, handleBWOverlay, saveBWEntry, deleteBWEntry, bwOnFileSelect, bwRemovePhoto, bwViewPhoto, closeBWViewer, openBWDeleteConfirm, closeBWDeleteConfirm, confirmDeleteAllBW, initBWSheetSwipe } from './bodyweight.js';
import { renderNLMeals, nlShowMeal, nlShowPicker, renderNLPicker, nlPickIngredient, nlCloseAmount, nlSetGrams, nlAdjustPickerGrams, nlConfirmAddIng, nlOpenCreateModal, nlCloseCreate, nlCreateMeal, openDeleteMealConfirm, closeDeleteMealConfirm, confirmDeleteMeal, nlToggleFav, nlDuplicateMeal, nlUploadMealPhoto, nlRemoveMealPhoto, nlOpenMealPhotoViewer, nlCloseMealPhotoViewer, nlSetSort, nlToggleFavFilter, nlBrowseFoods, nlOpenCustomModal, nlCloseCustom, nlCustomPhotoSelected, nlSaveCustom, nlDeleteCustom, nlDeleteCustomConfirm, closeDeleteCustomConfirm, confirmDeleteCustom, nlAdjustIng, nlRemoveIng, nlAutoSaveNotes, renderMacroGoals, openMacroGoalsModal, closeMacroGoalsModal, saveMacroGoalsFromModal, nlSetViewMode, renderNLCalendar, nlPrevMonth, nlNextMonth, nlSelectDate, onMacroCalInput, setQuickCal, clearDateGoal, resumeDateGoal, openNLFabChoice, closeNLFabChoice, openSavedMealPicker, closeSavedMealPicker, pickSavedMeal, nlOpenRenameModal, nlCloseRename, nlSaveRename } from './nutrition.js';
import { openExHistory, setExHistRange, exHistPrevMonth, exHistNextMonth, exHistJumpToDate, renderExHistSets, openExHistEntry, closeExHistEntry, saveExHistEntry, deleteExHistEntry, initExHistSheetSwipe, openDeleteAllExHist, closeDeleteAllExHist, confirmDeleteAllExHist } from './history.js';
import { rebuildAllPRs } from './prs.js';
import { openSummary, setSummaryRange } from './summary.js';
import { showSignInScreen, showLoadingScreen, showApp, updateUserUI, handleSignIn, handleEmailSignIn, handleEmailRegister, handleForgotPassword, showAuthTab, handleSignOut, confirmSignOut, cancelSignOut } from './auth.js';

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
    setHeader('Exercises', false);
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
    // Reset calendar to today
    const now = new Date();
    state.nlSelectedDate = now.toISOString().slice(0, 10);
    state.nlCalYear = now.getFullYear();
    state.nlCalMon = now.getMonth();
    renderNLCalendar();
    renderNLMeals();
    renderMacroGoals();
  }
}

function handleFab() {
  if (state.currentTab === 'plans') openCreatePlan();
  else if (state.currentTab === 'nutrition') {
    if (state.nlViewMode === 'today') openNLFabChoice();
    else nlOpenCreateModal();
  }
}

function handleBack() {
  if (state.navContext === 'exercise-list') {
    showView('homeView');
    setHeader('Exercises', false);
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
    renderNLCalendar();
    renderNLMeals();
    renderMacroGoals();
  } else if (state.navContext === 'nl-picker') {
    const meal = getNLMeals().find(m => m.id === state.nlCurrentMealId);
    showView('nlMealView');
    setHeader(meal ? meal.name : 'Meal', true);
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
    renderNLCalendar();
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
window.deleteExLog = deleteExLog;
window.openExHistory = openExHistory;
window.globalExSearchHandler = globalExSearchHandler;
window.groupExSearchHandler = groupExSearchHandler;

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
window.openDeleteMealConfirm = openDeleteMealConfirm;
window.closeDeleteMealConfirm = closeDeleteMealConfirm;
window.confirmDeleteMeal = confirmDeleteMeal;
window.nlToggleFav = nlToggleFav;
window.nlDuplicateMeal = nlDuplicateMeal;
window.nlUploadMealPhoto = nlUploadMealPhoto;
window.nlRemoveMealPhoto = nlRemoveMealPhoto;
window.nlOpenMealPhotoViewer = nlOpenMealPhotoViewer;
window.nlCloseMealPhotoViewer = nlCloseMealPhotoViewer;
window.nlSetSort = nlSetSort;
window.nlToggleFavFilter = nlToggleFavFilter;
window.nlBrowseFoods = nlBrowseFoods;
window.nlOpenCustomModal = nlOpenCustomModal;
window.nlCloseCustom = nlCloseCustom;
window.nlCustomPhotoSelected = nlCustomPhotoSelected;
window.nlSaveCustom = nlSaveCustom;
window.nlDeleteCustom = nlDeleteCustom;
window.nlDeleteCustomConfirm = nlDeleteCustomConfirm;
window.closeDeleteCustomConfirm = closeDeleteCustomConfirm;
window.confirmDeleteCustom = confirmDeleteCustom;
window.nlOpenRenameModal = nlOpenRenameModal;
window.nlCloseRename = nlCloseRename;
window.nlSaveRename = nlSaveRename;
window.nlAdjustIng = nlAdjustIng;
window.nlRemoveIng = nlRemoveIng;
window.nlAutoSaveNotes = nlAutoSaveNotes;
window.renderMacroGoals = renderMacroGoals;
window.openMacroGoalsModal = openMacroGoalsModal;
window.closeMacroGoalsModal = closeMacroGoalsModal;
window.saveMacroGoalsFromModal = saveMacroGoalsFromModal;
window.nlSetViewMode = nlSetViewMode;
window.nlPrevMonth = nlPrevMonth;
window.nlNextMonth = nlNextMonth;
window.nlSelectDate = nlSelectDate;
window.onMacroCalInput = onMacroCalInput;
window.setQuickCal = setQuickCal;
window.clearDateGoal = clearDateGoal;
window.resumeDateGoal = resumeDateGoal;
window.openNLFabChoice = openNLFabChoice;
window.closeNLFabChoice = closeNLFabChoice;
window.openSavedMealPicker = openSavedMealPicker;
window.closeSavedMealPicker = closeSavedMealPicker;
window.pickSavedMeal = pickSavedMeal;

// Summary
window.openSummary = openSummary;
window.setSummaryRange = setSummaryRange;

// Exercise History
window.setExHistRange = setExHistRange;
window.exHistPrevMonth = exHistPrevMonth;
window.exHistNextMonth = exHistNextMonth;
window.exHistJumpToDate = exHistJumpToDate;
window.renderExHistSets = renderExHistSets;
window.openExHistEntry = openExHistEntry;
window.closeExHistEntry = closeExHistEntry;
window.saveExHistEntry = saveExHistEntry;
window.deleteExHistEntry = deleteExHistEntry;
window.openDeleteAllExHist = openDeleteAllExHist;
window.closeDeleteAllExHist = closeDeleteAllExHist;
window.confirmDeleteAllExHist = confirmDeleteAllExHist;

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
// Auth UI (delegated to auth.js)
// ═══════════════════════════════════════════

window.handleForgotPassword = handleForgotPassword;
window.handleEmailSignIn = handleEmailSignIn;
window.handleEmailRegister = handleEmailRegister;
window.showAuthTab = showAuthTab;
window.confirmSignOut = confirmSignOut;
window.cancelSignOut = cancelSignOut;
window.handleSignIn = handleSignIn;
window.handleSignOut = () => handleSignOut(closeBurgerMenu);

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════

function startApp() {
  applyStoredTheme();
  migrateOldExLogs();
  migrateMacroGoalsToMap();
  rebuildAllPRs();
  buildHome();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Force iOS to check for a new SW every time the app opens
    reg.update();
  });
  // Auto-reload when a new Service Worker takes over (new code deployed)
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

// Register swipe dismissals once — before Firebase, so they never accumulate
initModalSwipe();
initExHistSheetSwipe();
initBWSheetSwipe();

initFirebase();

onAuthChange(async (user) => {
  if (user) {
    // Block email/password users who haven't verified their email
    if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
      await signOutUser();
      showSignInScreen();
      document.getElementById('siError').textContent = 'Please verify your email before signing in. Check your inbox.';
      return;
    }
    showLoadingScreen('Syncing your data…');
    await loadFromCloud(user.uid);
    updateUserUI(user);
    showApp();
    startApp();
    // Background: migrate base64 photos to separate Firestore docs, then cache locally
    migratePhotosToStorage(user.uid)
      .then(() => migrateMealPhotosToStorage(user.uid))
      .then(() => preloadPhotoCache())
      .catch(() => {});
  } else {
    showSignInScreen();
  }
});
