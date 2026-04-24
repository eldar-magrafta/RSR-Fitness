// ── Exercises Module ──
// Home grid, exercise list, exercise detail modal.

import { exerciseData, findExercise } from '../data/exercises.js';
import { state } from './state.js';
import { getLog, getNotes, saveNotesData, deleteLastLog } from './store.js';
import { showView, setHeader } from './navigation.js';
import { getPR, renderPRBadge, recalcPR } from './prs.js';
import { debounce } from './utils.js';

/** Build the muscle-group grid on the home/exercises tab */
export function buildHome() {
  const searchEl = document.getElementById('globalExSearch');
  if (searchEl) searchEl.value = '';
  document.getElementById('globalSearchResults').style.display = 'none';
  document.getElementById('muscleGrid').style.display = '';

  const grid = document.getElementById('muscleGrid');
  const entries = Object.entries(exerciseData);
  grid.innerHTML = '';
  entries.forEach(([key, group]) => {
    const card = document.createElement('div');
    card.className = 'muscle-card';
    card.innerHTML = `
      <div class="muscle-icon-wrap">
        <img src="assets/muscles/baseImage_transparent.png" alt="" loading="lazy">
        <img class="m-overlay" src="assets/muscles/${group.img}.png" alt="${group.name}" loading="lazy">
      </div>
      <div class="name">${group.name}</div>
      <div class="count">${group.exercises.length} exercises</div>`;
    card.onclick = () => showExercises(key);
    grid.appendChild(card);
  });
}

export const globalExSearchHandler = debounce(function() {
  const q = document.getElementById('globalExSearch').value.trim().toLowerCase();
  const resultsEl = document.getElementById('globalSearchResults');
  const gridEl = document.getElementById('muscleGrid');

  if (!q) {
    resultsEl.style.display = 'none';
    gridEl.style.display = '';
    return;
  }

  resultsEl.style.display = '';
  gridEl.style.display = 'none';
  resultsEl.innerHTML = '';

  Object.entries(exerciseData).forEach(([key, group]) => {
    group.exercises.forEach(ex => {
      if (ex.name.toLowerCase().includes(q)) {
        const item = document.createElement('div');
        item.className = 'exercise-item';
        item.innerHTML = `
          ${ex.gif ? `<img class="ex-thumb" src="${ex.gif}" loading="lazy" />` : ''}
          <div class="ex-item-info"><span class="ex-name">${ex.name}</span><span class="ex-search-group">${group.name}</span></div>
          <span class="arrow">\u203a</span>`;
        item.onclick = () => openModal(ex, group.name);
        resultsEl.appendChild(item);
      }
    });
  });

  if (!resultsEl.children.length) {
    resultsEl.innerHTML = '<div class="ex-search-empty">No exercises found</div>';
  }
}, 150);

