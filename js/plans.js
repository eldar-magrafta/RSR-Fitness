// ── Plans Module ──
// Plan CRUD, plan detail, exercise picker, drag-to-reorder.

import { exerciseData, findExercise } from '../data/exercises.js';
import { state } from './state.js';
import { getPlans, savePlans, getPlan, getLog } from './store.js';
import { showView, setHeader } from './navigation.js';
import { openModal } from './exercises.js';
import { escHtml, openConfirmDialog, initDragReorder } from './utils.js';

// ── Plans List ──

export function renderPlans() {
  const plans = getPlans();
  const container = document.getElementById('plansContent');
  document.getElementById('fab').classList.toggle('hidden', plans.length === 0);
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
    plans.forEach((plan, idx) => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.dataset.planIdx = idx;
      const exCount = plan.exercises.filter(i => typeof i === 'string').length;
      card.innerHTML = `
        <span class="drag-handle plan-drag-handle">⠇</span>
        <div class="plan-card-info">
          <div class="plan-card-name">${escHtml(plan.name)}</div>
          <div class="plan-card-meta">${exCount === 0 ? 'No exercises yet' : exCount + ' exercise' + (exCount !== 1 ? 's' : '')}</div>
        </div>
        <button class="plan-card-delete" title="Delete plan"><i class="bi bi-trash3"></i></button>`;
      card.querySelector('.plan-card-info').onclick = () => showPlanDetail(plan.id);
      card.querySelector('.plan-card-delete').onclick = (e) => {
        e.stopPropagation();
        openDeletePlanConfirm(plan.id, plan.name);
      };
      list.appendChild(card);
    });
    [...list.children].forEach((child, i) => initDragReorder(child, i, {
      listId: 'plansList',
      dataAttr: 'planIdx',
      getItems: getPlans,
      onDrop: newOrder => { savePlans(newOrder); renderPlans(); },
    }));
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
  const name = document.getElementById('planNameInput').value.trim().slice(0, 100);
  if (!name) return;
  const plans = getPlans();
  const newPlan = { id: 'plan_' + Date.now(), name, exercises: [] };
  plans.push(newPlan);
  savePlans(plans);
  closeCreatePlan();
  showPlanDetail(newPlan.id);
}


/** Toggle between view mode and edit mode in plan detail */
export function savePlanName() {
  const input = document.getElementById('planNameEdit');
  if (!input) return;
  const name = input.value.trim().slice(0, 100);
  if (!name || !state.currentPlanId) return;
  const plans = getPlans();
  const plan = plans.find(p => p.id === state.currentPlanId);
  if (plan && plan.name !== name) {
    plan.name = name;
    savePlans(plans);
  }
}

export function setPlanEditMode(editing) {
  state._planEditing = editing;
  const detail = document.getElementById('planDetailView');
  detail.classList.toggle('editing', editing);
  const titleEl = document.getElementById('headerTitle');
  const btn = document.getElementById('headerAction');
  if (editing) {
    const plan = getPlan(state.currentPlanId);
    if (plan) {
      titleEl.innerHTML = `<input id="planNameEdit" class="plan-name-edit" value="${escHtml(plan.name)}" maxlength="100" />`;
    }
    btn.textContent = '\u2713  Done';
    btn.onclick = () => { savePlanName(); state._planEditing = false; showPlanDetail(state.currentPlanId); };
    btn.classList.add('visible');
  } else {
    const plan = getPlan(state.currentPlanId);
    if (plan) titleEl.textContent = plan.name;
    btn.innerHTML = '&#9998;';
    btn.onclick = () => setPlanEditMode(true);
    btn.classList.add('visible');
  }
}

export function openDeletePlanConfirm(planId, planName) {
  openConfirmDialog({
    title: 'Delete Plan?',
    message: `Delete "${planName}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      const plans = getPlans().filter(p => p.id !== planId);
      savePlans(plans);
      renderPlans();
    },
  });
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
          <span class="plan-section-title-text">${escHtml(item.title)}</span>
          <button class="plan-title-remove" title="Remove title"><i class="bi bi-trash3"></i></button>`;
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
      const subText = log ? `Last: ${log.setList.map(s => `${s.w}kg \u00d7 ${s.r}`).join(' / ')}` : found.groupName;
      el.innerHTML = `
        <span class="drag-handle">\u2807</span>
        ${found.ex.gif ? `<img class="plan-ex-thumb" src="${found.ex.gif}" loading="lazy" />` : ''}
        <div class="plan-ex-info">
          <div class="plan-ex-name">${exName}</div>
          <div class="plan-ex-sub ${log ? 'logged' : ''}">${subText}</div>
        </div>
        <button class="plan-ex-remove" title="Remove">−</button>`;
      el.querySelector('.plan-ex-info').onclick = () => openModal(found.ex, found.groupName, true);
      el.querySelector('.plan-ex-remove').onclick = (e) => {
        e.stopPropagation();
        openRemoveExConfirm(planId, exName);
      };
      list.appendChild(el);
    });
  }

  [...list.children].forEach((child, i) => initDragReorder(child, i, {
    listId: 'planDetailList',
    dataAttr: 'planItemIdx',
    getItems: () => [...getPlan(state.currentPlanId).exercises],
    onDrop: newOrder => {
      const plans = getPlans();
      const plan = plans.find(p => p.id === state.currentPlanId);
      if (plan) { plan.exercises = newOrder; savePlans(plans); }
      showPlanDetail(state.currentPlanId);
    },
  }));

  showView('planDetailView');
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'plan-detail';

  const wasEditing = state._planEditing;
  const isEmpty = plan.exercises.length === 0;
  if (isEmpty) {
    setPlanEditMode(true);
    setHeader(plan.name, true, null);
  } else if (wasEditing) {
    setHeader(plan.name, true, null);
    setPlanEditMode(true);
  } else {
    setHeader(plan.name, true, '&#9998;', () => setPlanEditMode(true));
    setPlanEditMode(false);
  }
}

// ── Remove Exercise Confirmation ──

export function openRemoveExConfirm(planId, exName) {
  openConfirmDialog({
    title: 'Remove Exercise?',
    message: `Remove "${exName}" from this plan?`,
    confirmLabel: 'Remove',
    onConfirm: () => removeExerciseFromPlan(planId, exName),
  });
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
  const text = document.getElementById('titleInput').value.trim().slice(0, 100);
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
            <img src="assets/muscles/baseImage_transparent.png" alt="">
            <img class="m-overlay" src="assets/muscles/${group.img}.png" alt="">
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
  setHeader(plan.name, false, '\u2713  Done', () => showPlanDetail(state.currentPlanId));
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

