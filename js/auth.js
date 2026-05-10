// ── Auth UI Module ──
// Sign-in screens, registration, email verification, sign-out confirmation.

import { signInWithGoogle, signOutUser, registerWithEmail, signInWithEmail, sendForgotPassword } from './cloud.js';

// ── Screen switching ──

export function showSignInScreen() {
  document.getElementById('signInOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}

const LOADING_TIPS = [
    'Consistency beats perfection.',
    'The only bad workout is the one you skipped.',
    'Small progress is still progress.',
    'Your body can stand almost anything. It\'s your mind you have to convince.',
    'Discipline is choosing between what you want now and what you want most.',
    'Results happen over time, not overnight.',
    'Sore today, strong tomorrow.',
    'Push yourself \u2014 no one else will do it for you.',
    'Every rep counts.',
    'Train insane or remain the same.',
    'Strength doesn\'t come from what you can do. It comes from overcoming what you thought you couldn\'t.',
    'The harder you work, the luckier you get.',
    'Fall in love with the process.',
    'You don\'t have to be extreme, just consistent.',
    'One more rep.',
    'Sweat now, shine later.',
    'Showing up is half the battle.',
    'Your only competition is who you were yesterday.',
    'Pain is temporary. Quitting lasts forever.',
    'Don\'t wish for it. Work for it.',
    'The body achieves what the mind believes.',
    'Stronger every day.',
    'Excuses don\'t burn calories.',
    'Make yourself proud.',
    'Tough times don\'t last. Tough people do.',
    'Earn it.',
    'Champions train. Losers complain.',
    'No pressure, no diamonds.',
    'The pain you feel today is the strength you feel tomorrow.',
    'Comfort is the enemy of progress.',
    'Doubt kills more dreams than failure ever will.',
    'Trust the process.',
    'Hard work beats talent when talent doesn\'t work hard.',
    'Don\'t count the days. Make the days count.',
    'A year from now, you\'ll wish you started today.',
    'The only way out is through.',
    'Strong is the new skinny.',
    'Done is better than perfect.',
    'Wake up. Work out. Repeat.',
    'Your future self is watching.',
    'Get comfortable being uncomfortable.',
    'The grind doesn\'t stop.',
    'Eat. Sleep. Lift. Repeat.',
    'Be stronger than your strongest excuse.',
    'Suffer the pain of discipline or the pain of regret.',
    'You don\'t find willpower. You create it.',
];

let _loadingInterval = null;

export function showLoadingScreen() {
  document.getElementById('signInOverlay').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
  const el = document.getElementById('loadingMsg');
  el.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  clearInterval(_loadingInterval);
  _loadingInterval = setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
      el.style.opacity = '1';
    }, 300);
  }, 2500);
}

export function showApp() {
  clearInterval(_loadingInterval);
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
