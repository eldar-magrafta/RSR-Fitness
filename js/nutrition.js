// ── Nutrition Lab Module ──
// Meals, ingredient picker, custom ingredients, macros.

import { NL_INGREDIENTS } from '../data/ingredients.js';
import { state } from './state.js';
import { getNLMeals, saveNLMeals, getCustomIngs, saveCustomIngs, getGoalsForDate, setGoalForDate, removeGoalEntry, DEFAULT_MACRO_GOALS } from './store.js';
import { showView, setHeader } from './navigation.js';
import { calcMealTotals, MONTHS, escHtml } from './utils.js';
import { savePhoto, loadPhoto, deletePhoto } from './storage.js';

function getAllIngs() { return [...NL_INGREDIENTS, ...getCustomIngs()]; }

function _isCloudMarker(img) { return typeof img === 'string' && img.startsWith('cloud:'); }
function _cloudDocId(img) { return img.slice(6); }

function _mealCardImg(m) {
  if (m.image && _isCloudMarker(m.image)) {
    return `<img class="nl-meal-card-img" data-cloud-src="meal-photos/${_cloudDocId(m.image)}" src="" alt="">`;
  } else if (m.image) {
    return `<img class="nl-meal-card-img" src="${m.image}" alt="">`;
  }
  return `<div class="nl-meal-card-placeholder"></div>`;
}

function _resolveCloudImages(container) {
  container.querySelectorAll('[data-cloud-src]').forEach(el => {
    const key = el.dataset.cloudSrc;
    const sep = key.indexOf('/');
    const col = key.slice(0, sep);
    const docId = key.slice(sep + 1);
    loadPhoto(col, docId).then(base64 => {
      if (base64) el.src = base64;
    });
  });
}

function nlCalcTotals(meal) {
  // Use cached totals if available, otherwise calculate and cache
  if (!meal._cachedTotals) {
    meal._cachedTotals = calcMealTotals(meal);
  }
  return meal._cachedTotals;
}

function nlInvalidateTotalsCache(meal) {
  delete meal._cachedTotals;
}

function nlRenderPie(p, c, f) {
  const pCal = p * 4, cCal = c * 4, fCal = f * 9, total = pCal + cCal + fCal;
  if (total === 0) return '<div class="nl-chart-empty">Add ingredients to see macro breakdown</div>';
  const pPct = pCal / total, cPct = cCal / total, fPct = fCal / total;
  const r = 55, circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = [{ pct: pPct, col: '#4ecdc4', lbl: 'Protein' }, { pct: cPct, col: '#ff6b6b', lbl: 'Carbs' }, { pct: fPct, col: '#ffd93d', lbl: 'Fat' }];
  let circles = '';
  segs.forEach(s => { if (s.pct > 0) { circles += `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${s.col}" stroke-width="22" stroke-dasharray="${s.pct * circ} ${circ}" stroke-dashoffset="${-offset * circ}"/>`; offset += s.pct; } });
  return `<svg class="nl-pie-svg" viewBox="0 0 140 140" width="130" height="130">${circles}</svg>
    <div class="nl-chart-legend">${segs.map(s => `<div><span style="color:${s.col};font-size:1.1rem;">●</span> ${s.lbl} <b>${Math.round(s.pct * 100)}%</b></div>`).join('')}</div>`;
}

// ── View Mode Toggle ──

export function nlSetViewMode(mode) {
  if (mode === 'today') {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    state.nlSelectedDate = todayStr;
    state.nlCalYear = now.getFullYear();
    state.nlCalMon = now.getMonth();
  }
  state.nlViewMode = mode;
  document.getElementById('nlViewToday').classList.toggle('active', mode === 'today');
  document.getElementById('nlViewSaved').classList.toggle('active', mode === 'saved');
  // Show/hide macro goals, calendar, and sort row based on mode
  const goalsSection = document.getElementById('macroGoalsSection');
  if (goalsSection) goalsSection.style.display = mode === 'today' ? '' : 'none';
  const calSection = document.getElementById('nlCalSection');
  if (calSection) calSection.style.display = mode === 'today' ? '' : 'none';
  const browseBtn = document.querySelector('.nl-browse-btn');
  if (browseBtn) browseBtn.style.display = mode === 'saved' ? '' : 'none';
  if (mode === 'today') renderNLCalendar();
  renderNLMeals();
  if (mode === 'today') renderMacroGoals();
}

// ── Meal List ──

export function renderNLMeals() {
  const list = document.getElementById('nlMealList');
  const today = new Date().toISOString().slice(0, 10);
  let meals = getNLMeals();

  // Filter by view mode
  if (state.nlViewMode === 'today') {
    const viewDate = state.nlSelectedDate || today;
    meals = meals.filter(m => (m.type || 'logged') === 'logged' && m.createdAt === viewDate);
  } else {
    meals = meals.filter(m => m.type === 'saved');
  }

  if (state.nlFavOnly) meals = meals.filter(m => m.favorite);
  meals.sort((a, b) => {
    if (state.nlSortBy === 'date') return (b.createdAt || '').localeCompare(a.createdAt || '');
    const ta = nlCalcTotals(a), tb = nlCalcTotals(b);
    if (state.nlSortBy === 'cals') return tb.cal - ta.cal;
    if (state.nlSortBy === 'protein') return tb.p - ta.p;
    return 0;
  });
  if (meals.length === 0) {
    const isToday = (state.nlSelectedDate || today) === today;
    let emptyMsg;
    if (state.nlViewMode === 'today') {
      emptyMsg = isToday
        ? 'No meals logged today.<br>Tap + to log a meal, or eat a saved meal.'
        : 'No meals logged on this date.';
    } else {
      emptyMsg = state.nlFavOnly ? 'No favorite meals yet.<br>Star a meal to see it here.' : 'No saved meals yet.<br>Tap + to create a reusable meal.';
    }
    list.innerHTML = `<div class="nl-empty"><div class="nl-empty-icon">${state.nlViewMode === 'today' ? '🍽️' : '📖'}</div><div class="nl-empty-text">${emptyMsg}</div></div>`;
    return;
  }
  list.innerHTML = meals.map(m => {
    const t = nlCalcTotals(m);
    const favBtn = m.type === 'saved' ? `<button class="nl-meal-fav" onclick="event.stopPropagation();nlToggleFav('${m.id}')">${m.favorite ? '★' : '☆'}</button>` : '';
    const cardImg = _mealCardImg(m);
    return `<div class="nl-meal-card nl-meal-has-img" onclick="nlShowMeal('${m.id}')">
      ${cardImg}<div class="nl-meal-card-body">
      <div class="nl-meal-top"><div class="nl-meal-name-row"><span class="nl-meal-name">${escHtml(m.name)}</span>${favBtn}</div>
        <button class="nl-meal-del" onclick="event.stopPropagation();openDeleteMealConfirm('${m.id}')" title="Delete meal">✕</button>
      </div>
      <div class="nl-meal-macros"><div>P: <b>${t.p}g</b></div><div>C: <b>${t.c}g</b></div><div>F: <b>${t.f}g</b></div></div>
      <div class="nl-meal-cals">🔥 ${t.cal} cal</div>
      </div></div>`;
  }).join('');
  _resolveCloudImages(list);
}

