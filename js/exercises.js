// ── Exercises Module ──
// Home grid, exercise list, exercise detail modal.

import { exerciseData, findExercise } from '../data/exercises.js';
import { state } from './state.js';
import { getLog, getNotes, saveNotesData } from './store.js';
import { showView, setHeader } from './navigation.js';

/** Build the muscle-group grid on the home/exercises tab */
export function buildHome() {
  const grid = document.getElementById('muscleGrid');
  const entries = Object.entries(exerciseData);
  grid.innerHTML = '';
  entries.forEach(([key, group]) => {
    const card = document.createElement('div');
    card.className = 'muscle-card';
    card.innerHTML = `
      <div class="muscle-icon-wrap">
        <img src="images/baseImage_transparent.png" alt="" loading="lazy">
        <img class="m-overlay" src="images/${group.img}.png" alt="${group.name}" loading="lazy">
      </div>
      <div class="name">${group.name}</div>
      <div class="count">${group.exercises.length} exercises</div>`;
    card.onclick = () => showExercises(key);
    grid.appendChild(card);
  });
}

/** Show exercise list for a muscle group */
export function showExercises(key) {
  state.currentMuscleKey = key;
  const group = exerciseData[key];
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';
  group.exercises.forEach(ex => {
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.innerHTML = `
      <span class="ex-name">${ex.name}</span>
      <span class="arrow">\u203a</span>`;
    item.onclick = () => openModal(ex, group.name);
    list.appendChild(item);
  });
  showView('exerciseView');
  setHeader(group.name, true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'exercise-list';
}

/** Open the exercise detail modal */
export function openModal(ex, muscleName, fromPlan = false) {
  state.currentExerciseName = ex.name;
  document.getElementById('modalTitle').textContent = ex.name;
  document.getElementById('modalTag').textContent = muscleName;
  document.getElementById('modalDesc').textContent = ex.desc;
  document.getElementById('modalTips').innerHTML = ex.tips.map(t => `<li>${t}</li>`).join('');

  const gifEl = document.getElementById('modalGif');
  if (ex.gif) {
    gifEl.src = ex.gif;
    gifEl.style.display = '';
    gifEl.play();
  } else {
    gifEl.style.display = 'none';
    gifEl.src = '';
  }

  const planSection = document.getElementById('modalPlanSection');
  planSection.style.display = fromPlan ? '' : 'none';

  if (fromPlan) {
    const log = getLog(ex.name);
    const valEl = document.getElementById('lastSessionValue');
    const dateEl = document.getElementById('lastSessionDate');
    if (log) {
      valEl.textContent = `${log.weight}kg \u00d7 ${log.reps} reps` + (log.sets > 1 ? ` \u00b7 ${log.sets} sets` : '');
      valEl.className = 'ls-value';
      dateEl.textContent = log.date;
    } else {
      valEl.textContent = 'No data yet';
      valEl.className = 'ls-value none';
      dateEl.textContent = '';
    }

    const notesEl = document.getElementById('modalNotes');
    const notesCount = document.getElementById('modalNotesCount');
    notesEl.value = getNotes(ex.name);
    notesCount.textContent = `${notesEl.value.length} / 250`;
  }

  document.getElementById('ytBtn').onclick = () => {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.yt);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  };

  document.getElementById('modalOverlay').classList.add('open');
}

/** Auto-save exercise notes on each keystroke */
export function autoSaveExNotes() {
  if (!state.currentExerciseName) return;
  saveNotesData(state.currentExerciseName, document.getElementById('modalNotes').value);
  document.getElementById('modalNotesCount').textContent = `${document.getElementById('modalNotes').value.length} / 250`;
}

/** Close the exercise detail modal */
export function closeModal() {
  const modal = document.querySelector('#modalOverlay .modal');
  modal.style.transform = '';
  document.getElementById('modalOverlay').classList.remove('open');
}

export function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

/** Initialize swipe-down-to-dismiss on the exercise modal */
export function initModalSwipe() {
  const overlay = document.getElementById('modalOverlay');
  const modal = overlay.querySelector('.modal');
  let _md = null;

  modal.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    const rect = modal.getBoundingClientRect();
    if (touch.clientY - rect.top > 72) return;
    _md = { startY: touch.clientY };
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    if (!_md) return;
    const dy = Math.max(0, e.touches[0].clientY - _md.startY);
    e.preventDefault();
    modal.style.transition = 'none';
    modal.style.transform = `translateY(${dy}px)`;
    overlay.style.background = `rgba(0,0,0,${Math.max(0.05, 0.65 - dy / 350)})`;
  }, { passive: false });

  modal.addEventListener('touchend', e => {
    if (!_md) return;
    const dy = e.changedTouches[0].clientY - _md.startY;
    modal.style.transition = '';
    overlay.style.background = '';
    if (dy > 110) {
      modal.style.transform = `translateY(110%)`;
      setTimeout(() => { modal.style.transform = ''; closeModal(); }, 240);
    } else {
      modal.style.transform = '';
    }
    _md = null;
  });
}
