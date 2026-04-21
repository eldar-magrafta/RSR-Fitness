// ── Cloud Sync (Firebase) ──
// Handles Google Auth, Email/Password Auth, and Firestore read/write.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, browserLocalPersistence, setPersistence,
  sendEmailVerification, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';
import { setCloudSaver, invalidateGoalDatesCache } from './store.js';

const SECTION_MAP = {
  plans:         'trainer_plans',
  bodyweight:    'trainer_bw',
  meals:         'trainer_meals',
  prs:           'trainer_prs',
  macrogoalsmap: 'trainer_macro_goals_map',
  customings:    'trainer_custom_ings',
};

let db, auth;
let _uid = null;
let _userEmail = null;

export function initFirebase() {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  // Keep user logged in forever across browser sessions
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  // Wire up cloud saving so store.js can sync without importing cloud.js
  setCloudSaver(cloudSave);
}

export function getUid() { return _uid; }
export function getUserEmail() { return _userEmail; }

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  await signOut(auth); // force sign-out until email is verified
}

export async function sendForgotPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function signInWithEmail(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  await signOut(auth);
  _uid = null;
  _userEmail = null;
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, user => {
    _uid = user ? user.uid : null;
    _userEmail = user ? user.email : null;
    callback(user);
  });
}

export async function loadFromCloud(uid) {
  await Promise.all(
    Object.entries(SECTION_MAP).map(async ([section, lsKey]) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'sections', section));
        if (snap.exists()) localStorage.setItem(lsKey, snap.data().value);
      } catch (e) { console.warn('[cloud] failed to load section', section, e.code); }
    })
  );
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'exhist'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_exhist_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) { console.warn('[cloud] failed to load exhist', e.code); }
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'notes'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_notes_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) { console.warn('[cloud] failed to load notes', e.code); }
  invalidateGoalDatesCache();
}

let _cloudError = false;

export function hasCloudError() { return _cloudError; }

export function cloudSave(section, docId, value) {
  if (!_uid || !db) return;
  setDoc(doc(db, 'users', _uid, section, docId), { value })
    .then(() => {
      if (_cloudError) { _cloudError = false; _updateSyncIndicator(); }
    })
    .catch(() => {
      if (!_cloudError) { _cloudError = true; _updateSyncIndicator(); }
    });
}

function _updateSyncIndicator() {
  const el = document.getElementById('cloudSyncStatus');
  if (!el) return;
  el.classList.toggle('error', _cloudError);
  el.title = _cloudError ? 'Cloud sync issue – changes saved locally' : 'Synced';
}

// ── Photo document helpers (each photo = its own Firestore doc) ──

export async function savePhotoDoc(collectionName, docId, base64) {
  if (!_uid || !db) return;
  try { await setDoc(doc(db, 'users', _uid, collectionName, docId), { value: base64 }); }
  catch { /* offline — will be synced via migration on next login */ }
}

export async function loadPhotoDoc(collectionName, docId) {
  if (!_uid || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', _uid, collectionName, docId));
    return snap.exists() ? snap.data().value : null;
  } catch { return null; }
}

export async function deletePhotoDoc(collectionName, docId) {
  if (!_uid || !db) return;
  try { await deleteDoc(doc(db, 'users', _uid, collectionName, docId)); }
  catch { /* ignore */ }
}

export async function loadAllPhotoDocs(collectionName) {
  if (!_uid || !db) return {};
  try {
    const snaps = await getDocs(collection(db, 'users', _uid, collectionName));
    const result = {};
    snaps.forEach(d => { result[d.id] = d.data().value; });
    return result;
  } catch { return {}; }
}
