// ── Weekly / Monthly Summary Module ──

import { state } from './state.js';
import { exerciseData } from '../data/exercises.js';
import { getExHist, getBWData, bwGetWeight, getNLMeals } from './store.js';
import { exHistMaxWeight } from './utils.js';
import { showView, setHeader } from './navigation.js';

function getDateRange(range) {
  const now = new Date();
  let start, end;
  if (range === 'week') {
    const day = now.getDay(); // 0=Sun
    const diffToMon = day === 0 ? 6 : day - 1;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  const toStr = d => d.toISOString().slice(0, 10);
  return { startDate: toStr(start), endDate: toStr(end) };
}

function nlCalcMealTotals(meal) {
  let p = 0, c = 0, f = 0, cal = 0;
  (meal.ingredients || []).forEach(i => { const m = i.grams / 100; p += i.p * m; c += i.c * m; f += i.f * m; cal += i.cal * m; });
  return { p, c, f, cal };
}

function computeSummary(range) {
  const { startDate, endDate } = getDateRange(range);
  const workoutDates = new Set();
  const exVolumes = {};
  let totalVolume = 0;

  // Scan all exercises
  Object.values(exerciseData).forEach(group => {
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      Object.entries(hist).forEach(([dateStr, entry]) => {
        if (dateStr < startDate || dateStr > endDate) return;
        workoutDates.add(dateStr);
        let vol = 0;
        if (entry.sets && entry.sets.length) {
          entry.sets.forEach(s => { vol += (parseFloat(s.w) || 0) * (parseInt(s.r) || 0); });
        } else {
          vol = (parseFloat(entry.w) || 0) * (parseInt(entry.r) || 0);
        }
        totalVolume += vol;
        exVolumes[ex.name] = (exVolumes[ex.name] || 0) + vol;
      });
    });
  });

  // Top exercises by volume
  const topExercises = Object.entries(exVolumes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, volume]) => ({ name, volume: Math.round(volume) }));

  // Body weight trend
  const bwData = getBWData();
  const bwEntries = Object.entries(bwData)
    .filter(([d]) => d >= startDate && d <= endDate)
    .sort(([a], [b]) => a.localeCompare(b));
  let weightStart = null, weightEnd = null, weightDelta = null;
  if (bwEntries.length > 0) {
    weightStart = bwGetWeight(bwEntries[0][1]);
    weightEnd = bwGetWeight(bwEntries[bwEntries.length - 1][1]);
    weightDelta = Math.round((weightEnd - weightStart) * 10) / 10;
  }

  // Nutrition averages
  const meals = getNLMeals();
  const dailyNutr = {};
  meals.forEach(m => {
    if (!m.createdAt || m.createdAt < startDate || m.createdAt > endDate) return;
    const t = nlCalcMealTotals(m);
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

  return {
    workoutCount: workoutDates.size,
    totalVolume: Math.round(totalVolume),
    topExercises,
    weightStart, weightEnd, weightDelta,
    avgCalories, avgProtein, avgCarbs, avgFat, daysWithMeals,
    startDate, endDate
  };
}

export function openSummary() {
  showView('summaryView');
  setHeader('Summary', true);
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

    <div class="summary-stats">
      <div class="summary-stat-card">
        <div class="summary-stat-val">${s.workoutCount}</div>
        <div class="summary-stat-lbl">Workouts</div>
      </div>
      <div class="summary-stat-card">
        <div class="summary-stat-val">${s.totalVolume > 999 ? (s.totalVolume / 1000).toFixed(1) + 'k' : s.totalVolume}</div>
        <div class="summary-stat-lbl">Total Volume (kg)</div>
      </div>
    </div>`;

  // Top exercises
  if (s.topExercises.length > 0) {
    html += `<div class="summary-section">
      <div class="summary-section-title">Top Exercises</div>
      ${s.topExercises.map((e, i) => `<div class="summary-ex-item">
        <span class="summary-ex-name">${['🥇','🥈','🥉'][i]} ${e.name}</span>
        <span class="summary-ex-vol">${e.volume > 999 ? (e.volume / 1000).toFixed(1) + 'k' : e.volume} kg</span>
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
        <span>${s.weightStart} kg → ${s.weightEnd} kg</span>
        <span class="summary-weight-delta ${deltaClass}">${deltaStr} kg</span>
      </div>
    </div>`;
  }

  // Nutrition averages
  if (s.daysWithMeals > 0) {
    html += `<div class="summary-section">
      <div class="summary-section-title">Avg Daily Nutrition (${s.daysWithMeals} day${s.daysWithMeals > 1 ? 's' : ''})</div>
      <div class="summary-nutr-row"><span style="color:var(--accent)">Calories</span><span class="summary-nutr-val">${s.avgCalories}</span></div>
      <div class="summary-nutr-row"><span style="color:#4ecdc4">Protein</span><span class="summary-nutr-val">${s.avgProtein}g</span></div>
      <div class="summary-nutr-row"><span style="color:#ff6b6b">Carbs</span><span class="summary-nutr-val">${s.avgCarbs}g</span></div>
      <div class="summary-nutr-row"><span style="color:#ffd93d">Fat</span><span class="summary-nutr-val">${s.avgFat}g</span></div>
    </div>`;
  }

  // Empty state
  if (s.workoutCount === 0 && s.weightStart === null && s.daysWithMeals === 0) {
    html += `<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:2.5rem;margin-bottom:12px;">📊</div>
      <div style="font-size:0.95rem;line-height:1.6;">No data for this period yet.<br>Log workouts, meals, and weight to see your summary.</div>
    </div>`;
  }

  document.getElementById('summaryContent').innerHTML = html;
}

export function setSummaryRange(range) {
  state.summaryRange = range;
  renderSummary();
}
