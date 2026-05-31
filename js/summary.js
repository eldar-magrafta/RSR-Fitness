// ── Activity Summary Module ──

import { state } from './state.js';
import { exerciseData } from '../data/exercises.js';
import { getExHist, getBWData, bwGetWeight, getNLMeals, getGoalsForDate } from './store.js';
import { calcMealTotals, dateToStr } from './utils.js';
import { showView, setHeader } from './navigation.js';

function getDateRange(range) {
  const now = new Date();
  let start, end;
  if (range === 'week') {
    // Calendar week: Sunday (start) → Saturday (end)
    const day = now.getDay(); // 0=Sun .. 6=Sat
    start = new Date(now);
    start.setDate(now.getDate() - day);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else {
    // Calendar month: 1st → last day of current month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  const toStr = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { startDate: toStr(start), endDate: toStr(end) };
}

function computeSummary(range) {
  const { startDate, endDate } = getDateRange(range);
  const workoutDates = new Set();
  const exSets = {};

  // Scan all exercises
  Object.values(exerciseData).forEach(group => {
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      Object.entries(hist).forEach(([dateStr, entry]) => {
        if (dateStr < startDate || dateStr > endDate) return;
        workoutDates.add(dateStr);
        let sets = 1;
        if (entry.sets && entry.sets.length) sets = entry.sets.length;
        exSets[ex.name] = (exSets[ex.name] || 0) + sets;
      });
    });
  });

  // Top 5 exercises by number of sets
  const topExercises = Object.entries(exSets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name]) => name);

  // Body weight entries for mini chart
  const bwData = getBWData();
  const bwEntries = Object.entries(bwData)
    .filter(([d]) => d >= startDate && d <= endDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => [d, bwGetWeight(v)])
    .filter(([, v]) => v > 0);

  let weightStart = null, weightEnd = null, weightDelta = null;
  if (bwEntries.length > 0) {
    weightStart = bwEntries[0][1];
    weightEnd = bwEntries[bwEntries.length - 1][1];
    weightDelta = Math.round((weightEnd - weightStart) * 10) / 10;
  }

  // Nutrition averages — respect selected calendar period (week or month)
  const meals = getNLMeals();
  const dailyNutr = {};
  meals.forEach(m => {
    if ((m.type || 'logged') !== 'logged') return;
    if (!m.createdAt || m.createdAt < startDate || m.createdAt > endDate) return;
    const t = calcMealTotals(m);
    if (!dailyNutr[m.createdAt]) dailyNutr[m.createdAt] = { cal: 0, p: 0, c: 0, f: 0 };
    dailyNutr[m.createdAt].cal += t.cal;
    dailyNutr[m.createdAt].p += t.p;
    dailyNutr[m.createdAt].c += t.c;
    dailyNutr[m.createdAt].f += t.f;
  });
  const daysWithMeals = Object.keys(dailyNutr).length;
  let avgCalories = 0, avgProtein = 0, avgCarbs = 0, avgFat = 0;
  if (daysWithMeals > 0) {
    const totals = Object.values(dailyNutr).reduce((acc, d) => ({ cal: acc.cal + d.cal, p: acc.p + d.p, c: acc.c + d.c, f: acc.f + d.f }), { cal: 0, p: 0, c: 0, f: 0 });
    avgCalories = Math.round(totals.cal / daysWithMeals);
    avgProtein = Math.round(totals.p / daysWithMeals);
    avgCarbs = Math.round(totals.c / daysWithMeals);
    avgFat = Math.round(totals.f / daysWithMeals);
  }

  // Deficit / surplus vs goals — averaged over logged days in the selected period
  let avgCalorieDiff = null; // positive = deficit (under goal), negative = surplus (over goal)
  if (daysWithMeals > 0) {
    let totalDiff = 0;
    Object.entries(dailyNutr).forEach(([dateStr, d]) => {
      const goals = getGoalsForDate(dateStr) || {};
      const goalCal = Number(goals.calories) || 0;
      totalDiff += (goalCal - d.cal);
    });
    avgCalorieDiff = Math.round(totalDiff / daysWithMeals);
  }

  return {
    workoutCount: workoutDates.size,
    topExercises,
    bwEntries, weightStart, weightEnd, weightDelta,
    avgCalories, avgProtein, avgCarbs, avgFat, daysWithMeals,
    avgCalorieDiff,
    startDate, endDate, range
  };
}

// ── Mini BW chart SVG ──

