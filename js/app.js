// ── RSR Fitness – Application Entry Point ──
// Imports all modules, registers window globals for inline handlers, runs init.

import { state, resetTransientState } from './state.js';
import { migrateOldExLogs, getNLMeals, saveNLMeals, migrateMacroGoalsToMap, clearAllExerciseData as clearExData, saveBWEmpty, saveUserTheme } from './store.js';
import { initFirebase, onAuthChange, loadFromCloud, signOutUser, deleteCollection } from './cloud.js';
import { migratePhotosToStorage, preloadPhotoCache, migrateMealPhotosToStorage } from './storage.js';
import { showView, setHeader } from './navigation.js';
import { buildHome, showExercises, openModal, closeModal, setOnModalClose, handleOverlayClick, autoSaveExNotes, initModalSwipe, deleteExLog, globalExSearchHandler, groupExSearchHandler, openCustomExModal, closeCustomExModal, customExImageSelected, removeCustomExImage, saveCustomEx, deleteCustomEx } from './exercises.js';
import { renderPlans, openCreatePlan, closeCreatePlan, handleCreateOverlayClick, createPlan, setPlanEditMode, savePlanName, openDeletePlanConfirm, showPlanDetail, openRemoveExConfirm, openAddTitle, closeAddTitle, handleTitleOverlayClick, saveTitle, showExercisePicker, togglePickerGroup, toggleExerciseInPlan, previewExercise, openCreatePlanChoice, closeCreatePlanChoice, openAIPlan, closeAIPlan, aiAdjustDays, aiSetLevel, aiToggleFocus, aiGenerate, closeAIPreview, aiRemoveItem, aiRegenerate, aiSaveGenerated } from './plans.js';
import { openConfirmDialog, closeConfirmDialog, runConfirmDialog } from './utils.js';
import { buildWeightView, setBWRange, bwPrevMonth, bwNextMonth, openBWEntry, closeBWEntry, handleBWOverlay, saveBWEntry, openDeleteBWConfirm, bwOnFileSelect, bwRemovePhoto, bwViewPhoto, closeBWViewer, openBWDeleteConfirm, initBWSheetSwipe, bmiPromptHeight, bwEditGoal, bwClearGoal, closeHeightSheet, saveHeightFromSheet, clearHeightFromSheet, closeGoalSheet, saveGoalFromSheet, clearGoalFromSheet } from './bodyweight.js';
import { renderNLMeals, nlShowMeal, nlShowPicker, renderNLPicker, nlSearchPicker, nlPickIngredient, nlCloseAmount, nlSetGrams, nlAdjustPickerGrams, nlConfirmAddIng, nlOpenCreateModal, nlCloseCreate, nlCreateMeal, openDeleteMealConfirm, nlToggleFav, nlDuplicateMeal, nlSaveAsSavedMeal, nlUploadMealPhoto, nlRemoveMealPhoto, nlOpenMealPhotoViewer, nlCloseMealPhotoViewer, nlSetSort, nlToggleFavFilter, nlBrowseFoods, nlOpenCustomModal, nlCloseCustom, nlCustomPhotoSelected, nlRemoveCustomPhoto, nlViewCustomPhoto, nlUpdateCustomCal, nlSaveCustom, nlDeleteCustomConfirm, nlAdjustIng, nlRemoveIng, nlAutoSaveNotes, renderMacroGoals, openMacroGoalsModal, closeMacroGoalsModal, saveMacroGoalsFromModal, initMacroGoalsSwipe, nlSetViewMode, renderNLCalendar, nlPrevMonth, nlNextMonth, nlSelectDate, onMacroCalInput, setQuickCal, clearDateGoal, resumeDateGoal, openNLFabChoice, closeNLFabChoice, openSavedMealPicker, closeSavedMealPicker, nlFilterSavedMeals, pickSavedMeal, nlOpenRenameModal, nlCloseRename, nlSaveRename, openDeleteAllMealLogs, nlSearchBarcode, nlCloseBarcodeResult, nlSaveBarcodeAsCustom, nlToggleCreateChoice, nlCloseCreateChoice, nlShowBarcodeInput, nlBarcodePhotoSelected, nlRemoveBarcodePhoto, nlOpenBarcodeScanner, nlCloseBarcodeScanner, nlBarcodeScanFile } from './nutrition.js';
import { openExHistory, setExHistRange, exHistPrevMonth, exHistNextMonth, exHistJumpToDate, renderExHistSets, openExHistEntry, closeExHistEntry, saveExHistEntry, openDeleteExHistConfirm, initExHistSheetSwipe, openDeleteAllExHist } from './history.js';
import { rebuildAllPRs, openPRsView } from './prs.js';
import { openSummary, setSummaryRange } from './summary.js';
import { openExerciseLog, exLogPrevMonth, exLogNextMonth, exLogSelectDate, openDeleteAllExerciseData } from './exerciselog.js';
import { exportData } from './export.js';
import { openGallery } from './gallery.js';
import { openWaterView, waterAdd, waterUndo, waterReset, waterAdjustTarget, waterAddBottle, waterAdjustBottle } from './water.js';
import { sessionFocus, sessionAddSet, sessionDeleteSet, sessionUpdateSet, sessionSaveSet, sessionRestAdjust, sessionRestSkip, sessionRestTogglePause, sessionFinish, sessionHandleBack } from './session.js';
import { openMuscleBalance, setMBRange } from './musclebalance.js';
import { showSignInScreen, showLoadingScreen, showApp, updateUserUI, handleSignIn, handleEmailSignIn, handleEmailRegister, handleForgotPassword, showAuthTab, handleSignOut, confirmSignOut, cancelSignOut } from './auth.js';

