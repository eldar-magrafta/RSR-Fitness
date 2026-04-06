// ── Personal Records Module ──
// Tracks, caches, and displays personal bests for every exercise.

import { exerciseData } from '../data/exercises.js';
import { getExHist, getPRs, savePRs } from './store.js';
import { exHistMaxWeight } from './utils.js';

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
          if (entry.sets && entry.sets.length) {
            const topSet = entry.sets.reduce((a, b) => (parseFloat(b.w) || 0) > (parseFloat(a.w) || 0) ? b : a);
            bestReps = parseInt(topSet.r) || 0;
            bestSets = entry.sets.length;
          } else {
            bestReps = parseInt(entry.r) || 0;
            bestSets = 1;
          }
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
export function checkForNewPR(exerciseName, newWeight, newReps, dateStr) {
  const prs = getPRs();
  const current = prs[exerciseName] || null;
  const curWeight = current ? current.weight : 0;
  if (newWeight > curWeight) {
    const previous = current ? { ...current } : null;
    prs[exerciseName] = { weight: newWeight, reps: newReps, sets: 0, date: dateStr };
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
      if (entry.sets && entry.sets.length) {
        const topSet = entry.sets.reduce((a, b) => (parseFloat(b.w) || 0) > (parseFloat(a.w) || 0) ? b : a);
        bestReps = parseInt(topSet.r) || 0;
        bestSets = entry.sets.length;
      } else {
        bestReps = parseInt(entry.r) || 0;
        bestSets = 1;
      }
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