export function nlShowMeal(id) {
  state.nlCurrentMealId = id;
  renderNLMealDetail();
  showView('nlMealView');
  const meal = getNLMeals().find(m => m.id === id);
  setHeader(meal ? meal.name : 'Meal', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'nl-meal';
}

function renderNLMealDetail() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  const t = nlCalcTotals(meal);

  // Photo section
  const photoSection = document.getElementById('nlMealDetailPhoto');
  const isDefaultMeal = meal.id.startsWith('default_meal_');
  if (photoSection) {
    if (meal.type === 'saved' && meal.image) {
      const removeBtn = !isDefaultMeal
        ? `<button class="nl-detail-photo-remove" onclick="nlRemoveMealPhoto()">✕ Remove</button>`
        : '';
      if (_isCloudMarker(meal.image)) {
        photoSection.innerHTML = `<div class="nl-detail-photo-wrap">
          <img class="nl-detail-photo-img" data-cloud-src="meal-photos/${_cloudDocId(meal.image)}" src="" alt="" onclick="nlOpenMealPhotoViewer()">
          ${removeBtn}
        </div>`;
        _resolveCloudImages(photoSection);
      } else {
        photoSection.innerHTML = `<div class="nl-detail-photo-wrap">
          <img class="nl-detail-photo-img" src="${meal.image}" alt="" onclick="nlOpenMealPhotoViewer()">
          ${removeBtn}
        </div>`;
      }
    } else {
      photoSection.innerHTML = '';
    }
  }
  // Photo button label
  const photoBtn = document.getElementById('nlPhotoBtn');
  if (photoBtn) {
    if (meal.type === 'saved' && !isDefaultMeal) {
      photoBtn.style.display = '';
      photoBtn.textContent = meal.image ? '🖼️ Change Photo' : '📷 Add Photo';
    } else {
      photoBtn.style.display = 'none';
    }
  }

  document.getElementById('nlMealChart').innerHTML = `<div class="nl-chart-wrap">${nlRenderPie(t.p, t.c, t.f)}</div>`;
  document.getElementById('nlTotals').innerHTML = `
    <div class="nl-total-item"><div class="nl-total-val" style="color:var(--accent);">${t.cal}</div><div class="nl-total-label">Calories</div></div>
    <div class="nl-total-item"><div class="nl-total-val" style="color:#4ecdc4;">${t.p}g</div><div class="nl-total-label">Protein</div></div>
    <div class="nl-total-item"><div class="nl-total-val" style="color:#ff6b6b;">${t.c}g</div><div class="nl-total-label">Carbs</div></div>
    <div class="nl-total-item"><div class="nl-total-val" style="color:#ffd93d;">${t.f}g</div><div class="nl-total-label">Fat</div></div>`;
  const ingList = document.getElementById('nlIngList');
  if (!meal.ingredients || meal.ingredients.length === 0) {
    ingList.innerHTML = '<div class="nl-chart-empty">No ingredients added yet.</div>';
  } else {
    ingList.innerHTML = meal.ingredients.map((ing, idx) => {
      const m = ing.grams / 100;
      const imgHtml = ing.img
        ? (_isCloudMarker(ing.img)
          ? `<img class="nl-ing-img" data-cloud-src="custom-ing-photos/${_cloudDocId(ing.img)}" src="" alt="">`
          : `<img class="nl-ing-img" src="${ing.img}">`)
        : `<div class="nl-ing-initial">${escHtml(ing.name[0])}</div>`;
      return `<div class="nl-ing-card">
        <div class="nl-ing-top">${imgHtml}<div class="nl-ing-name">${escHtml(ing.name)}</div><button class="nl-ing-remove" onclick="nlRemoveIng(${idx})">✕</button></div>
        <div class="nl-ing-controls">
          <button class="nl-ing-btn" onclick="nlAdjustIng(${idx},-10)">−</button>
          <div class="nl-ing-grams">${ing.grams}g</div>
          <button class="nl-ing-btn" onclick="nlAdjustIng(${idx},10)">+</button>
        </div>
        <div class="nl-ing-macros">
          <div>P: <span>${(ing.p * m).toFixed(1)}g</span></div>
          <div>C: <span>${(ing.c * m).toFixed(1)}g</span></div>
          <div>F: <span>${(ing.f * m).toFixed(1)}g</span></div>
          <div>🔥 <span>${Math.round(ing.cal * m)}</span></div>
        </div></div>`;
    }).join('');
    _resolveCloudImages(ingList);
  }
  document.getElementById('nlNotes').value = meal.notes || '';
  const counter = document.getElementById('nlNotesCount');
  if (counter) counter.textContent = meal.notes ? `${meal.notes.length} / 500` : '';
}

