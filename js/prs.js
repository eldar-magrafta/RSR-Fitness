// ── Personal Records Module ──
// Tracks, caches, and displays personal bests for every exercise.

import { exerciseData } from '../data/exercises.js';
import { getExHist, getPRs, savePRs, getCustomExercises } from './store.js';
import { exHistMaxWeight } from './utils.js';
import { showView, setHeader } from './navigation.js';
import { state } from './state.js';
import { openExHistory } from './history.js';
import { showToast } from './toast.js';

/** Non-destructive check: would this weight be a new PR for this exercise?
 * Used by the session view to flash a gold glow on the row when the user
 * commits a PR set, without mutating the PR cache (commitSession does that).
 */
export function wouldBeNewPR(exerciseName, weight) {
  if (!weight || weight <= 0) return false;
  const prs = getPRs();
  const cur = prs[exerciseName];
  return !cur || weight > cur.weight;
}

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
  const allExercises = [
    ...Object.values(exerciseData).flatMap(g => g.exercises),
    ...getCustomExercises(),
  ];
  allExercises.forEach(ex => {
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

/** Show a toast notification for a new PR with confetti */
export function showNewPRToast(exerciseName, weight) {
  showToast(`🏆 New PR! ${exerciseName}: ${weight}kg`, { replace: true });
  showPRConfetti();
}

function showPRConfetti() {
  const container = document.createElement('div');
  container.className = 'pr-confetti-container';
  const s = getComputedStyle(document.documentElement);
  const colors = [
    s.getPropertyValue('--accent').trim() || '#00e5ff',
    s.getPropertyValue('--accent2').trim() || '#8b5cf6',
    s.getPropertyValue('--green').trim() || '#00e87b',
    '#ffc107', '#ff9f43',
    s.getPropertyValue('--carbs').trim() || '#ff6b6b',
  ];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'pr-confetti';
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--r', `${Math.random() * 360}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.4}s`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${6 + Math.random() * 6}px`;
    piece.style.height = `${4 + Math.random() * 8}px`;
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3000);
}

/** Tiny inline SVG sparkline of the user's max weight per session for an
 * exercise, last 8 sessions. Renders an empty placeholder if there's not
 * enough data. */
function _renderPRSparkline(exerciseName) {
  const hist = getExHist(exerciseName);
  const points = Object.entries(hist)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, e]) => exHistMaxWeight(e))
    .filter(w => w > 0)
    .slice(-8);
  if (points.length < 2) return '<span class="prs-spark-empty">—</span>';
  const W = 56, H = 18, P = 1;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xs = i => P + (i / (points.length - 1)) * (W - P * 2);
  const ys = v => H - P - ((v - min) / span) * (H - P * 2);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const area = `${path} L ${(W - P).toFixed(1)} ${H - P} L ${P} ${H - P} Z`;
  const trending = points[points.length - 1] >= points[0];
  const stroke = trending ? 'var(--green)' : 'var(--carbs)';
  return `<svg class="prs-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <path d="${area}" fill="${stroke}" opacity="0.15"/>
    <path d="${path}" stroke="${stroke}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${xs(points.length - 1).toFixed(1)}" cy="${ys(points[points.length - 1]).toFixed(1)}" r="1.8" fill="${stroke}"/>
  </svg>`;
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
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏆</div>
        <div class="empty-title">No PRs Yet</div>
        <div class="empty-sub">Your heaviest lift on each exercise will appear here as you log workouts.</div>
        <button class="empty-cta" onclick="switchTab('exercises')">Browse Exercises</button>
      </div>`;
    return;
  }

  let html = `<div class="prs-table">
    <div class="prs-header">
      <div class="prs-col-name">Exercise</div>
      <div class="prs-col-spark">Trend</div>
      <div class="prs-col-weight">Weight</div>
      <div class="prs-col-reps">Reps</div>
    </div>`;

  entries.forEach((pr, i) => {
    const medal = i < 3 ? ['🥇','🥈','🥉'][i] : '';
    const spark = _renderPRSparkline(pr.name);
    html += `<div class="prs-row prs-row-clickable${i < 3 ? ' prs-top' : ''}" data-pr-idx="${i}">
      <div class="prs-col-name">${medal ? medal + ' ' : ''}${pr.name}</div>
      <div class="prs-col-spark">${spark}</div>
      <div class="prs-col-weight">${pr.weight}<span class="prs-unit">kg</span></div>
      <div class="prs-col-reps">${pr.reps}</div>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;

  // Tapping a row opens that exercise's history, focused on the PR date.
  // Names can contain characters unsafe for inline onclick, so bind here.
  container.querySelectorAll('.prs-row-clickable').forEach(row => {
    row.onclick = () => {
      const pr = entries[parseInt(row.dataset.prIdx, 10)];
      if (!pr) return;
      openExHistory({ exerciseName: pr.name, jumpToDate: pr.date, origin: 'prs' });
    };
  });
}
