// ── Personal Records Module ──
// Tracks, caches, and displays personal bests for every exercise.

import { exerciseData } from '../data/exercises.js';
import { getExHist, getPRs, savePRs } from './store.js';
import { exHistMaxWeight } from './utils.js';
import { showView, setHeader } from './navigation.js';
import { state } from './state.js';

function bestRepsAtWeight(entry, weight) {
  if (entry.sets && entry.sets.length) {
    let maxR = 0;
    entry.sets.forEach(s => { if ((parseFloat(s.w) || 0) === weight) maxR = Math.max(maxR, parseInt(s.r) || 0); });
    return maxR;
  }
  return parseInt(entry.r) || 0;
}

/** Rebuild the full PR cache from all exercise history. Call once at init. */
export function rebuildAllPRs() {
  const prs = {};
  Object.values(exerciseData).forEach(group => {
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      let bestWeight = 0, bestDate = null, bestReps = 0, bestSets = 0;
      Object.entries(hist).forEach(([dateStr, entry]) => {
        const maxW = exHistMaxWeight(entry);
        if (maxW > bestWeight) {
          bestWeight = maxW;
          bestDate = dateStr;
          bestReps = bestRepsAtWeight(entry, maxW);
          bestSets = entry.sets ? entry.sets.length : 1;
        }
      });
      if (bestWeight > 0 && bestDate) {
        prs[ex.name] = { weight: bestWeight, reps: bestReps, sets: bestSets, date: bestDate };
      }
    });
  });
  savePRs(prs);
  return prs;
}

/** Get PR for a single exercise from the cached map */
export function getPR(exerciseName) {
  const prs = getPRs();
  return prs[exerciseName] || null;
}

/** Check if a new weight beats the cached PR. Returns { isNew, previous }. Updates cache if new. */
export function checkForNewPR(exerciseName, newWeight, newReps, newSets, dateStr) {
  const prs = getPRs();
  const current = prs[exerciseName] || null;
  const curWeight = current ? current.weight : 0;
  if (newWeight > curWeight) {
    const previous = current ? { ...current } : null;
    prs[exerciseName] = { weight: newWeight, reps: newReps, sets: newSets, date: dateStr };
    savePRs(prs);
    return { isNew: true, previous };
  }
  return { isNew: false, previous: current };
}

/** Recalculate PR for a single exercise from its full history. Efficient for delete operations. */
export function recalcPR(exerciseName) {
  const prs = getPRs();
  const hist = getExHist(exerciseName);
  let bestWeight = 0, bestDate = null, bestReps = 0, bestSets = 0;
  Object.entries(hist).forEach(([dateStr, entry]) => {
    const maxW = exHistMaxWeight(entry);
    if (maxW > bestWeight) {
      bestWeight = maxW;
      bestDate = dateStr;
      bestReps = bestRepsAtWeight(entry, maxW);
      bestSets = entry.sets ? entry.sets.length : 1;
    }
  });
  if (bestWeight > 0 && bestDate) {
    prs[exerciseName] = { weight: bestWeight, reps: bestReps, sets: bestSets, date: bestDate };
  } else {
    delete prs[exerciseName];
  }
  savePRs(prs);
}

/** Returns a small HTML badge string if a PR exists, else '' */
export function renderPRBadge(exerciseName) {
  const pr = getPR(exerciseName);
  if (!pr) return '';
  return `<span class="pr-badge">PR ${pr.weight}kg</span>`;
}

/** Show a toast notification for a new PR */
export function showNewPRToast(exerciseName, weight) {
  const existing = document.querySelector('.pr-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'pr-toast';
  toast.textContent = `New PR! ${exerciseName}: ${weight}kg`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2600);
}

/** Open the Personal Records view from the burger menu */
export function openPRsView() {
  showView('prsView');
  setHeader('Personal Records', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'prs';

  const prs = getPRs();
  const entries = Object.entries(prs)
    .map(([name, pr]) => ({ name, ...pr }))
    .sort((a, b) => b.weight - a.weight);

  const container = document.getElementById('prsContent');

  if (entries.length === 0) {
    container.innerHTML = '<div class="prs-empty">No personal records yet. Log exercises to track your PRs.</div>';
    return;
  }

  let html = `<div class="prs-table">
    <div class="prs-header">
      <div class="prs-col-name">Exercise</div>
      <div class="prs-col-weight">Weight</div>
      <div class="prs-col-reps">Reps</div>
    </div>`;

  entries.forEach((pr, i) => {
    const medal = i < 3 ? ['🥇','🥈','🥉'][i] : '';
    html += `<div class="prs-row${i < 3 ? ' prs-top' : ''}">
      <div class="prs-col-name">${medal ? medal + ' ' : ''}${pr.name}</div>
      <div class="prs-col-weight">${pr.weight}<span class="prs-unit">kg</span></div>
      <div class="prs-col-reps">${pr.reps}</div>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}