export function nlAdjustIng(idx, delta) {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal || !meal.ingredients[idx]) return;
  meal.ingredients[idx].grams = Math.max(10, meal.ingredients[idx].grams + delta);
  nlInvalidateTotalsCache(meal);
  saveNLMeals(meals); renderNLMealDetail(); renderMacroGoals();
}

export function nlRemoveIng(idx) {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  meal.ingredients.splice(idx, 1);
  nlInvalidateTotalsCache(meal);
  saveNLMeals(meals); renderNLMealDetail(); renderMacroGoals();
}

export function nlAutoSaveNotes() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  meal.notes = document.getElementById('nlNotes').value.slice(0, 500);
  saveNLMeals(meals);
  const counter = document.getElementById('nlNotesCount');
  if (counter) counter.textContent = `${meal.notes.length} / 500`;
}

export function nlBrowseFoods() {
  state.nlBrowseMode = true;
  showView('nlPickerView');
  setHeader('All Foods', true);
  document.getElementById('nlSearchInput').value = '';
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'nl-browse';
  renderNLPicker();
}

// ── Ingredient Picker ──

export function nlShowPicker() {
  state.nlBrowseMode = false;
  showView('nlPickerView');
  setHeader('Add Ingredient', true);
  document.getElementById('nlSearchInput').value = '';
  state.navContext = 'nl-picker';
  renderNLPicker();
}

export function renderNLPicker() {
  const filter = (document.getElementById('nlSearchInput').value || '').toLowerCase();
  const all = getAllIngs();
  const filtered = filter ? all.filter(i => i.name.toLowerCase().includes(filter)) : all;
  const cats = ['protein', 'dairy', 'carbs', 'fats', 'vegetables', 'other', 'custom'];
  const catNames = { protein: 'Protein', dairy: 'Dairy', carbs: 'Carbs', fats: 'Fats', vegetables: 'Vegetables', other: 'Other', custom: 'Custom' };
  let html = '';
  cats.forEach(cat => {
    const items = filtered.filter(i => i.cat === cat);
    if (items.length === 0) return;
    html += `<div class="nl-cat-label">${catNames[cat]}</div>`;
    items.forEach(ing => {
      const safeName = escHtml(ing.name);
      const imgHtml = ing.img
        ? (_isCloudMarker(ing.img)
          ? `<img class="nl-pick-img" data-cloud-src="custom-ing-photos/${_cloudDocId(ing.img)}" src="" alt="">`
          : `<img class="nl-pick-img" src="${ing.img}">`)
        : `<div class="nl-pick-initial">${escHtml(ing.name[0])}</div>`;
      const isCustom = cat === 'custom';
      const customIdx = isCustom ? getCustomIngs().findIndex(c => c.name === ing.name) : -1;
      const delBtn = isCustom && customIdx >= 0
        ? `<button class="plan-ex-remove" onclick="event.stopPropagation();nlDeleteCustomConfirm(${customIdx})" title="Delete">✕</button>`
        : '';
      html += `<div class="nl-pick-item" onclick="nlPickIngredient(this.dataset.name)" data-name="${safeName}">
        ${imgHtml}
        <div style="flex:1;"><div class="nl-pick-name">${safeName}</div><div class="nl-pick-sub">P:${ing.p}g C:${ing.c}g F:${ing.f}g | ${ing.cal} cal /100g</div></div>
        ${delBtn}<span class="arrow">›</span></div>`;
    });
  });
  const pickerList = document.getElementById('nlPickerList');
  pickerList.innerHTML = html || '<div class="nl-chart-empty">No ingredients found.</div>';
  _resolveCloudImages(pickerList);
}

export function nlPickIngredient(name) {
  const ing = getAllIngs().find(i => i.name === name);
  if (!ing) return;
  state.nlPickerIng = ing;
  state.nlPickerGrams = 100;
  const imgHtml = ing.img
    ? (_isCloudMarker(ing.img)
      ? `<img class="nl-amount-img" data-cloud-src="custom-ing-photos/${_cloudDocId(ing.img)}" src="" alt="">`
      : `<img class="nl-amount-img" src="${ing.img}">`)
    : `<div class="nl-amount-initial">${escHtml(ing.name[0])}</div>`;
  const header = document.getElementById('nlAmountHeader');
  header.innerHTML = `${imgHtml}<div><div class="nl-amount-title">${escHtml(ing.name)}</div><div class="nl-amount-sub">${ing.cal} cal per 100g</div></div>`;
  _resolveCloudImages(header);
  document.getElementById('nlGramDisplay').textContent = '100g';
  document.getElementById('nlAddToMealBtn').style.display = state.nlBrowseMode ? 'none' : '';
  // Show edit button only for custom ingredients
  const editBtn = document.getElementById('nlAmountEditBtn');
  if (editBtn) {
    const customIdx = ing.cat === 'custom' ? getCustomIngs().findIndex(c => c.name === ing.name) : -1;
    if (customIdx >= 0) {
      editBtn.style.display = '';
      editBtn.onclick = () => { nlCloseAmount(); nlOpenCustomModal(customIdx); };
    } else {
      editBtn.style.display = 'none';
    }
  }
  nlUpdateAmountPreview();
  document.getElementById('nlAmountOverlay').classList.add('open');
  setTimeout(() => document.getElementById('nlAmountSheet').style.transform = 'translateY(0)', 10);
}

export function nlCloseAmount() {
  document.getElementById('nlAmountSheet').style.transform = '';
  document.getElementById('nlAmountOverlay').classList.remove('open');
}