function renderMiniChart(entries) {
  if (entries.length < 2) return '<div style="text-align:center;color:var(--muted);font-size:0.8rem;padding:12px 0;">Not enough data for chart</div>';

  const W = 300, H = 80, P = { t: 8, r: 10, b: 18, l: 32 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const vals = entries.map(([, v]) => v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const spread = maxV - minV || 1;
  const xS = i => P.l + (i / (entries.length - 1)) * cW;
  const yS = v => P.t + cH - ((v - minV) / spread) * cH;
  const pts = entries.map(([d, v], i) => ({ x: xS(i), y: yS(v), d, v }));

  // Centered moving-average trend line (matches the main BW chart treatment).
  const winRadius = 3;
  const ma = vals.map((_, i) => {
    const a = Math.max(0, i - winRadius), b = Math.min(vals.length - 1, i + winRadius);
    let sum = 0, n = 0;
    for (let j = a; j <= b; j++) { sum += vals[j]; n++; }
    return sum / n;
  });
  const avgPath = ma.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xS(i).toFixed(1)} ${yS(v).toFixed(1)}`).join(' ');

  const yLbls = [minV, maxV].map(v =>
    `<text x="${P.l - 4}" y="${yS(v)}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="8" font-family="-apple-system,sans-serif">${v.toFixed(1)}</text>`
  ).join('');

  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="var(--accent)" opacity="0.85"/>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;">
    <path d="${avgPath}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    ${dots}
    ${yLbls}
  </svg>`;
}

export function openSummary() {
  showView('summaryView');
  setHeader('Activity Summary', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'summary';
  renderSummary();
}

export function renderSummary() {
  const s = computeSummary(state.summaryRange);
  const fmtDate = ds => { const [y, m, d] = ds.split('-'); return `${d}/${m}`; };
  const rangeLabel = `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`;

  let html = `
    <div class="summary-range-row">
      <button class="summary-range-btn ${state.summaryRange === 'week' ? 'active' : ''}" onclick="setSummaryRange('week')">This Week</button>
      <button class="summary-range-btn ${state.summaryRange === 'month' ? 'active' : ''}" onclick="setSummaryRange('month')">This Month</button>
    </div>
    <div style="text-align:center;color:var(--muted);font-size:0.8rem;margin-bottom:16px;">${rangeLabel}</div>

    <div class="summary-top-row">
      <div class="summary-stat-card">
        <div class="summary-stat-val">${s.workoutCount}</div>
        <div class="summary-stat-lbl">Workouts</div>
      </div>
      <div class="summary-bw-chart">
        ${renderMiniChart(s.bwEntries)}
      </div>
    </div>`;

  // Top 5 exercises by sets
  if (s.topExercises.length > 0) {
    html += `<div class="summary-section">
      <div class="summary-section-title">Top Exercises</div>
      ${s.topExercises.map((name, i) => `<div class="summary-ex-item">
        <span class="summary-ex-name">${['🥇','🥈','🥉','4.','5.'][i]} ${name}</span>
      </div>`).join('')}
    </div>`;
  }

  // Weight trend
  if (s.weightStart !== null) {
    const deltaStr = s.weightDelta > 0 ? `+${s.weightDelta}` : `${s.weightDelta}`;
    const deltaClass = s.weightDelta < 0 ? 'down' : s.weightDelta > 0 ? 'up' : '';
    html += `<div class="summary-section">
      <div class="summary-section-title">Weight Trend</div>
      <div class="summary-weight-row">
        <span>${s.weightStart} kg \u2192 ${s.weightEnd} kg</span>
        <span class="summary-weight-delta ${deltaClass}">${deltaStr} kg</span>
      </div>
    </div>`;
  }

  // Nutrition averages
  if (s.daysWithMeals > 0) {
    const periodLabel = s.range === 'week' ? 'This Week' : 'This Month';
    const periodWord = s.range === 'week' ? 'this week' : 'this month';
    html += `<div class="summary-section">
      <div class="summary-section-title">Avg Daily Nutrition (${periodLabel} \u2022 ${s.daysWithMeals} day${s.daysWithMeals === 1 ? '' : 's'} logged)</div>
      <div class="summary-nutr-row"><span class="color-accent">Calories</span><span class="summary-nutr-val">${s.avgCalories}</span></div>
      <div class="summary-nutr-row"><span class="color-protein">Protein</span><span class="summary-nutr-val">${s.avgProtein}g</span></div>
      <div class="summary-nutr-row"><span class="color-carbs">Carbs</span><span class="summary-nutr-val">${s.avgCarbs}g</span></div>
      <div class="summary-nutr-row"><span class="color-fat">Fat</span><span class="summary-nutr-val">${s.avgFat}g</span></div>`;
    if (s.avgCalorieDiff !== null) {
      const diff = s.avgCalorieDiff;
      if (diff > 0) {
        html += `<div class="summary-cal-balance deficit">You are in an average deficit of ${diff} calories per day ${periodWord}.</div>`;
      } else if (diff < 0) {
        html += `<div class="summary-cal-balance surplus">You are in an average surplus of ${Math.abs(diff)} calories per day ${periodWord}.</div>`;
      } else {
        html += `<div class="summary-cal-balance">You are meeting your calorie goal on average ${periodWord}.</div>`;
      }
    }
    html += `</div>`;
  }

  // Empty state
  if (s.workoutCount === 0 && s.weightStart === null && s.daysWithMeals === 0) {
    html += `<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:2.5rem;margin-bottom:12px;">\ud83d\udcca</div>
      <div style="font-size:0.95rem;line-height:1.6;">No data for this period yet.<br>Log workouts, meals, and weight to see your summary.</div>
    </div>`;
  }

  document.getElementById('summaryContent').innerHTML = html;
}

export function setSummaryRange(range) {
  state.summaryRange = range;
  renderSummary();
}