// ═══════════════════════════════════════════
// Tab Switching & Navigation (orchestration)
// ═══════════════════════════════════════════

const TAB_CONTEXTS = ['home', 'plans', 'weight', 'nutrition'];

function switchTab(tab) {
  if (state.currentTab === tab && TAB_CONTEXTS.includes(state.navContext)) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  resetTransientState();
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
  if (state.navContext === 'exercise-list') openCustomExModal();
  else if (state.currentTab === 'plans') openCreatePlanChoice();
  else if (state.currentTab === 'nutrition') {
    if (state.nlViewMode === 'today') openNLFabChoice();
    else nlOpenCreateModal();
  }
}

function handleBack() {
  if (state.navContext === 'session') {
    if (sessionHandleBack()) return;
  }
  if (state.navContext === 'exercise-list') {
    showView('homeView');
    setHeader('Exercises', false);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'home';
    state.currentMuscleKey = null;
  } else if (state.navContext === 'plan-detail') {
    savePlanName();
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
    state.nlPickerIng = null;
    state.nlPickerGrams = 100;
    const meal = getNLMeals().find(m => m.id === state.nlCurrentMealId);
    showView('nlMealView');
    setHeader(meal ? meal.name : 'Meal', true, '&#9998;', nlOpenRenameModal);
    document.getElementById('fab').classList.add('hidden');
    state.navContext = 'nl-meal';
  } else if (state.navContext === 'ex-history') {
    state.currentExerciseName = null;
    state.exHistSelectedDate = null;
    if (state.currentPlanId) showPlanDetail(state.currentPlanId);
    else switchTab('exercises');
  } else if (state.navContext === 'nl-browse') {
    state.nlBrowseMode = false;
    showView('nutritionView');
    setHeader('Nutrition Lab', false);
    document.getElementById('fab').classList.remove('hidden');
    state.navContext = 'nutrition';
    renderNLCalendar();
    renderNLMeals();
    renderMacroGoals();
  } else if (state.navContext === 'summary') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
  } else if (state.navContext === 'exercise-log') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
  } else if (state.navContext === 'prs') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
  } else if (state.navContext === 'gallery') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
  } else if (state.navContext === 'water') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
  } else if (state.navContext === 'muscle-balance') {
    const tab = state.currentTab;
    state.currentTab = null;
    switchTab(tab);
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
window.openCustomExModal = openCustomExModal;
window.closeCustomExModal = closeCustomExModal;
window.customExImageSelected = customExImageSelected;
window.removeCustomExImage = removeCustomExImage;
window.saveCustomEx = saveCustomEx;
window.deleteCustomEx = deleteCustomEx;

// Shared confirm dialog
window.closeConfirmDialog = closeConfirmDialog;
window.runConfirmDialog = runConfirmDialog;

// Plans
window.renderPlans = renderPlans;
window.openCreatePlan = openCreatePlan;
window.closeCreatePlan = closeCreatePlan;
window.handleCreateOverlayClick = handleCreateOverlayClick;
window.createPlan = createPlan;
window.openCreatePlanChoice = openCreatePlanChoice;
window.closeCreatePlanChoice = closeCreatePlanChoice;
window.openAIPlan = openAIPlan;
window.closeAIPlan = closeAIPlan;
window.aiAdjustDays = aiAdjustDays;
window.aiSetLevel = aiSetLevel;
window.aiToggleFocus = aiToggleFocus;
window.aiGenerate = aiGenerate;
window.closeAIPreview = closeAIPreview;
window.aiRemoveItem = aiRemoveItem;
window.aiRegenerate = aiRegenerate;
window.aiSaveGenerated = aiSaveGenerated;
window.setPlanEditMode = setPlanEditMode;
window.openDeletePlanConfirm = openDeletePlanConfirm;
window.showPlanDetail = showPlanDetail;
window.showExercisePicker = showExercisePicker;
window.togglePickerGroup = togglePickerGroup;
window.toggleExerciseInPlan = toggleExerciseInPlan;
window.previewExercise = previewExercise;
window.openRemoveExConfirm = openRemoveExConfirm;
window.openAddTitle = openAddTitle;
window.closeAddTitle = closeAddTitle;
window.handleTitleOverlayClick = handleTitleOverlayClick;
window.saveTitle = saveTitle;

// Active Session
window.sessionFocus = sessionFocus;
window.sessionAddSet = sessionAddSet;
window.sessionDeleteSet = sessionDeleteSet;
window.sessionUpdateSet = sessionUpdateSet;
window.sessionSaveSet = sessionSaveSet;
window.sessionRestAdjust = sessionRestAdjust;
window.sessionRestSkip = sessionRestSkip;
window.sessionRestTogglePause = sessionRestTogglePause;
window.sessionFinish = sessionFinish;

// Body Weight
window.buildWeightView = buildWeightView;
window.setBWRange = setBWRange;
window.bwPrevMonth = bwPrevMonth;
window.bwNextMonth = bwNextMonth;
window.openBWEntry = openBWEntry;
window.closeBWEntry = closeBWEntry;
window.handleBWOverlay = handleBWOverlay;
window.saveBWEntry = saveBWEntry;
window.openDeleteBWConfirm = openDeleteBWConfirm;
window.bwOnFileSelect = bwOnFileSelect;
window.bwRemovePhoto = bwRemovePhoto;
window.bwViewPhoto = bwViewPhoto;
window.closeBWViewer = closeBWViewer;
window.openBWDeleteConfirm = openBWDeleteConfirm;
window.bmiPromptHeight = bmiPromptHeight;
window.bwEditGoal = bwEditGoal;
window.bwClearGoal = bwClearGoal;
window.closeHeightSheet = closeHeightSheet;
window.saveHeightFromSheet = saveHeightFromSheet;
window.clearHeightFromSheet = clearHeightFromSheet;
window.closeGoalSheet = closeGoalSheet;
window.saveGoalFromSheet = saveGoalFromSheet;
window.clearGoalFromSheet = clearGoalFromSheet;

// Nutrition
window.renderNLMeals = renderNLMeals;
window.nlShowMeal = nlShowMeal;
window.nlShowPicker = nlShowPicker;
window.renderNLPicker = renderNLPicker;
window.nlSearchPicker = nlSearchPicker;
window.nlPickIngredient = nlPickIngredient;
window.nlCloseAmount = nlCloseAmount;
window.nlSetGrams = nlSetGrams;
window.nlAdjustPickerGrams = nlAdjustPickerGrams;
window.nlConfirmAddIng = nlConfirmAddIng;
window.nlOpenCreateModal = nlOpenCreateModal;
window.nlCloseCreate = nlCloseCreate;
window.nlCreateMeal = nlCreateMeal;
window.openDeleteMealConfirm = openDeleteMealConfirm;
window.nlToggleFav = nlToggleFav;
window.nlDuplicateMeal = nlDuplicateMeal;
window.nlSaveAsSavedMeal = nlSaveAsSavedMeal;
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
window.nlRemoveCustomPhoto = nlRemoveCustomPhoto;
window.nlViewCustomPhoto = nlViewCustomPhoto;
window.nlUpdateCustomCal = nlUpdateCustomCal;
window.nlSaveCustom = nlSaveCustom;
window.nlDeleteCustomConfirm = nlDeleteCustomConfirm;
window.nlOpenRenameModal = nlOpenRenameModal;
window.nlCloseRename = nlCloseRename;
window.nlSaveRename = nlSaveRename;
window.openDeleteAllMealLogs = openDeleteAllMealLogs;
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
window.nlFilterSavedMeals = nlFilterSavedMeals;
window.pickSavedMeal = pickSavedMeal;
window.nlSearchBarcode = nlSearchBarcode;
window.nlCloseBarcodeResult = nlCloseBarcodeResult;
window.nlSaveBarcodeAsCustom = nlSaveBarcodeAsCustom;
window.nlBarcodePhotoSelected = nlBarcodePhotoSelected;
window.nlRemoveBarcodePhoto = nlRemoveBarcodePhoto;
window.nlOpenBarcodeScanner = nlOpenBarcodeScanner;
window.nlCloseBarcodeScanner = nlCloseBarcodeScanner;
window.nlBarcodeScanFile = nlBarcodeScanFile;
window.nlToggleCreateChoice = nlToggleCreateChoice;
window.nlCloseCreateChoice = nlCloseCreateChoice;
window.nlShowBarcodeInput = nlShowBarcodeInput;

// Summary
window.openSummary = openSummary;
window.exportData = exportData;
window.setSummaryRange = setSummaryRange;

// Global Exercise Log
window.openExerciseLog = openExerciseLog;
window.exLogPrevMonth = exLogPrevMonth;
window.exLogNextMonth = exLogNextMonth;
window.exLogSelectDate = exLogSelectDate;
window.openDeleteAllExerciseData = openDeleteAllExerciseData;
window.openPRsView = openPRsView;
window.openGallery = openGallery;
window.openWaterView = openWaterView;
window.waterAdd = waterAdd;
window.waterUndo = waterUndo;
window.waterReset = waterReset;
window.waterAdjustTarget = waterAdjustTarget;
window.waterAddBottle = waterAddBottle;
window.waterAdjustBottle = waterAdjustBottle;

// Muscle Balance
window.openMuscleBalance = openMuscleBalance;
window.setMBRange = setMBRange;


// Exercise History
window.setExHistRange = setExHistRange;
window.exHistPrevMonth = exHistPrevMonth;
window.exHistNextMonth = exHistNextMonth;
window.exHistJumpToDate = exHistJumpToDate;
window.renderExHistSets = renderExHistSets;
window.openExHistEntry = openExHistEntry;
window.closeExHistEntry = closeExHistEntry;
window.saveExHistEntry = saveExHistEntry;
window.openDeleteExHistConfirm = openDeleteExHistConfirm;
window.openDeleteAllExHist = openDeleteAllExHist;

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
  document.getElementById('clearDataPanel').classList.remove('open');
  document.getElementById('settingsPanel').classList.remove('open');
}