/** Show exercise list for a muscle group */
export function showExercises(key) {
  state.currentMuscleKey = key;
  const group = exerciseData[key];
  const searchEl = document.getElementById('groupExSearch');
  if (searchEl) searchEl.value = '';
  _renderGroupList(group);
  showView('exerciseView');
  setHeader(group.name, true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'exercise-list';
}

function _renderGroupList(group, filter) {
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';
  const q = (filter || '').toLowerCase();
  group.exercises.forEach(ex => {
    if (q && !ex.name.toLowerCase().includes(q)) return;
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.innerHTML = `
      ${ex.gif ? `<img class="ex-thumb" src="${ex.gif}" loading="lazy" />` : ''}
      <div class="ex-item-info"><span class="ex-name">${ex.name}</span></div>
      <span class="arrow">\u203a</span>`;
    item.onclick = () => openModal(ex, group.name);
    list.appendChild(item);
  });
  if (q && !list.children.length) {
    list.innerHTML = '<div class="ex-search-empty">No exercises found</div>';
  }
}

export const groupExSearchHandler = debounce(function() {
  const group = exerciseData[state.currentMuscleKey];
  if (!group) return;
  const q = document.getElementById('groupExSearch').value.trim();
  _renderGroupList(group, q);
}, 150);

/** Open the exercise detail modal */
export function openModal(ex, muscleName, fromPlan = false) {
  state.currentExerciseName = ex.name;
  document.getElementById('modalTitle').textContent = ex.name;
  document.getElementById('modalTag').textContent = muscleName;
  document.getElementById('modalDesc').textContent = ex.desc;
  document.getElementById('modalTips').innerHTML = ex.tips.map(t => `<li>${t}</li>`).join('');

  // Support both <video> (.webm/.mp4) and <img> (.gif) — find whichever elements exist
  const vidEl = document.getElementById('modalVid') || document.getElementById('modalGif');
  const imgEl = document.getElementById('modalImg');
  if (ex.gif) {
    const isVideo = ex.gif.endsWith('.webm') || ex.gif.endsWith('.mp4');
    if (isVideo && vidEl) {
      vidEl.src = ex.gif;
      vidEl.style.display = '';
      vidEl.play();
      if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
    } else if (!isVideo && imgEl) {
      imgEl.src = ex.gif;
      imgEl.style.display = '';
      if (vidEl) { vidEl.style.display = 'none'; vidEl.src = ''; }
    } else if (vidEl) {
      // Fallback: old HTML only has <video id="modalGif"> — use it for everything
      vidEl.src = ex.gif;
      vidEl.style.display = '';
      try { vidEl.play(); } catch(e) {}
    }
  } else {
    if (vidEl) { vidEl.style.display = 'none'; vidEl.src = ''; }
    if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
  }

  const planSection = document.getElementById('modalPlanSection');
  planSection.style.display = fromPlan ? '' : 'none';

  if (fromPlan) {
    const log = getLog(ex.name);
    const valEl = document.getElementById('lastSessionValue');
    const dateEl = document.getElementById('lastSessionDate');
    const delBtn = document.getElementById('deleteLogBtn');
    if (log) {
      valEl.textContent = log.setList.map(s => `${s.w}kg \u00d7 ${s.r} reps`).join(' / ');
      valEl.className = 'ls-value';
      dateEl.textContent = log.date;
      if (delBtn) delBtn.style.display = '';
    } else {
      valEl.textContent = 'No data yet';
      valEl.className = 'ls-value none';
      dateEl.textContent = '';
      if (delBtn) delBtn.style.display = 'none';
    }

    // PR display
    const prSection = document.getElementById('modalPRSection');
    const pr = getPR(ex.name);
    if (pr) {
      const prDate = new Date(pr.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      document.getElementById('modalPRValue').textContent = `${pr.weight}kg \u00d7 ${pr.reps} reps`;
      document.getElementById('modalPRDate').textContent = prDate;
      prSection.style.display = '';
    } else {
      prSection.style.display = 'none';
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

let _onModalClose = null;
export function setOnModalClose(fn) { _onModalClose = fn; }

/** Close the exercise detail modal */
export function closeModal(skipCallback) {
  const modal = document.querySelector('#modalOverlay .modal');
  modal.style.transform = '';
  document.getElementById('modalOverlay').classList.remove('open');
  state.currentExerciseName = null;
  if (!skipCallback && _onModalClose) _onModalClose();
}

export function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

/** Delete the most recent log entry for the current exercise and refresh the modal */
export function deleteExLog() {
  if (!state.currentExerciseName) return;
  deleteLastLog(state.currentExerciseName);
  recalcPR(state.currentExerciseName);
  const log = getLog(state.currentExerciseName);
  const valEl = document.getElementById('lastSessionValue');
  const dateEl = document.getElementById('lastSessionDate');
  const delBtn = document.getElementById('deleteLogBtn');
  if (log) {
    valEl.textContent = log.setList.map(s => `${s.w}kg \u00d7 ${s.r} reps`).join(' / ');
    valEl.className = 'ls-value';
    dateEl.textContent = log.date;
  } else {
    valEl.textContent = 'No data yet';
    valEl.className = 'ls-value none';
    dateEl.textContent = '';
    if (delBtn) delBtn.style.display = 'none';
  }
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