export function nlSetGrams(g) {
  state.nlPickerGrams = g;
  document.getElementById('nlGramDisplay').textContent = g + 'g';
  nlUpdateAmountPreview();
}

export function nlAdjustPickerGrams(delta) {
  state.nlPickerGrams = Math.max(10, state.nlPickerGrams + delta);
  document.getElementById('nlGramDisplay').textContent = state.nlPickerGrams + 'g';
  nlUpdateAmountPreview();
}

function nlUpdateAmountPreview() {
  if (!state.nlPickerIng) return;
  const m = state.nlPickerGrams / 100;
  document.getElementById('nlAmountPreview').innerHTML = `
    <div><span class="val">${(state.nlPickerIng.p * m).toFixed(1)}g</span><span class="lbl">Protein</span></div>
    <div><span class="val">${(state.nlPickerIng.c * m).toFixed(1)}g</span><span class="lbl">Carbs</span></div>
    <div><span class="val">${(state.nlPickerIng.f * m).toFixed(1)}g</span><span class="lbl">Fat</span></div>
    <div><span class="val">${Math.round(state.nlPickerIng.cal * m)}</span><span class="lbl">Calories</span></div>`;
}

export function nlConfirmAddIng() {
  if (!state.nlPickerIng || !state.nlCurrentMealId) return;
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  const ingData = { name: state.nlPickerIng.name, grams: state.nlPickerGrams, p: state.nlPickerIng.p, c: state.nlPickerIng.c, f: state.nlPickerIng.f, cal: state.nlPickerIng.cal, cat: state.nlPickerIng.cat };
  if (state.nlPickerIng.img) ingData.img = state.nlPickerIng.img;
  meal.ingredients.push(ingData);
  nlInvalidateTotalsCache(meal);
  saveNLMeals(meals);
  nlCloseAmount();
  state.nlPickerIng = null;
  renderNLMealDetail();
  renderMacroGoals();
  showView('nlMealView');
  const updated = getNLMeals().find(m => m.id === state.nlCurrentMealId);
  setHeader(updated ? updated.name : 'Meal', true);
  state.navContext = 'nl-meal';
}

// ── Create/Delete Meal ──

export function nlOpenCreateModal() {
  document.getElementById('nlMealNameInput').value = '';
  document.getElementById('nlCreateOverlay').classList.add('open');
  setTimeout(() => document.getElementById('nlMealNameInput').focus(), 300);
}
export function nlCloseCreate() { document.getElementById('nlCreateOverlay').classList.remove('open'); }

export function nlCreateMeal() {
  const name = document.getElementById('nlMealNameInput').value.trim().slice(0, 100);
  if (!name) return;
  const type = state.nlViewMode === 'saved' ? 'saved' : 'logged';
  const date = type === 'logged' ? (state.nlSelectedDate || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
  const meal = { id: 'meal_' + Date.now(), name, type, ingredients: [], notes: '', favorite: false, createdAt: date };
  const meals = getNLMeals(); meals.push(meal); saveNLMeals(meals);
  nlCloseCreate(); nlShowMeal(meal.id);
}

export function openDeleteMealConfirm(mealId) {
  const meal = getNLMeals().find(m => m.id === mealId);
  if (!meal) return;
  state._pendingDeleteMealId = mealId;
  document.getElementById('deleteMealConfirmMsg').textContent =
    `Delete "${meal.name}"? This cannot be undone.`;
  document.getElementById('deleteMealConfirmOverlay').classList.add('open');
}

export function closeDeleteMealConfirm() {
  document.getElementById('deleteMealConfirmOverlay').classList.remove('open');
  state._pendingDeleteMealId = null;
}

export function confirmDeleteMeal() {
  if (!state._pendingDeleteMealId) return;
  const meal = getNLMeals().find(m => m.id === state._pendingDeleteMealId);
  if (meal && meal.image && _isCloudMarker(meal.image)) {
    deletePhoto('meal-photos', _cloudDocId(meal.image));
  }
  saveNLMeals(getNLMeals().filter(m => m.id !== state._pendingDeleteMealId));
  closeDeleteMealConfirm();
  renderNLCalendar();
  renderNLMeals();
  renderMacroGoals();
}

export function nlOpenRenameModal() {
  const meal = getNLMeals().find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  document.getElementById('nlRenameInput').value = meal.name;
  document.getElementById('nlRenameOverlay').classList.add('open');
  setTimeout(() => { document.getElementById('nlRenameInput').focus(); document.getElementById('nlRenameInput').select(); }, 300);
}

export function nlCloseRename() {
  document.getElementById('nlRenameOverlay').classList.remove('open');
}

export function nlSaveRename() {
  const name = document.getElementById('nlRenameInput').value.trim().slice(0, 100);
  if (!name) return;
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  meal.name = name;
  saveNLMeals(meals);
  nlCloseRename();
  setHeader(name, true);
  renderNLMeals();
}

export function nlToggleFav(id) {
  const meals = getNLMeals(), meal = meals.find(m => m.id === id);
  if (!meal) return;
  meal.favorite = !meal.favorite; saveNLMeals(meals); renderNLMeals();
}

export function nlDuplicateMeal() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  const dup = { id: 'meal_' + Date.now(), name: meal.name + ' (copy)', type: meal.type || 'logged', ingredients: meal.ingredients.map(i => ({ ...i })), notes: meal.notes, favorite: false, createdAt: new Date().toISOString().slice(0, 10) };
  if (meal.image) dup.image = meal.image;
  meals.push(dup); saveNLMeals(meals); nlShowMeal(dup.id);
}

