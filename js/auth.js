// ── Auth UI Module ──
// Sign-in screens, registration, email verification, sign-out confirmation.

import { signInWithGoogle, signOutUser, registerWithEmail, signInWithEmail, sendForgotPassword } from './cloud.js';

// ── Screen switching ──

export function showSignInScreen() {
  document.getElementById('signInOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}

export function showLoadingScreen(msg) {
  document.getElementById('signInOverlay').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingMsg').textContent = msg || 'Loading\u2026';
  document.getElementById('appRoot').style.display = 'none';
}

export function showApp() {
  document.getElementById('signInOverlay').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('appRoot').style.display = '';
}

export function updateUserUI(user) {
  const el = document.getElementById('burgerUserEmail');
  if (el) el.textContent = user ? user.email : '';
}

// ── Auth Handlers ──

export async function handleSignIn() {
  try {
    await signInWithGoogle();
  } catch (e) {
    alert('Sign-in failed. Please try again.');
  }
}

export async function handleEmailSignIn() {
  const email = document.getElementById('siEmail').value.trim();
  const password = document.getElementById('siPassword').value;
  const errEl = document.getElementById('siError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    await signInWithEmail(email, password);
  } catch (e) {
    errEl.textContent = _authError(e.code);
  }
}

export async function handleEmailRegister() {
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

export async function handleForgotPassword() {
  const email = document.getElementById('siEmail').value.trim();
  const errEl = document.getElementById('siError');
  errEl.textContent = '';
  if (!email) { errEl.textContent = 'Enter your email above first.'; return; }
  try {
    await sendForgotPassword(email);
    errEl.style.color = 'var(--green)';
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

export function showAuthTab(tab) {
  document.getElementById('authTabSignIn').classList.toggle('auth-tab-active', tab === 'signin');
  document.getElementById('authTabRegister').classList.toggle('auth-tab-active', tab === 'register');
  document.getElementById('authPanelSignIn').style.display = tab === 'signin' ? '' : 'none';
  document.getElementById('authPanelRegister').style.display = tab === 'register' ? '' : 'none';
}

export function handleSignOut(closeBurgerMenu) {
  closeBurgerMenu();
  document.getElementById('signOutConfirm').style.display = 'flex';
}

export async function confirmSignOut() {
  document.getElementById('signOutConfirm').style.display = 'none';
  await signOutUser();
  showSignInScreen();
}

export function cancelSignOut() {
  document.getElementById('signOutConfirm').style.display = 'none';
}

// ── Helpers ──

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
