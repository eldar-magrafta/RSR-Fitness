// ── Plans Module ──
// Plan CRUD, plan detail, exercise picker, drag-to-reorder.

import { exerciseData, findExercise } from '../data/exercises.js';
import { state } from './state.js';
import { getPlans, savePlans, getPlan, getLog } from './store.js';
import { showView, setHeader } from './navigation.js';
import { openModal } from './exercises.js';

// ── Plans List ──

export function renderPlans() {
  const plans = getPlans();
  const container = document.getElementById('plansContent');
  if (plans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No Plans Yet</div>
        <div class="empty-sub">Create your first workout plan and add exercises from any muscle group.</div>
        <button class="empty-cta" onclick="openCreatePlan()">+ Create Plan</button>
      </div>`;
  } else {
    container.innerHTML = '<div class="plans-list" id="plansList"></div>';
    const list = document.getElementById('plansList');
    plans.forEach(plan => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      const exCount = plan.exercises.filter(i => typeof i === 'string').length;
      card.innerHTML = `
        <div class="plan-card-info">
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-meta">${exCount === 0 ? 'No exercises yet' : exCount + ' exercise' + (exCount !== 1 ? 's' : '')}</div>
        </div>
        <button class="plan-card-delete" title="Delete plan">\u2715</button>`;
      card.querySelector('.plan-card-info').onclick = () => showPlanDetail(plan.id);
      card.querySelector('.plan-card-delete').onclick = (e) => {
        e.stopPropagation();
        openDeletePlanConfirm(plan.id, plan.name);
      };
      list.appendChild(card);
    });
  }
}

export function openCreatePlan() {
  document.getElementById('planNameInput').value = '';
  document.getElementById('createPlanOverlay').classList.add('open');
  setTimeout(() => document.getElementById('planNameInput').focus(), 300);
}

export function closeCreatePlan() {
  document.getElementById('createPlanOverlay').classList.remove('open');
}

export function handleCreateOverlayClick(e) {
  if (e.target === document.getElementById('createPlanOverlay')) closeCreatePlan();
}

export function createPlan() {
  const name = document.getElementById('planNameInput').value.trim();
  if (!name) return;
  const plans = getPlans();
  const newPlan = { id: 'plan_' + Date.now(), name, exercises: [] };
  plans.push(newPlan);
  savePlans(plans);
  closeCreatePlan();
  showPlanDetail(newPlan.id);
}

/** "Done" button in plan detail — exit edit mode back to view mode */
export function donePlanDetail() {
  setPlanEditMode(false);
}

/** Toggle between view mode and edit mode in plan detail */
export function setPlanEditMode(editing) {
  state._planEditing = editing;
  const detail = document.getElementById('planDetailView');
  detail.classList.toggle('editing', editing);
  const btn = document.getElementById('headerAction');
  if (editing) {
    btn.textContent = '\u2713  Done';
    btn.onclick = donePlanDetail;
  } else {
    btn.innerHTML = '&#9998;';
    btn.onclick = () => setPlanEditMode(true);
  }
}

/** Open delete-plan confirmation from the plans list card */
export function openDeletePlanConfirm(planId, planName) {
  state._pendingDeletePlanId = planId;
  document.getElementById('deletePlanConfirmMsg').textContent =
    `Delete "${planName}"? This cannot be undone.`;
  document.getElementById('deletePlanConfirmOverlay').classList.add('open');
}

export function closeDeletePlanConfirm() {
  document.getElementById('deletePlanConfirmOverlay').classList.remove('open');
  state._pendingDeletePlanId = null;
}

export function confirmDeletePlan() {
  if (!state._pendingDeletePlanId) return;
  const plans = getPlans().filter(p => p.id !== state._pendingDeletePlanId);
  savePlans(plans);
  closeDeletePlanConfirm();
  renderPlans();
}

// ── Plan Detail ──

export function showPlanDetail(planId) {
  state.currentPlanId = planId;
  const plan = getPlan(planId);
  if (!plan) return;

  const list = document.getElementById('planDetailList');
  list.innerHTML = '';

  if (plan.exercises.length === 0) {
    list.innerHTML = `
      <div class="plan-empty-ex">
        <div class="big">🏋️</div>
        <p>No exercises yet.<br>Tap below to add some.</p>
      </div>`;
  } else {
    plan.exercises.forEach((item, idx) => {
      // Section title
      if (item && typeof item === 'object' && item.title !== undefined) {
        const row = document.createElement('div');
        row.className = 'plan-section-title';
        row.dataset.planItemIdx = idx;
        row.innerHTML = `
          <span class="drag-handle" style="padding:4px 8px 4px 0;font-size:1rem;">\u2807</span>
          <span class="plan-section-title-text">${item.title}</span>
          <button class="plan-title-remove" title="Remove title">\u2715</button>`;
        row.querySelector('.plan-title-remove').onclick = () => {
          removeTitleFromPlan(planId, idx);
        };
        list.appendChild(row);
        return;
      }
      // Exercise
      const exName = item;
      const found = findExercise(exName);
      if (!found) return;
      const log = getLog(exName);
      const el = document.createElement('div');
      el.className = 'plan-ex-item';
      el.dataset.planItemIdx = idx;
      const subText = log ? `Last: ${log.weight}kg \u00d7 ${log.reps}r` + (log.sets > 1 ? ` \u00b7 ${log.sets} sets` : '') : found.groupName;
      el.innerHTML = `
        <span class="drag-handle">\u2807</span>
        <div class="plan-ex-info">
          <div class="plan-ex-name">${exName}</div>
          <div class="plan-ex-sub ${log ? 'logged' : ''}">${subText}</div>
        </div>
        <button class="plan-ex-remove" title="Remove">\u2212</button>`;
      el.querySelector('.plan-ex-info').onclick = () => openModal(found.ex, found.groupName, true);
      el.querySelector('.plan-ex-remove').onclick = (e) => {
        e.stopPropagation();
        openRemoveExConfirm(planId, exName);
      };
      list.appendChild(el);
    });
  }

  // Init drag-to-reorder
  [...list.children].forEach((child, i) => _initItemDrag(child, i));

  showView('planDetailView');
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'plan-detail';

  const hasExercises = plan.exercises.length > 0;
  const wasEditing = state._planEditing;
  if (hasExercises && !wasEditing) {
    setHeader(plan.name, true, '&#9998;', () => setPlanEditMode(true));
    setPlanEditMode(false);
  } else {
    setPlanEditMode(true);
  }
}

// ── Remove Exercise Confirmation ──

export function openRemoveExConfirm(planId, exName) {
  state._pendingRemovePlanId = planId;
  state._pendingRemoveExName = exName;
  document.getElementById('removeExConfirmMsg').textContent =
    `Remove "${exName}" from this plan?`;
  document.getElementById('removeExConfirmOverlay').classList.add('open');
}

export function closeRemoveExConfirm() {
  document.getElementById('removeExConfirmOverlay').classList.remove('open');
  state._pendingRemovePlanId = null;
  state._pendingRemoveExName = null;
}

export function confirmRemoveEx() {
  if (state._pendingRemovePlanId && state._pendingRemoveExName)
    removeExerciseFromPlan(state._pendingRemovePlanId, state._pendingRemoveExName);
  closeRemoveExConfirm();
}

function removeExerciseFromPlan(planId, exName) {
  const plans = getPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  plan.exercises = plan.exercises.filter(i => i !== exName);
  savePlans(plans);
  showPlanDetail(planId);
}

function removeTitleFromPlan(planId, idx) {
  const plans = getPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  plan.exercises.splice(idx, 1);
  savePlans(plans);
  showPlanDetail(planId);
}

// ── Add Title ──

export function openAddTitle() {
  document.getElementById('titleInput').value = '';
  document.getElementById('addTitleOverlay').classList.add('open');
  setTimeout(() => document.getElementById('titleInput').focus(), 300);
}

export function closeAddTitle() {
  document.getElementById('addTitleOverlay').classList.remove('open');
}

export function handleTitleOverlayClick(e) {
  if (e.target === document.getElementById('addTitleOverlay')) closeAddTitle();
}

export function saveTitle() {
  const text = document.getElementById('titleInput').value.trim();
  if (!text || !state.currentPlanId) return;
  const plans = getPlans();
  const plan = plans.find(p => p.id === state.currentPlanId);
  if (!plan) return;
  plan.exercises.push({ title: text });
  savePlans(plans);
  closeAddTitle();
  showPlanDetail(state.currentPlanId);
}

// ── Exercise Picker ──

export function showExercisePicker() {
  const plan = getPlan(state.currentPlanId);
  if (!plan) return;

  const container = document.getElementById('pickerList');
  container.innerHTML = '';

  Object.entries(exerciseData).forEach(([key, group]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'picker-group';

    const addedCount = group.exercises.filter(ex => plan.exercises.some(i => i === ex.name)).length;

    groupEl.innerHTML = `
      <div class="picker-group-hdr" onclick="togglePickerGroup(this)">
        <div class="picker-group-left">
          <div class="picker-group-icon">
            <img src="images/baseImage_transparent.png" alt="">
            <img class="m-overlay" src="images/${group.img}.png" alt="">
          </div>
          <span class="picker-group-name">${group.name}</span>
          <span class="picker-group-badge ${addedCount > 0 ? 'visible' : ''}" data-badge-group="${key}">${addedCount}</span>
        </div>
        <span class="picker-chevron">\u25bc</span>
      </div>
      <div class="picker-exercises" id="picker_${key}">
        ${group.exercises.map(ex => {
          const added = plan.exercises.some(i => i === ex.name);
          return `
            <div class="picker-ex-item">
              <span class="picker-ex-name" onclick="previewExercise('${ex.name.replace(/'/g, "\\'")}')">${ex.name}</span>
              <div class="picker-toggle ${added ? 'added' : ''}" data-ex-toggle="${ex.name}" onclick="toggleExerciseInPlan('${ex.name.replace(/'/g, "\\'")}', '${key}')">\u2713</div>
            </div>`;
        }).join('')}
      </div>`;

    container.appendChild(groupEl);
  });

  showView('exercisePickerView');
  setHeader('Add Exercises', false, '\u2713  Done', () => showPlanDetail(state.currentPlanId));
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'picker';
}

/** Preview an exercise from the picker — opens the detail modal (read-only) */
export function previewExercise(exName) {
  const found = findExercise(exName);
  if (!found) return;
  openModal(found.ex, found.groupName, false);
}

export function togglePickerGroup(hdr) {
  const key = hdr.closest('.picker-group').querySelector('.picker-exercises').id.replace('picker_', '');
  hdr.classList.toggle('open');
  document.getElementById('picker_' + key).classList.toggle('open');
}

export function toggleExerciseInPlan(exName, groupKey) {
  const plans = getPlans();
  const plan = plans.find(p => p.id === state.currentPlanId);
  if (!plan) return;

  const idx = plan.exercises.findIndex(i => i === exName);
  if (idx === -1) {
    plan.exercises.push(exName);
  } else {
    plan.exercises.splice(idx, 1);
  }
  savePlans(plans);

  // Update ALL toggle checkmarks for this exercise across every muscle group
  const isNowAdded = idx === -1;
  document.querySelectorAll(`[data-ex-toggle="${exName}"]`).forEach(toggle => {
    toggle.classList.toggle('added', isNowAdded);
  });

  // Update badges for ALL groups that contain this exercise
  const updatedPlan = getPlan(state.currentPlanId);
  Object.entries(exerciseData).forEach(([key, group]) => {
    const count = group.exercises.filter(e => updatedPlan.exercises.some(i => i === e.name)).length;
    const badge = document.querySelector(`[data-badge-group="${key}"]`);
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    }
  });
}

// ── Drag-to-Reorder ──

function _initItemDrag(el, domIdx) {
  const handle = el.querySelector('.drag-handle');
  if (!handle) return;
  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    _startDrag(e, domIdx);
  }, { passive: false });
}

function _startDrag(e, domIdx) {
  if (state._drag) return;
  const plan = getPlan(state.currentPlanId);
  if (!plan) return;
  state._dragOrigItems = [...plan.exercises];

  const touch = e.touches[0];
  const listEl = document.getElementById('planDetailList');
  const el = [...listEl.children][domIdx];
  if (!el) return;
  const rect = el.getBoundingClientRect();

  const ghost = el.cloneNode(true);
  ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:1000;pointer-events:none;opacity:0.93;box-shadow:0 10px 40px rgba(0,0,0,0.6);transform:scale(1.03);border-radius:14px;transition:none;background:var(--card);`;
  document.body.appendChild(ghost);
  el.style.visibility = 'hidden';

  state._drag = { el, ghost, listEl, offsetY: touch.clientY - rect.top };

  document.addEventListener('touchmove', _onDragMove, { passive: false });
  document.addEventListener('touchend', _onDragEnd, { once: true });
}

function _onDragMove(e) {
  e.preventDefault();
  if (!state._drag) return;
  const touch = e.touches[0];
  const { ghost, el, offsetY, listEl } = state._drag;
  ghost.style.top = (touch.clientY - offsetY) + 'px';

  const siblings = [...listEl.children].filter(c => c !== el);
  let insertBefore = null;
  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (touch.clientY < r.top + r.height / 2) { insertBefore = sib; break; }
  }
  if (insertBefore) listEl.insertBefore(el, insertBefore);
  else listEl.appendChild(el);
}

function _onDragEnd() {
  document.removeEventListener('touchmove', _onDragMove);
  if (!state._drag) return;
  const { el, ghost, listEl } = state._drag;
  ghost.remove();
  el.style.visibility = '';

  const newOrder = [...listEl.children].map(child => {
    const origIdx = parseInt(child.dataset.planItemIdx);
    return state._dragOrigItems[origIdx];
  }).filter(i => i !== undefined);

  const plans = getPlans();
  const plan = plans.find(p => p.id === state.currentPlanId);
  if (plan) { plan.exercises = newOrder; savePlans(plans); }

  state._drag = null;
  state._dragOrigItems = null;
  showPlanDetail(state.currentPlanId);
}