export function nlCopySummary() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  const t = nlCalcTotals(meal);
  let text = meal.name + '\n\n';
  (meal.ingredients || []).forEach(i => { const m = i.grams / 100; text += `• ${i.name} — ${i.grams}g (P:${(i.p * m).toFixed(1)}g C:${(i.c * m).toFixed(1)}g F:${(i.f * m).toFixed(1)}g ${Math.round(i.cal * m)}cal)\n`; });
  text += `\nTotals: ${t.cal} cal | P:${t.p}g | C:${t.c}g | F:${t.f}g`;
  if (meal.notes) text += '\n\nNotes: ' + meal.notes;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('nlCopyBtn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Summary'; }, 1500); }
  }).catch(() => { });
}

export async function nlUploadMealPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const MAX = 600; let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL('image/jpeg', 0.75);
      const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
      if (!meal) return;
      const docId = meal.id;
      try {
        await savePhoto('meal-photos', docId, b64);
        meal.image = 'cloud:' + docId;
      } catch {
        meal.image = b64;
      }
      saveNLMeals(meals);
      renderNLMealDetail();
      renderNLMeals();
      input.value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

export function nlRemoveMealPhoto() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal) return;
  if (meal.image && _isCloudMarker(meal.image)) {
    deletePhoto('meal-photos', _cloudDocId(meal.image));
  }
  delete meal.image;
  saveNLMeals(meals);
  renderNLMealDetail();
  renderNLMeals();
}

export function nlOpenMealPhotoViewer() {
  const meals = getNLMeals(), meal = meals.find(m => m.id === state.nlCurrentMealId);
  if (!meal?.image) return;
  if (_isCloudMarker(meal.image)) {
    loadPhoto('meal-photos', _cloudDocId(meal.image)).then(base64 => {
      if (base64) {
        document.getElementById('nlMealPhotoViewerImg').src = base64;
        document.getElementById('nlMealPhotoViewer').classList.add('open');
      }
    });
  } else {
    document.getElementById('nlMealPhotoViewerImg').src = meal.image;
    document.getElementById('nlMealPhotoViewer').classList.add('open');
  }
}

export function nlCloseMealPhotoViewer() {
  document.getElementById('nlMealPhotoViewer').classList.remove('open');
}

export function nlSetSort(by, btn) {
  state.nlSortBy = by;
  document.querySelectorAll('.nl-sort-btn:not(.nl-fav-btn)').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); renderNLMeals();
}

export function nlToggleFavFilter(btn) {
  state.nlFavOnly = !state.nlFavOnly;
  btn.classList.toggle('active', state.nlFavOnly);
  renderNLMeals();
}

// ── Custom Ingredients ──

