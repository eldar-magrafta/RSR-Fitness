// ── Photo Storage Module ──
// Body weight photos are stored as individual Firestore documents (free tier).
// IndexedDB caches photos locally for offline use and reduced Firestore reads.

import { savePhotoDoc, deletePhotoDoc, loadPhotoDoc, loadAllPhotoDocs } from './cloud.js';
import { getBWData, saveBWData, bwGetPhoto, bwGetWeight, getNLMeals, saveNLMeals } from './store.js';

// ── Helpers ──

export function isBase64(str) { return typeof str === 'string' && str.startsWith('data:'); }

// ── IndexedDB photo cache ──

const DB_NAME = 'rsr-photos';
const STORE_NAME = 'photos';

let _idb = null;
function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => { _idb = req.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}

async function cachePhoto(key, base64) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(base64, key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch { /* IndexedDB unavailable — degrade silently */ }
}

async function getCachedPhoto(key) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise((res) => { req.onsuccess = () => res(req.result || null); req.onerror = () => res(null); });
  } catch { return null; }
}

async function removeCachedPhoto(key) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch { /* ignore */ }
}

// ── Photo CRUD (Firestore doc per photo + local IndexedDB cache) ──

export async function savePhoto(collection, docId, base64) {
  await cachePhoto(`${collection}/${docId}`, base64);
  await savePhotoDoc(collection, docId, base64);
}

export async function loadPhoto(collection, docId) {
  const cached = await getCachedPhoto(`${collection}/${docId}`);
  if (cached) return cached;
  const remote = await loadPhotoDoc(collection, docId);
  if (remote) await cachePhoto(`${collection}/${docId}`, remote);
  return remote;
}

export async function deletePhoto(collection, docId) {
  await removeCachedPhoto(`${collection}/${docId}`);
  await deletePhotoDoc(collection, docId);
}

// ── Migration: extract base64 BW photos from main doc → individual Firestore photo docs ──

export async function migratePhotosToStorage(uid) {
  if (!uid) return;

  let migrated = {};
  try { migrated = JSON.parse(localStorage.getItem('trainer_photos_migrated') || '{}'); } catch { migrated = {}; }

  let changed = false;
  const bwData = getBWData();

  for (const [dateStr, val] of Object.entries(bwData)) {
    const photo = bwGetPhoto(val);
    if (!photo || !isBase64(photo) || migrated['bw:' + dateStr]) continue;
    try {
      await savePhoto('bw-photos', dateStr, photo);
      bwData[dateStr] = { w: bwGetWeight(val), p: 'cloud' };
      migrated['bw:' + dateStr] = true;
      changed = true;
    } catch { /* leave as-is, retry next login */ }
  }

  if (changed) saveBWData(bwData);
  localStorage.setItem('trainer_photos_migrated', JSON.stringify(migrated));
}

// ── Preload: pull all photo docs into IndexedDB cache on login ──

export async function preloadPhotoCache() {
  try {
    const bwPhotos = await loadAllPhotoDocs('bw-photos');
    for (const [docId, base64] of Object.entries(bwPhotos)) {
      await cachePhoto(`bw-photos/${docId}`, base64);
    }
  } catch { /* offline — use whatever is already in cache */ }
  try {
    const mealPhotos = await loadAllPhotoDocs('meal-photos');
    for (const [docId, base64] of Object.entries(mealPhotos)) {
      await cachePhoto(`meal-photos/${docId}`, base64);
    }
  } catch { /* offline */ }
  try {
    const ingPhotos = await loadAllPhotoDocs('custom-ing-photos');
    for (const [docId, base64] of Object.entries(ingPhotos)) {
      await cachePhoto(`custom-ing-photos/${docId}`, base64);
    }
  } catch { /* offline */ }
}

// ── Migration: extract inline base64 meal/ingredient photos to separate Firestore docs ──

export async function migrateMealPhotosToStorage(uid) {
  if (!uid) return;

  let migrated = {};
  try { migrated = JSON.parse(localStorage.getItem('trainer_meal_photos_migrated') || '{}'); } catch { migrated = {}; }

  let changed = false;
  const meals = getNLMeals();

  for (const meal of meals) {
    if (meal.image && meal.image.startsWith('data:') && !migrated['meal:' + meal.id]) {
      try {
        await savePhoto('meal-photos', meal.id, meal.image);
        meal.image = 'cloud:' + meal.id;
        migrated['meal:' + meal.id] = true;
        changed = true;
      } catch { /* leave as-is, retry next login */ }
    }
  }

  if (changed) saveNLMeals(meals);
  localStorage.setItem('trainer_meal_photos_migrated', JSON.stringify(migrated));
}
