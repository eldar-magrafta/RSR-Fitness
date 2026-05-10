// ── Exercises Module ──
// Home grid, exercise list, exercise detail modal.

import { exerciseData, findExercise as findBuiltIn } from '../data/exercises.js';
import { state } from './state.js';
import { getLog, getNotes, saveNotesData, deleteLastLog, getCustomExercises, saveCustomExercises } from './store.js';
import { showView, setHeader } from './navigation.js';
import { getPR, renderPRBadge, recalcPR } from './prs.js';
import { debounce, openConfirmDialog } from './utils.js';
import { savePhotoDoc, loadPhotoDoc, deletePhotoDoc } from './cloud.js';

export function findExercise(name) {
  const built = findBuiltIn(name);
  if (built) return built;
  const customs = getCustomExercises();
  const ex = customs.find(c => c.name === name);
  if (ex) return { ex, groupName: exerciseData[ex.group]?.name || ex.group };
  return null;
}

/** Build the muscle-group grid on the home/exercises tab */
export function buildHome() {
  const searchEl = document.getElementById('globalExSearch');
  if (searchEl) searchEl.value = '';
  document.getElementById('globalSearchResults').style.display = 'none';
  document.getElementById('muscleGrid').style.display = '';

  const grid = document.getElementById('muscleGrid');
  const entries = Object.entries(exerciseData);
  const customs = getCustomExercises();
  grid.innerHTML = '';
  entries.forEach(([key, group]) => {
    const customCount = customs.filter(c => c.group === key).length;
    const totalCount = group.exercises.length + customCount;
    const card = document.createElement('div');
    card.className = 'muscle-card';
    card.innerHTML = `
      <div class="muscle-icon-wrap">
        <img src="assets/muscles/baseImage_transparent.png" alt="" loading="lazy">
        <img class="m-overlay" src="assets/muscles/${group.img}.png" alt="${group.name}" loading="lazy">
      </div>
      <div class="name">${group.name}</div>
      <div class="count">${totalCount} exercises</div>`;
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

  const customs = getCustomExercises();
  Object.entries(exerciseData).forEach(([key, group]) => {
    const groupCustoms = customs.filter(c => c.group === key);
    [...group.exercises, ...groupCustoms].forEach(ex => {
      if (ex.name.toLowerCase().includes(q)) {
        const isCustom = groupCustoms.includes(ex);
        const item = document.createElement('div');
        item.className = 'exercise-item';
        const thumbSrc = ex.gif && !ex.gif.startsWith('cloud:') ? ex.gif : '';
        item.innerHTML = `
          ${thumbSrc ? `<img class="ex-thumb" src="${thumbSrc}" loading="lazy" />` : '<div class="ex-thumb-placeholder"><i class="bi bi-person-arms-up"></i></div>'}
          <div class="ex-item-info"><span class="ex-name">${ex.name}</span>${isCustom ? '<span class="ex-custom-badge">custom</span>' : ''}<span class="ex-search-group">${group.name}</span></div>
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
  document.getElementById('fab').classList.remove('hidden');
  state.navContext = 'exercise-list';
}

function _renderGroupList(group, filter) {
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';
  const q = (filter || '').toLowerCase();
  const customs = getCustomExercises().filter(c => c.group === state.currentMuscleKey);
  const allExercises = [...group.exercises, ...customs];
  allExercises.forEach(ex => {
    if (q && !ex.name.toLowerCase().includes(q)) return;
    const isCustom = customs.includes(ex);
    const item = document.createElement('div');
    item.className = 'exercise-item';
    const thumbSrc = ex.gif || '';
    const isCloud = thumbSrc.startsWith('cloud:');
    const showThumb = thumbSrc && !isCloud;
    item.innerHTML = `
      ${showThumb ? `<img class="ex-thumb" src="${thumbSrc}" loading="lazy" />` : '<div class="ex-thumb-placeholder"><i class="bi bi-person-arms-up"></i></div>'}
      <div class="ex-item-info">
        <span class="ex-name">${ex.name}</span>
        ${isCustom ? '<span class="ex-custom-badge">custom</span>' : ''}
      </div>
      <span class="arrow">\u203a</span>`;
    if (isCloud) {
      const parts = thumbSrc.slice(6).split('/');
      loadPhotoDoc(parts[0], parts[1]).then(data => {
        if (data) {
          const placeholder = item.querySelector('.ex-thumb-placeholder');
          if (placeholder) {
            const img = document.createElement('img');
            img.className = 'ex-thumb';
            img.src = data;
            placeholder.replaceWith(img);
          }
        }
      });
    }
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
  document.getElementById('modalDesc').textContent = ex.desc || '';
  document.getElementById('modalTips').innerHTML = (ex.tips || []).map(t => `<li>${t}</li>`).join('');

  // Custom exercise delete button
  const delCustomBtn = document.getElementById('modalDeleteCustom');
  const isCustom = getCustomExercises().some(c => c.name === ex.name);
  if (delCustomBtn) {
    delCustomBtn.style.display = isCustom ? '' : 'none';
    delCustomBtn.onclick = () => deleteCustomEx(ex.name);
  }

  // Support both <video> (.webm/.mp4) and <img> (.gif) — find whichever elements exist
  const vidEl = document.getElementById('modalVid') || document.getElementById('modalGif');
  const imgEl = document.getElementById('modalImg');

  const loadMedia = (src) => {
    if (!src) {
      if (vidEl) { vidEl.style.display = 'none'; vidEl.src = ''; }
      if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
      return;
    }
    const isVideo = src.endsWith('.webm') || src.endsWith('.mp4') || src.startsWith('data:video');
    if (isVideo && vidEl) {
      vidEl.src = src;
      vidEl.style.display = '';
      vidEl.play();
      if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
    } else if (imgEl) {
      imgEl.src = src;
      imgEl.style.display = '';
      if (vidEl) { vidEl.style.display = 'none'; vidEl.src = ''; }
    } else if (vidEl) {
      vidEl.src = src;
      vidEl.style.display = '';
      try { vidEl.play(); } catch(e) {}
    }
  };

  if (ex.gif && ex.gif.startsWith('cloud:')) {
    if (vidEl) { vidEl.style.display = 'none'; vidEl.src = ''; }
    if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
    const parts = ex.gif.slice(6).split('/');
    loadPhotoDoc(parts[0], parts[1]).then(data => { if (data) loadMedia(data); });
  } else {
    loadMedia(ex.gif || '');
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

// ── Custom Exercise Creation ──

let _customVideoBase64 = null;

export function openCustomExModal() {
  document.getElementById('customExName').value = '';
  document.getElementById('customExSets').value = '';
  document.getElementById('customExDesc').value = '';
  document.getElementById('customExVideoPreview').style.display = 'none';
  document.getElementById('customExVideoPreview').src = '';
  document.getElementById('customExBtnDel').style.display = 'none';
  _customVideoBase64 = null;
  document.getElementById('customExOverlay').classList.add('open');
  setTimeout(() => document.getElementById('customExName').focus(), 250);
}

export function closeCustomExModal() {
  document.getElementById('customExOverlay').classList.remove('open');
  _customVideoBase64 = null;
}

export function customExVideoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  // Show loading state
  const videoBtn = document.querySelector('.custom-ex-video-btn');
  const origHTML = videoBtn.innerHTML;
  videoBtn.innerHTML = '<div class="bw-spinner" style="width:20px;height:20px;border-width:3px;"></div> Processing…';
  videoBtn.disabled = true;

  _convertVideoToGif(file).then(base64 => {
    videoBtn.innerHTML = origHTML;
    videoBtn.disabled = false;
    if (!base64) return;
    _customVideoBase64 = base64;
    document.getElementById('customExBtnDel').style.display = '';
    const preview = document.getElementById('customExVideoPreview');
    preview.src = base64;
    preview.style.display = 'block';
  });
}

export function removeCustomExVideo() {
  _customVideoBase64 = null;
  document.getElementById('customExVideoPreview').style.display = 'none';
  document.getElementById('customExVideoPreview').src = '';
  document.getElementById('customExBtnDel').style.display = 'none';
}

export function saveCustomEx() {
  const name = document.getElementById('customExName').value.trim();
  if (!name) return;
  const group = state.currentMuscleKey;
  if (!group) return;

  const customs = getCustomExercises();
  if (customs.some(c => c.name === name) || findBuiltIn(name)) {
    document.getElementById('customExName').style.outline = '2px solid var(--carbs)';
    setTimeout(() => document.getElementById('customExName').style.outline = '', 800);
    return;
  }

  const ex = {
    name,
    group,
    sets: document.getElementById('customExSets').value.trim() || '3 sets',
    desc: document.getElementById('customExDesc').value.trim() || '',
    tips: [],
    yt: name + ' exercise form',
    gif: '',
  };

  if (_customVideoBase64) {
    const docId = encodeURIComponent(name);
    savePhotoDoc('custom_ex_media', docId, _customVideoBase64);
    ex.gif = 'cloud:custom_ex_media/' + docId;
  }

  customs.push(ex);
  saveCustomExercises(customs);
  closeCustomExModal();
  _renderGroupList(exerciseData[group]);
}

export function deleteCustomEx(exName) {
  openConfirmDialog({
    title: 'Delete Custom Exercise?',
    message: `Remove "${exName}" from your custom exercises?`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      const customs = getCustomExercises();
      const idx = customs.findIndex(c => c.name === exName);
      if (idx >= 0) {
        const ex = customs[idx];
        if (ex.gif && ex.gif.startsWith('cloud:')) {
          const docId = encodeURIComponent(ex.name);
          deletePhotoDoc('custom_ex_media', docId);
        }
        customs.splice(idx, 1);
        saveCustomExercises(customs);
        closeModal(true);
        _renderGroupList(exerciseData[state.currentMuscleKey]);
      }
    },
  });
}

const MAX_VIDEO_DURATION = 5;

function _convertVideoToGif(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const objUrl = URL.createObjectURL(file);
    video.src = objUrl;

    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        URL.revokeObjectURL(objUrl);
        alert(`Video too long (${Math.round(video.duration)}s). Max ${MAX_VIDEO_DURATION} seconds.`);
        resolve('');
        return;
      }

      // Store as base64 video, downscale if needed
      const canvas = document.createElement('canvas');
      const w = Math.min(video.videoWidth, 360);
      const h = Math.round((w / video.videoWidth) * video.videoHeight);
      canvas.width = w;
      canvas.height = h;

      // Try to use MediaRecorder to re-encode at lower quality
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm')) {
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(12);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 400000 });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            URL.revokeObjectURL(objUrl);
            const base64 = reader.result;
            if (base64.length > 900000) {
              // Too large — fall back to a static frame
              video.currentTime = video.duration / 2;
              video.onseeked = () => {
                ctx.drawImage(video, 0, 0, w, h);
                resolve(canvas.toDataURL('image/webp', 0.7));
              };
            } else {
              resolve(base64);
            }
          };
          reader.readAsDataURL(blob);
        };

        video.currentTime = 0;
        video.onseeked = () => {
          recorder.start();
          video.play();
          const draw = () => {
            if (video.paused || video.ended) { recorder.stop(); return; }
            ctx.drawImage(video, 0, 0, w, h);
            requestAnimationFrame(draw);
          };
          draw();
        };
        video.currentTime = 0;
      } else {
        // Fallback: store original if small enough, else use a frame
        const reader = new FileReader();
        reader.onload = () => {
          URL.revokeObjectURL(objUrl);
          const base64 = reader.result;
          if (base64.length > 900000) {
            video.currentTime = video.duration / 2;
            const ctx = canvas.getContext('2d');
            video.onseeked = () => {
              ctx.drawImage(video, 0, 0, w, h);
              resolve(canvas.toDataURL('image/webp', 0.7));
            };
          } else {
            resolve(base64);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve('');
    };
  });
}