export function nlOpenCustomModal(editIdx) {
  state._editingCustomIdx = typeof editIdx === 'number' ? editIdx : null;
  const isEdit = state._editingCustomIdx !== null;
  const customs = isEdit ? getCustomIngs() : [];
  const ing = isEdit ? customs[state._editingCustomIdx] : null;

  document.getElementById('nlCustomName').value = ing ? ing.name : '';
  document.getElementById('nlCustomP').value = ing ? ing.p : '';
  document.getElementById('nlCustomC').value = ing ? ing.c : '';
  document.getElementById('nlCustomF').value = ing ? ing.f : '';
  nlUpdateCustomCal();
  state.nlCustomPhotoBase64 = null;
  document.getElementById('nlCustomPhotoInput').value = '';

  if (ing && ing.img) {
    const preview = document.getElementById('nlCustomPhotoPreview');
    const thumbSrc = _isCloudMarker(ing.img) ? '' : ing.img;
    const cloudAttr = _isCloudMarker(ing.img) ? ` data-cloud-src="custom-ing-photos/${_cloudDocId(ing.img)}"` : '';
    preview.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img class="nl-custom-thumb" src="${thumbSrc}"${cloudAttr} onclick="nlViewCustomPhoto(this)">
        <button class="nl-custom-photo-btn" style="flex:1;" onclick="document.getElementById('nlCustomPhotoInput').click()">Change Photo</button>
      </div>`;
    _resolveCloudImages(preview);
  } else {
    document.getElementById('nlCustomPhotoPreview').innerHTML = '<button class="nl-custom-photo-btn" onclick="document.getElementById(\'nlCustomPhotoInput\').click()">📷 Add Photo (optional)</button>';
  }

  document.getElementById('nlCustomModalTitle').textContent = isEdit ? 'Edit Ingredient' : 'Custom Ingredient';
  document.getElementById('nlCustomSaveBtn').textContent = 'Save Ingredient';

  document.getElementById('nlCustomOverlay').classList.add('open');
  setTimeout(() => document.getElementById('nlCustomName').focus(), 300);
}
export function nlCloseCustom() {
  document.getElementById('nlCustomOverlay').classList.remove('open');
  state._editingCustomIdx = null;
}

export function nlCustomPhotoSelected(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 300; let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } } else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      state.nlCustomPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('nlCustomPhotoPreview').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <img class="nl-custom-thumb" src="${state.nlCustomPhotoBase64}" onclick="nlViewCustomPhoto(this)">
          <button class="nl-custom-photo-btn" style="flex:1;" onclick="document.getElementById('nlCustomPhotoInput').click()">Change Photo</button>
        </div>`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

export function nlViewCustomPhoto(imgEl) {
  const src = imgEl.src;
  const cloudKey = imgEl.dataset.cloudSrc;
  if (src) {
    document.getElementById('bwViewerImg').src = src;
    document.getElementById('bwViewer').classList.add('open');
  } else if (cloudKey) {
    const sep = cloudKey.indexOf('/');
    loadPhoto(cloudKey.slice(0, sep), cloudKey.slice(sep + 1)).then(base64 => {
      if (!base64) return;
      document.getElementById('bwViewerImg').src = base64;
      document.getElementById('bwViewer').classList.add('open');
    });
  }
}

export function nlUpdateCustomCal() {
  const p = parseFloat(document.getElementById('nlCustomP').value) || 0;
  const c = parseFloat(document.getElementById('nlCustomC').value) || 0;
  const f = parseFloat(document.getElementById('nlCustomF').value) || 0;
  document.getElementById('nlCustomCal').value = Math.round(p * 4 + c * 4 + f * 9);
}

export async function nlSaveCustom() {
  const name = document.getElementById('nlCustomName').value.trim();
  const p = parseFloat(document.getElementById('nlCustomP').value) || 0;
  const c = parseFloat(document.getElementById('nlCustomC').value) || 0;
  const f = parseFloat(document.getElementById('nlCustomF').value) || 0;
  const cal = Math.round(p * 4 + c * 4 + f * 9);
  if (!name) return;

  const customs = getCustomIngs();
  const isEdit = state._editingCustomIdx !== null && state._editingCustomIdx < customs.length;
  const ingData = isEdit ? customs[state._editingCustomIdx] : { name, cat: 'custom', p, c, f, cal };

  if (isEdit) {
    const oldName = ingData.name;
    ingData.name = name;
    ingData.p = p;
    ingData.c = c;
    ingData.f = f;
    ingData.cal = cal;
    // Update name in all meals that use this ingredient
    if (oldName !== name) {
      const meals = getNLMeals();
      let mealsChanged = false;
      meals.forEach(m => {
        (m.ingredients || []).forEach(i => {
          if (i.name === oldName && i.cat === 'custom') { i.name = name; mealsChanged = true; }
        });
      });
      if (mealsChanged) saveNLMeals(meals);
    }
  }

  if (state.nlCustomPhotoBase64) {
    const docId = 'cing_' + Date.now();
    try {
      await savePhoto('custom-ing-photos', docId, state.nlCustomPhotoBase64);
      ingData.img = 'cloud:' + docId;
    } catch {
      ingData.img = state.nlCustomPhotoBase64;
    }
  }

  if (!isEdit) customs.push(ingData);
  saveCustomIngs(customs); nlCloseCustom(); renderNLPicker();
}

export function nlDeleteCustomConfirm(idx) {
  const customs = getCustomIngs();
  if (idx < 0 || idx >= customs.length) return;
  state._pendingDeleteCustomIdx = idx;
  document.getElementById('deleteCustomConfirmMsg').textContent =
    `Delete "${customs[idx].name}"? This cannot be undone.`;
  document.getElementById('deleteCustomConfirmOverlay').classList.add('open');
}

export function closeDeleteCustomConfirm() {
  document.getElementById('deleteCustomConfirmOverlay').classList.remove('open');
  state._pendingDeleteCustomIdx = null;
}

export function confirmDeleteCustom() {
  if (state._pendingDeleteCustomIdx === null) return;
  const customs = getCustomIngs();
  customs.splice(state._pendingDeleteCustomIdx, 1);
  saveCustomIngs(customs);
  closeDeleteCustomConfirm();
  renderNLPicker();
}

// ── Macro Goals ──

function nlCalcDailyTotals() {
  const date = state.nlSelectedDate || new Date().toISOString().slice(0, 10);
  const meals = getNLMeals().filter(m => (m.type || 'logged') === 'logged' && m.createdAt === date);
  let p = 0, c = 0, f = 0, cal = 0;
  meals.forEach(m => { const t = nlCalcTotals(m); p += t.p; c += t.c; f += t.f; cal += t.cal; });
  return { p: Math.round(p * 10) / 10, c: Math.round(c * 10) / 10, f: Math.round(f * 10) / 10, cal: Math.round(cal) };
}

export function renderMacroGoals() {
  const section = document.getElementById('macroGoalsSection');
  if (!section) return;
  const today = new Date().toISOString().slice(0, 10);
  const viewDate = state.nlSelectedDate || today;
  const isToday = viewDate === today;

  const isPast = viewDate < today;
  const canEdit = !isPast; // today + future only
  const goals = getGoalsForDate(viewDate);

  // null = explicitly deleted goal for this date
  if (goals === null) {
    const actions = canEdit
      ? `<button class="macro-goals-edit" onclick="resumeDateGoal()">Resume Tracking</button>
         <span style="margin:0 8px;color:var(--muted);">|</span>
         <button class="macro-goals-edit" onclick="openMacroGoalsModal()">Set New Goal</button>`
      : '';
    section.innerHTML = `<div class="macro-goals-wrap" style="text-align:center;padding:18px;">
      <div style="color:var(--muted);font-size:0.85rem;margin-bottom:10px;">Goals cleared for this day</div>
      ${actions}
    </div>`;
    return;
  }

  if (!goals) {
    if (canEdit) {
      section.innerHTML = `<button class="macro-set-btn" onclick="openMacroGoalsModal()">Set Daily Calorie & Macro Goals</button>`;
    } else {
      section.innerHTML = `<div class="macro-goals-wrap" style="text-align:center;color:var(--muted);font-size:0.85rem;padding:18px;">No goals were set for this date.</div>`;
    }
    return;
  }

  const daily = nlCalcDailyTotals();
  const rows = [
    { name: 'Calories', cur: daily.cal, goal: goals.calories, color: '#FF0000', unit: '' },
    { name: 'Protein', cur: daily.p, goal: goals.protein, color: '#4ecdc4', unit: 'g' },
    { name: 'Carbs', cur: daily.c, goal: goals.carbs, color: '#ff6b6b', unit: 'g' },
    { name: 'Fat', cur: daily.f, goal: goals.fat, color: '#ffd93d', unit: 'g' },
  ];
  const d = new Date(viewDate + 'T00:00:00');
  const dateLabel = isToday ? "Today's Goals" : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  section.innerHTML = `<div class="macro-goals-wrap">
    <div class="macro-goals-header">
      <span class="macro-goals-title">${dateLabel}</span>
      ${canEdit ? '<button class="macro-goals-edit" onclick="openMacroGoalsModal()">Edit</button>' : ''}
    </div>
    ${rows.map(r => {
      const pct = r.goal > 0 ? Math.min(100, Math.round(r.cur / r.goal * 100)) : 0;
      return `<div class="macro-goal-row">
        <div class="macro-goal-label">
          <span class="macro-goal-name" style="color:${r.color}">${r.name}</span>
          <span class="macro-goal-nums">${r.cur}${r.unit} / ${r.goal}${r.unit}</span>
        </div>
        <div class="macro-goal-bar">
          <div class="macro-goal-fill" style="width:${pct}%;background:${r.color};"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Macro Slider State ──

let _pPct = 30, _cPct = 40; // fatPct = 100 - _pPct - _cPct
let _dragHandle = null;
let _sliderInited = false;

function _updateMacroSliderUI() {
  const fPct = 100 - _pPct - _cPct;
  document.getElementById('macroSegP').style.flexBasis = _pPct + '%';
  document.getElementById('macroSegC').style.flexBasis = _cPct + '%';
  document.getElementById('macroSegF').style.flexBasis = fPct + '%';
  document.getElementById('macroHandlePC').style.left = _pPct + '%';
  document.getElementById('macroHandleCF').style.left = (_pPct + _cPct) + '%';

  const cal = parseInt(document.getElementById('goalCalInput').value) || 0;
  const pG = cal > 0 ? Math.round((cal * _pPct / 100) / 4) : 0;
  const cG = cal > 0 ? Math.round((cal * _cPct / 100) / 4) : 0;
  const fG = cal > 0 ? Math.round((cal * fPct / 100) / 9) : 0;

  document.getElementById('macroPctP').textContent = _pPct + '%';
  document.getElementById('macroPctC').textContent = _cPct + '%';
  document.getElementById('macroPctF').textContent = fPct + '%';
  document.getElementById('macroGramsP').textContent = pG + 'g';
  document.getElementById('macroGramsC').textContent = cG + 'g';
  document.getElementById('macroGramsF').textContent = fG + 'g';
}

function _initMacroSliderDrag() {
  if (_sliderInited) return;
  _sliderInited = true;
  const bar = document.getElementById('macroSliderBar');
  const hPC = document.getElementById('macroHandlePC');
  const hCF = document.getElementById('macroHandleCF');

  function start(handle) {
    return (e) => { e.preventDefault(); _dragHandle = handle; };
  }
  hPC.addEventListener('touchstart', start('pc'), { passive: false });
  hPC.addEventListener('mousedown', start('pc'));
  hCF.addEventListener('touchstart', start('cf'), { passive: false });
  hCF.addEventListener('mousedown', start('cf'));

  function onMove(clientX) {
    if (!_dragHandle) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.round(((clientX - rect.left) / rect.width) * 100);
    const h2 = _pPct + _cPct;
    if (_dragHandle === 'pc') {
      _pPct = Math.max(5, Math.min(pct, h2 - 5));
      _cPct = h2 - _pPct;
    } else {
      const newH2 = Math.max(_pPct + 5, Math.min(pct, 95));
      _cPct = newH2 - _pPct;
    }
    _updateMacroSliderUI();
  }

  document.addEventListener('touchmove', e => { if (_dragHandle) { e.preventDefault(); onMove(e.touches[0].clientX); } }, { passive: false });
  document.addEventListener('mousemove', e => { if (_dragHandle) onMove(e.clientX); });
  document.addEventListener('touchend', () => { _dragHandle = null; });
  document.addEventListener('mouseup', () => { _dragHandle = null; });
}

export function onMacroCalInput() { _updateMacroSliderUI(); }

export function setQuickCal(val) {
  document.getElementById('goalCalInput').value = val;
  _updateMacroSliderUI();
}

export function openMacroGoalsModal() {
  const viewDate = state.nlSelectedDate || new Date().toISOString().slice(0, 10);
  // Get existing goals for this date (inherit/default), but treat null (cleared) as no existing goal
  let goals = getGoalsForDate(viewDate);
  if (goals && goals.calories > 0) {
    document.getElementById('goalCalInput').value = goals.calories;
    const pCal = (goals.protein || 0) * 4;
    const cCal = (goals.carbs || 0) * 4;
    const fCal = (goals.fat || 0) * 9;
    const total = pCal + cCal + fCal;
    if (total > 0) {
      _pPct = Math.round(pCal / total * 100);
      _cPct = Math.round(cCal / total * 100);
      if (100 - _pPct - _cPct < 5) _cPct = 95 - _pPct;
      if (_pPct < 5) _pPct = 5;
      if (_cPct < 5) _cPct = 5;
    } else {
      _pPct = 40; _cPct = 30;
    }
  } else {
    // Default: 2700 cal, 40% protein / 30% carbs / 30% fat
    document.getElementById('goalCalInput').value = DEFAULT_MACRO_GOALS.calories;
    _pPct = 40; _cPct = 30;
  }
  _updateMacroSliderUI();
  _initMacroSliderDrag();
  // Show clear button only if a real goal exists (not null/default)
  const clearBtn = document.getElementById('macroClearBtn');
  if (clearBtn) clearBtn.style.display = (goals && goals !== DEFAULT_MACRO_GOALS) ? '' : 'none';
  document.getElementById('macroGoalsOverlay').classList.add('open');
}

export function closeMacroGoalsModal() {
  document.getElementById('macroGoalsOverlay').classList.remove('open');
}

export function saveMacroGoalsFromModal() {
  const cal = parseInt(document.getElementById('goalCalInput').value) || 0;
  if (!cal) return;

  // Normalize percentages to ensure they sum to 100%
  const total = _pPct + _cPct;
  let normalizedP = _pPct;
  let normalizedC = _cPct;
  let normalizedF = 100 - total;

  // If total exceeds 100%, proportionally scale down protein and carbs
  if (total > 100) {
    const scale = 100 / total;
    normalizedP = Math.round(_pPct * scale);
    normalizedC = Math.round(_cPct * scale);
    normalizedF = 100 - normalizedP - normalizedC;
  }

  const protein = Math.round((cal * normalizedP / 100) / 4);
  const carbs = Math.round((cal * normalizedC / 100) / 4);
  const fat = Math.round((cal * normalizedF / 100) / 9);
  const goals = { calories: cal, protein, carbs, fat };

  const viewDate = state.nlSelectedDate || new Date().toISOString().slice(0, 10);
  setGoalForDate(viewDate, goals);

  closeMacroGoalsModal();
  renderMacroGoals();
}

export function clearDateGoal() {
  const viewDate = state.nlSelectedDate || new Date().toISOString().slice(0, 10);
  setGoalForDate(viewDate, null);
  closeMacroGoalsModal();
  renderMacroGoals();
}

export function resumeDateGoal() {
  const viewDate = state.nlSelectedDate || new Date().toISOString().slice(0, 10);
  removeGoalEntry(viewDate);
  renderMacroGoals();
}

// ── FAB Choice + Saved Meal Picker ──

export function openNLFabChoice() {
  document.getElementById('nlFabChoiceOverlay').classList.add('open');
}

export function closeNLFabChoice() {
  document.getElementById('nlFabChoiceOverlay').classList.remove('open');
}

export function openSavedMealPicker() {
  const meals = getNLMeals().filter(m => m.type === 'saved');
  const list = document.getElementById('nlSavedPickerList');
  if (meals.length === 0) {
    list.innerHTML = '<div class="nl-empty" style="padding:30px;"><div class="nl-empty-text">No saved meals yet.<br>Create a saved meal first.</div></div>';
  } else {
    list.innerHTML = meals.map(m => {
      const t = nlCalcTotals(m);
      const cardImg = _mealCardImg(m);
      return `<div class="nl-meal-card nl-meal-has-img" onclick="pickSavedMeal('${m.id}')">
        ${cardImg}<div class="nl-meal-card-body">
        <div class="nl-meal-top"><div class="nl-meal-name-row"><span class="nl-meal-name">${escHtml(m.name)}</span></div></div>
        <div class="nl-meal-macros"><div>P: <b>${t.p}g</b></div><div>C: <b>${t.c}g</b></div><div>F: <b>${t.f}g</b></div></div>
        <div class="nl-meal-cals">🔥 ${t.cal} cal</div>
        </div></div>`;
    }).join('');
    _resolveCloudImages(list);
  }
  document.getElementById('nlSavedPickerOverlay').classList.add('open');
  setTimeout(() => document.getElementById('nlSavedPickerSheet').style.transform = 'translateY(0)', 10);
}

export function closeSavedMealPicker() {
  document.getElementById('nlSavedPickerSheet').style.transform = '';
  document.getElementById('nlSavedPickerOverlay').classList.remove('open');
}

export function pickSavedMeal(id) {
  const meals = getNLMeals();
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  const logged = {
    id: 'meal_' + Date.now(),
    name: meal.name,
    type: 'logged',
    ingredients: meal.ingredients.map(i => ({ ...i })),
    notes: '',
    favorite: false,
    createdAt: state.nlSelectedDate || new Date().toISOString().slice(0, 10)
  };
  if (meal.image) logged.image = meal.image;
  meals.push(logged);
  saveNLMeals(meals);
  closeSavedMealPicker();
  renderNLCalendar();
  renderNLMeals();
  renderMacroGoals();
  const toast = document.createElement('div');
  toast.className = 'pr-toast';
  toast.style.background = 'linear-gradient(135deg, var(--green), #27ae60)';
  toast.textContent = `Logged "${meal.name}"`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2600);
}

// ── Nutrition Calendar ──

export function renderNLCalendar() {
  const today = new Date().toISOString().slice(0, 10);
  const meals = getNLMeals().filter(m => (m.type || 'logged') === 'logged');
  const mealDates = new Set(meals.map(m => m.createdAt));

  document.getElementById('nlCalMonthLbl').textContent = `${MONTHS[state.nlCalMon]} ${state.nlCalYear}`;

  const firstDow = new Date(state.nlCalYear, state.nlCalMon, 1).getDay();
  const daysInMon = new Date(state.nlCalYear, state.nlCalMon + 1, 0).getDate();


  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="bw-cal-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDow; i++) html += `<div class="bw-cal-day cal-empty"></div>`;
  for (let d = 1; d <= daysInMon; d++) {
    const ds = `${state.nlCalYear}-${String(state.nlCalMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cls = [
      'bw-cal-day',
      ds === today ? 'today' : '',
      mealDates.has(ds) ? 'has-data' : '',
      ds === state.nlSelectedDate ? 'selected' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="nlSelectDate('${ds}')">${d}</div>`;
  }
  const remain = 42 - (firstDow + daysInMon);
  for (let i = 0; i < remain; i++) html += `<div class="bw-cal-day cal-empty"></div>`;
  document.getElementById('nlCalGrid').innerHTML = html;
}

export function nlPrevMonth() {
  if (state.nlCalYear === 2026 && state.nlCalMon === 0) return;
  if (state.nlCalMon === 0) { state.nlCalMon = 11; state.nlCalYear--; } else state.nlCalMon--;
  renderNLCalendar();
}

export function nlNextMonth() {
  if (state.nlCalYear === 2035 && state.nlCalMon === 11) return;
  if (state.nlCalMon === 11) { state.nlCalMon = 0; state.nlCalYear++; } else state.nlCalMon++;
  renderNLCalendar();
}

export function nlSelectDate(dateStr) {
  state.nlSelectedDate = dateStr;
  const [y, m] = dateStr.split('-').map(Number);
  state.nlCalYear = y;
  state.nlCalMon = m - 1;
  renderNLCalendar();
  renderNLMeals();
  renderMacroGoals();
}