function showClearDataMenu() {
  document.getElementById('clearDataPanel').classList.add('open');
}

function hideClearDataMenu() {
  document.getElementById('clearDataPanel').classList.remove('open');
}

function showSettingsMenu() {
  document.getElementById('settingsPanel').classList.add('open');
}

function hideSettingsMenu() {
  document.getElementById('settingsPanel').classList.remove('open');
}

function showThemeSettingsMenu() {
  document.getElementById('themeSettingsPanel').classList.add('open');
}

function hideThemeSettingsMenu() {
  document.getElementById('themeSettingsPanel').classList.remove('open');
}

function openClearAllData() {
  openConfirmDialog({
    title: 'Delete ALL Data?',
    message: 'This will permanently remove all exercise data, meal logs, and weight entries including photos. This cannot be undone.',
    confirmLabel: 'Yes, Delete Everything',
    onConfirm: () => {
      clearExData();
      deleteCollection('exhist');
      deleteCollection('notes');
      const meals = getNLMeals().filter(m => m.type === 'saved');
      saveNLMeals(meals);
      saveBWEmpty();
      state.exLogSelectedDate = null;
      state.bwSelDate = null;
      state.bwCurrentPhotos = [];
      renderNLCalendar();
      renderNLMeals();
      renderMacroGoals();
      buildWeightView();
    },
  });
}

