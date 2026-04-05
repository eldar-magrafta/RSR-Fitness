// ── RSR Fitness – Application Entry Point ──
// Imports all modules, registers window globals for inline handlers, runs init.

import { state } from './state.js';
import { migrateOldExLogs, getNLMeals } from './store.js';
import { initFirebase, onAuthChange, loadFromCloud, signInWithGoogle, signOutUser, registerWithEmail, signInWithEmail, sendForgotPassword } from './cloud.js';
import { showView, setHeader } from './navigation.js';
import { buildHome, showExercises, openModal, closeModal, handleOverlayClick, autoSaveExNotes, initModalSwipe, deleteExLog } from './exercises.js';
import { renderPlans, openCreatePlan, closeCreatePlan, handleCreateOverlayClick, createPlan, donePlanDetail, setPlanEditMode, openDeletePlanConfirm, closeDeletePlanConfirm, confirmDeletePlan, showPlanDetail, openRemoveExConfirm, closeRemoveExConfirm, confirmRemoveEx, openAddTitle, closeAddTitle, handleTitleOverlayClick, saveTitle, showExercisePicker, togglePickerGroup, toggleExerciseInPlan, previewExercise } from './plans.js';
import { buildWeightView, setBWRange, bwPrevMonth, bwNextMonth, openBWEntry, closeBWEntry, handleBWOverlay, saveBWEntry, deleteBWEntry, bwOnFileSelect, bwRemovePhoto, bwViewPhoto, closeBWViewer, openBWDeleteConfirm, closeBWDeleteConfirm, confirmDeleteAllBW } from './bodyweight.js';
import { renderNLMeals, nlShowMeal, nlShowPicker, renderNLPicker, nlPickIngredient, nlCloseAmount, nlSetGrams, nlAdjustPickerGrams, nlConfirmAddIng, nlOpenCreateModal, nlCloseCreate, nlCreateMeal, openDeleteMealConfirm, closeDeleteMealConfirm, confirmDeleteMeal, nlToggleFav, nlDuplicateMeal, nlCopySummary, nlSetSort, nlToggleFavFilter, nlBrowseFoods, nlOpenCustomModal, nlCloseCustom, nlCustomPhotoSelected, nlSaveCustom, nlAdjustIng, nlRemoveIng, nlAutoSaveNotes, renderMacroGoals, openMacroGoalsModal, closeMacroGoalsModal, saveMacroGoalsFromModal, nlSetViewMode, nlLogSavedMeal } from './nutrition.js';
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
    setHeader('RSR Fitness 💪', false);
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
    setHeader('RSR Fitness 💪', false);
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
window.nlSetViewMode = nlSetViewMode;
window.nlLogSavedMeal = nlLogSavedMeal;

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
// Auth UI
// ═══════════════════════════════════════════

function showSignInScreen() {
  document.getElementById('signInOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}

function showLoadingScreen(msg) {
  document.getElementById('signInOverlay').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingMsg').textContent = msg || 'Loading…';
  document.getElementById('appRoot').style.display = 'none';
}

function showApp() {
  document.getElementById('signInOverlay').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('appRoot').style.display = '';
}

function updateUserUI(user) {
  const el = document.getElementById('burgerUserEmail');
  if (el) el.textContent = user ? user.email : '';
}

async function handleSignIn() {
  try {
    await signInWithGoogle();
  } catch (e) {
    alert('Sign-in failed. Please try again.');
  }
}

async function handleEmailSignIn() {
  const email = document.getElementById('siEmail').value.trim();
  const password = document.getElementById('siPassword').value;
  const errEl = document.getElementById('siError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    await signInWithEmail(email, password);
    // onAuthChange will fire — verified check happens there
  } catch (e) {
    errEl.textContent = _authError(e.code);
  }
}

async function handleEmailRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  const errEl = document.getElementById('regError');
  errEl.textContent = '';
  if (!name || !email || !password || !confirm) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  try {
    await registerWithEmail(name, email, password);
    showVerifyEmailScreen(email);
  } catch (e) {
    errEl.textContent = _authError(e.code);
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('siEmail').value.trim();
  const errEl = document.getElementById('siError');
  errEl.textContent = '';
  if (!email) { errEl.textContent = 'Enter your email above first.'; return; }
  try {
    await sendForgotPassword(email);
    errEl.style.color = '#2ecc71';
    errEl.textContent = 'Password reset email sent! Check your inbox.';
    setTimeout(() => { errEl.style.color = ''; errEl.textContent = ''; }, 5000);
  } catch (e) {
    errEl.textContent = _authError(e.code);
  }
}

function showVerifyEmailScreen(email) {
  document.getElementById('authPanelSignIn').style.display = 'none';
  document.getElementById('authPanelRegister').style.display = 'none';
  document.getElementById('authTabSignIn').classList.remove('auth-tab-active');
  document.getElementById('authTabRegister').classList.remove('auth-tab-active');
  document.getElementById('authPanelVerify').style.display = '';
  document.getElementById('verifyEmailAddr').textContent = email;
}

window.handleForgotPassword = handleForgotPassword;

function showAuthTab(tab) {
  document.getElementById('authTabSignIn').classList.toggle('auth-tab-active', tab === 'signin');
  document.getElementById('authTabRegister').classList.toggle('auth-tab-active', tab === 'register');
  document.getElementById('authPanelSignIn').style.display = tab === 'signin' ? '' : 'none';
  document.getElementById('authPanelRegister').style.display = tab === 'register' ? '' : 'none';
}

function _authError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

window.handleEmailSignIn = handleEmailSignIn;
window.handleEmailRegister = handleEmailRegister;
window.showAuthTab = showAuthTab;

function handleSignOut() {
  closeBurgerMenu();
  document.getElementById('signOutConfirm').style.display = 'flex';
}

async function confirmSignOut() {
  document.getElementById('signOutConfirm').style.display = 'none';
  await signOutUser();
  showSignInScreen();
}

function cancelSignOut() {
  document.getElementById('signOutConfirm').style.display = 'none';
}

window.confirmSignOut = confirmSignOut;
window.cancelSignOut = cancelSignOut;

window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════

function startApp() {
  applyStoredTheme();
  migrateOldExLogs();
  rebuildAllPRs();
  buildHome();
  initModalSwipe();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
  // Auto-reload when a new Service Worker takes over (new code deployed)
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

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
  } else {
    showSignInScreen();
  }
});
