// ── Muscle Group Balance Report ──

import { state } from './state.js';
import { exerciseData } from '../data/exercises.js';
import { getExHist } from './store.js';
import { showView, setHeader } from './navigation.js';

const BALANCE_PAIRS = [
  { label: 'Push vs Pull', push: ['chest', 'shoulders', 'triceps'], pull: ['back_upper', 'back_lateral', 'back_lower', 'biceps'] },
  { label: 'Upper vs Lower', upper: ['chest', 'back_upper', 'back_lateral', 'shoulders', 'biceps', 'triceps', 'forearms'], lower: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'] },
  { label: 'Quads vs Hamstrings', push: ['quads'], pull: ['hamstrings'] },
  { label: 'Biceps vs Triceps', push: ['triceps'], pull: ['biceps'] },
];

function getDateRange(range) {
  const now = new Date();
  let start;
  if (range === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
  } else {
    start = new Date(now);
    start.setDate(now.getDate() - 29);
  }
  const toStr = d => d.toISOString().slice(0, 10);
  return { startDate: toStr(start), endDate: toStr(now) };
}

function computeBalance(range) {
  const { startDate, endDate } = getDateRange(range);
  const groupSets = {};

  Object.entries(exerciseData).forEach(([groupKey, group]) => {
    let totalSets = 0;
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      Object.entries(hist).forEach(([dateStr, entry]) => {
        if (dateStr < startDate || dateStr > endDate) return;
        totalSets += (entry.sets && entry.sets.length) ? entry.sets.length : 1;
      });
    });
    groupSets[groupKey] = totalSets;
  });

  return { groupSets, startDate, endDate };
}

function renderBalanceReport() {
  const { groupSets } = computeBalance(state.mbRange);
  const maxSets = Math.max(...Object.values(groupSets), 1);
  const totalSets = Object.values(groupSets).reduce((a, b) => a + b, 0);

  let html = `
    <div class="mb-range-row">
      <button class="summary-range-btn ${state.mbRange === 'week' ? 'active' : ''}" onclick="setMBRange('week')">Last 7 Days</button>
      <button class="summary-range-btn ${state.mbRange === 'month' ? 'active' : ''}" onclick="setMBRange('month')">Last 30 Days</button>
    </div>`;

  if (totalSets === 0) {
    html += `<div class="mb-empty">
      <div style="font-size:2.5rem;margin-bottom:12px;">&#x1f4aa;</div>
      <div>No exercises logged in this period.<br>Start training to see your balance report.</div>
    </div>`;
    document.getElementById('muscleBalanceContent').innerHTML = html;
    return;
  }

  // Muscle group bars
  html += `<div class="mb-section">
    <div class="mb-section-title">Sets Per Muscle Group</div>`;

  const sorted = Object.entries(exerciseData)
    .map(([key, group]) => ({ key, name: group.name, sets: groupSets[key] }))
    .sort((a, b) => b.sets - a.sets);

  sorted.forEach(g => {
    const pct = maxSets > 0 ? (g.sets / maxSets) * 100 : 0;
    const intensity = g.sets === 0 ? 'zero' : g.sets <= maxSets * 0.25 ? 'low' : g.sets >= maxSets * 0.75 ? 'high' : 'mid';
    html += `<div class="mb-bar-row">
      <div class="mb-bar-label">${g.name}</div>
      <div class="mb-bar-track">
        <div class="mb-bar-fill ${intensity}" style="width:${pct}%"></div>
      </div>
      <div class="mb-bar-val">${g.sets}</div>
    </div>`;
  });
  html += `</div>`;

  // Balance pairs
  html += `<div class="mb-section">
    <div class="mb-section-title">Balance Analysis</div>`;

  BALANCE_PAIRS.forEach(pair => {
    const leftKeys = pair.push || pair.upper;
    const rightKeys = pair.pull || pair.lower;
    const leftSets = leftKeys.reduce((s, k) => s + (groupSets[k] || 0), 0);
    const rightSets = rightKeys.reduce((s, k) => s + (groupSets[k] || 0), 0);
    const total = leftSets + rightSets;
    const leftPct = total > 0 ? Math.round((leftSets / total) * 100) : 50;
    const rightPct = 100 - leftPct;

    const leftLabel = pair.push ? 'Push' : 'Upper';
    const rightLabel = pair.pull ? 'Pull' : 'Lower';

    let status = 'balanced';
    let statusText = 'Balanced';
    if (total === 0) {
      statusText = 'No data';
      status = 'nodata';
    } else if (Math.abs(leftPct - 50) > 20) {
      status = 'imbalanced';
      statusText = leftPct > 50 ? `${leftLabel} dominant` : `${rightLabel} dominant`;
    } else if (Math.abs(leftPct - 50) > 10) {
      status = 'slight';
      statusText = leftPct > 50 ? `Slightly ${leftLabel.toLowerCase()}-heavy` : `Slightly ${rightLabel.toLowerCase()}-heavy`;
    }

    html += `<div class="mb-pair-card">
      <div class="mb-pair-header">
        <span class="mb-pair-title">${pair.label}</span>
        <span class="mb-pair-status ${status}">${statusText}</span>
      </div>
      <div class="mb-pair-bar-wrap">
        <div class="mb-pair-bar">
          <div class="mb-pair-left" style="width:${leftPct}%"></div>
          <div class="mb-pair-right" style="width:${rightPct}%"></div>
        </div>
        <div class="mb-pair-labels">
          <span>${leftLabel} ${leftSets}s (${leftPct}%)</span>
          <span>${rightLabel} ${rightSets}s (${rightPct}%)</span>
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;

  // Neglected groups
  const neglected = sorted.filter(g => g.sets === 0);
  if (neglected.length > 0) {
    html += `<div class="mb-section mb-neglected">
      <div class="mb-section-title">Untrained Muscle Groups</div>
      <div class="mb-neglected-list">
        ${neglected.map(g => `<span class="mb-neglected-tag">${g.name}</span>`).join('')}
      </div>
    </div>`;
  }

  document.getElementById('muscleBalanceContent').innerHTML = html;
}

export function openMuscleBalance() {
  showView('muscleBalanceView');
  setHeader('Muscle Balance', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'muscle-balance';
  renderBalanceReport();
}

export function setMBRange(range) {
  state.mbRange = range;
  renderBalanceReport();
}