const THEME_CLASSES = ['light', 'theme-crimson', 'theme-golden', 'theme-ultraviolet'];
const THEME_META = { dark: '#060611', light: '#eef1fa', crimson: '#0b0608', golden: '#0a0804', ultraviolet: '#08061a' };

function setTheme(name, skipSync) {
  THEME_CLASSES.forEach(c => document.documentElement.classList.remove(c));
  if (name === 'light') document.documentElement.classList.add('light');
  else if (name !== 'dark') document.documentElement.classList.add('theme-' + name);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = THEME_META[name] || THEME_META.dark;
  updateThemeSwatches(name);
  if (!skipSync) saveUserTheme(name);
}

function applyStoredTheme() {
  let stored = localStorage.getItem('trainer_user_theme');
  if (!stored) {
    const old = localStorage.getItem('theme');
    if (old) { stored = old; localStorage.removeItem('theme'); }
  }
  setTheme(stored || 'dark', true);
}

function updateThemeSwatches(active) {
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === active);
  });
}

window.toggleBurgerMenu = toggleBurgerMenu;
window.closeBurgerMenu = closeBurgerMenu;
window.setTheme = setTheme;
window.showClearDataMenu = showClearDataMenu;
window.hideClearDataMenu = hideClearDataMenu;
window.showSettingsMenu = showSettingsMenu;
window.hideSettingsMenu = hideSettingsMenu;
window.showThemeSettingsMenu = showThemeSettingsMenu;
window.hideThemeSettingsMenu = hideThemeSettingsMenu;
window.openClearAllData = openClearAllData;

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

// Apply theme early to prevent flash
applyStoredTheme();

// Register swipe dismissals once — before Firebase, so they never accumulate
initModalSwipe();
initExHistSheetSwipe();
initBWSheetSwipe();
initMacroGoalsSwipe();

setOnModalClose(() => {
  if (state.currentPlanId && state.navContext === 'plan-detail') {
    showPlanDetail(state.currentPlanId);
  }
});

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
    showLoadingScreen();
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
