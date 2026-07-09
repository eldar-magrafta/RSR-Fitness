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
  return { startDate: dateToStr(start), endDate: dateToStr(end) };
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

  // Deficit / surplus vs goals — averaged over logged days in the selected period.
  // Also accumulate average goal per macro so the summary can show progress.
  let avgCalorieDiff = null; // positive = deficit (under goal), negative = surplus (over goal)
  let avgGoalCal = 0, avgGoalP = 0, avgGoalC = 0, avgGoalF = 0;
  if (daysWithMeals > 0) {
    let totalDiff = 0, gCal = 0, gP = 0, gC = 0, gF = 0;
    Object.entries(dailyNutr).forEach(([dateStr, d]) => {
      const goals = getGoalsForDate(dateStr) || {};
      const goalCal = Number(goals.calories) || 0;
      totalDiff += (goalCal - d.cal);
      gCal += goalCal;
      gP += Number(goals.protein) || 0;
      gC += Number(goals.carbs) || 0;
      gF += Number(goals.fat) || 0;
    });
    avgCalorieDiff = Math.round(totalDiff / daysWithMeals);
    avgGoalCal = Math.round(gCal / daysWithMeals);
    avgGoalP = Math.round(gP / daysWithMeals);
    avgGoalC = Math.round(gC / daysWithMeals);
    avgGoalF = Math.round(gF / daysWithMeals);
  }

  return {
    workoutCount: workoutDates.size,
    topExercises,
    bwEntries, weightStart, weightEnd, weightDelta,
    avgCalories, avgProtein, avgCarbs, avgFat, daysWithMeals,
    avgCalorieDiff,
    avgGoalCal, avgGoalP, avgGoalC, avgGoalF,
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

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cx1 = p.x + (c.x - p.x) / 3, cx2 = c.x - (c.x - p.x) / 3;
    linePath += ` C ${cx1} ${p.y}, ${cx2} ${c.y}, ${c.x} ${c.y}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H - P.b} L ${pts[0].x} ${H - P.b} Z`;

  const yLbls = [minV, maxV].map(v =>
    `<text x="${P.l - 4}" y="${yS(v)}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="8" font-family="-apple-system,sans-serif">${v.toFixed(1)}</text>`
  ).join('');

  const dots = pts.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;">
    <defs><linearGradient id="smG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(233,69,96,0.3)"/>
      <stop offset="100%" stop-color="rgba(233,69,96,0.0)"/>
    </linearGradient></defs>
    <path d="${areaPath}" fill="url(#smG)"/>
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${yLbls}${dots}
  </svg>`;
}

// ── Avg-daily-nutrition visual: calorie ring + macro goal bars ──

// SVG donut showing avg calories vs avg goal. Falls back to a full ring
// (no goal arc) when no calorie goal was set in the period.
function renderCalorieRing(avgCal, goalCal) {
  const r = 52, circ = 2 * Math.PI * r, cx = 64, cy = 64;
  const pct = goalCal > 0 ? Math.min(avgCal / goalCal, 1) : 0;
  const over = goalCal > 0 && avgCal > goalCal;
  const ringColor = over ? 'var(--carbs)' : 'var(--accent)';
  const sub = goalCal > 0
    ? `<tspan>of ${goalCal}</tspan>`
    : `<tspan>cal/day</tspan>`;
  const progressArc = goalCal > 0
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="11"
        stroke-linecap="round" stroke-dasharray="${pct * circ} ${circ}"
        transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dasharray 0.5s ease;"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round"/>`;
  const pctLabel = goalCal > 0
    ? `<text x="${cx}" y="${cy + 30}" text-anchor="middle" fill="${over ? 'var(--carbs)' : 'var(--muted)'}" font-size="11" font-weight="700" font-family="-apple-system,sans-serif">${Math.round(pct * 100)}%${over ? ' over' : ''}</text>`
    : '';
  return `<svg viewBox="0 0 128 128" width="128" height="128" class="summary-cal-ring-svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--subtle-bg)" stroke-width="11"/>
    ${progressArc}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="var(--accent)" font-size="26" font-weight="800" font-family="-apple-system,sans-serif">${avgCal}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="var(--muted)" font-size="10" font-weight="600" font-family="-apple-system,sans-serif">${sub}</text>
    ${pctLabel}
  </svg>`;
}

// One macro row: colored label, value/goal, and a fill bar toward the goal.
function renderMacroBar(label, color, cur, goal, unit) {
  const pct = goal > 0 ? Math.min(Math.round(cur / goal * 100), 100) : 0;
  const goalTxt = goal > 0 ? ` <span class="summary-macro-goal">/ ${goal}${unit}</span>` : '';
  return `<div class="summary-macro-bar">
    <div class="summary-macro-bar-head">
      <span class="summary-macro-bar-name" style="color:${color}">${label}</span>
      <span class="summary-macro-bar-val">${cur}${unit}${goalTxt}</span>
    </div>
    <div class="summary-macro-bar-track">
      <div class="summary-macro-bar-fill" style="width:${pct}%;background:${color};"></div>
    </div>
  </div>`;
}

// ── Consistency heatmap ──
// GitHub-style grid of the last N weeks. Independent of the week/month toggle —
// it's a long-range view of training frequency. Each cell = one day, shaded by
// number of sets logged that day; current streak = consecutive trained days
// ending today (or yesterday, so a not-yet-trained today doesn't break it).

const HEATMAP_WEEKS = 18;

function computeHeatmap() {
  // Day -> total sets logged across all exercises.
  const setsByDay = {};
  Object.values(exerciseData).forEach(group => {
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      Object.entries(hist).forEach(([dateStr, entry]) => {
        const sets = (entry.sets && entry.sets.length) ? entry.sets.length : 1;
        setsByDay[dateStr] = (setsByDay[dateStr] || 0) + sets;
      });
    });
  });

  // Grid spans whole weeks (Sun..Sat). End on the Saturday of the current week
  // so today's column is always present; walk back up to HEATMAP_WEEKS columns.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayS = dateToStr(today);
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - today.getDay())); // Saturday of this week

  // Anchor the left edge at the user's registration week so the grid never
  // shows empty months from before they joined. Once the account is older than
  // HEATMAP_WEEKS the window caps at HEATMAP_WEEKS and rolls forward normally.
  let numWeeks = HEATMAP_WEEKS;
  if (state.regDate) {
    const reg = new Date(state.regDate); reg.setHours(0, 0, 0, 0);
    const regSunday = new Date(reg);
    regSunday.setDate(reg.getDate() - reg.getDay()); // Sunday of registration week
    const spanWeeks = Math.floor((gridEnd - regSunday) / (7 * 86400000)) + 1;
    numWeeks = Math.max(1, Math.min(HEATMAP_WEEKS, spanWeeks));
  }

  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - (numWeeks * 7 - 1));

  const weeks = [];
  const monthLabels = [];
  let trainedDays = 0;
  const cur = new Date(gridStart);
  for (let w = 0; w < numWeeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const ds = dateToStr(cur);
      const sets = setsByDay[ds] || 0;
      const future = ds > todayS;
      if (sets > 0 && !future) trainedDays++;
      // Label the column with the month name when its first day starts a month.
      if (d === 0) {
        if (cur.getDate() <= 7) monthLabels[w] = cur.toLocaleDateString('en-GB', { month: 'short' });
        else monthLabels[w] = '';
      }
      col.push({ date: ds, sets, future });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(col);
  }

  // Current streak: consecutive trained days ending today or yesterday.
  let streak = 0;
  const probe = new Date(today);
  if (!setsByDay[dateToStr(probe)]) probe.setDate(probe.getDate() - 1); // allow "not yet today"
  while (setsByDay[dateToStr(probe)]) {
    streak++;
    probe.setDate(probe.getDate() - 1);
  }

  return { weeks, monthLabels, trainedDays, streak, numWeeks, totalDays: numWeeks * 7 };
}

function renderHeatmap(hm) {
  const DOW = ['', 'M', '', 'W', '', 'F', '']; // sparse weekday labels (Sun..Sat)
  // Shade levels by sets-per-day.
  const level = sets => sets === 0 ? 0 : sets <= 6 ? 1 : sets <= 12 ? 2 : sets <= 20 ? 3 : 4;

  const dowCol = DOW.map(l => `<div class="summary-hm-dow">${l}</div>`).join('');
  const cols = hm.weeks.map((col, wi) => {
    const cells = col.map(c => {
      if (c.future) return `<div class="summary-hm-cell is-future"></div>`;
      const lv = level(c.sets);
      const title = c.sets > 0 ? `${c.date}: ${c.sets} set${c.sets === 1 ? '' : 's'}` : `${c.date}: rest`;
      return `<div class="summary-hm-cell" data-lv="${lv}" title="${title}"></div>`;
    }).join('');
    const mLbl = hm.monthLabels[wi] ? `<div class="summary-hm-month">${hm.monthLabels[wi]}</div>` : `<div class="summary-hm-month"></div>`;
    return `<div class="summary-hm-col">${mLbl}<div class="summary-hm-coldays">${cells}</div></div>`;
  }).join('');

  const legend = `<div class="summary-hm-legend">
    <span>Less</span>
    ${[0, 1, 2, 3, 4].map(l => `<div class="summary-hm-cell" data-lv="${l}"></div>`).join('')}
    <span>More</span>
  </div>`;

  return `<div class="summary-hm-stats">
      <div class="summary-hm-stat"><span class="summary-hm-stat-val">🔥 ${hm.streak}</span><span class="summary-hm-stat-lbl">day streak</span></div>
      <div class="summary-hm-stat"><span class="summary-hm-stat-val">${hm.trainedDays}</span><span class="summary-hm-stat-lbl">days in ${hm.numWeeks} wk${hm.numWeeks === 1 ? '' : 's'}</span></div>
    </div>
    <div class="summary-hm-scroll">
      <div class="summary-hm-grid">
        <div class="summary-hm-dowcol"><div class="summary-hm-month"></div>${dowCol}</div>
        ${cols}
      </div>
    </div>
    ${legend}`;
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

  // Consistency heatmap (range-independent long-range view)
  const hm = computeHeatmap();
  if (hm.trainedDays > 0) {
    html += `<div class="summary-section">
      <div class="summary-section-title">Workout Consistency</div>
      ${renderHeatmap(hm)}
    </div>`;
  }

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

  // Nutrition averages \u2014 calorie ring + macro goal bars
  if (s.daysWithMeals > 0) {
    const periodWord = s.range === 'week' ? 'this week' : 'this month';
    html += `<div class="summary-section summary-nutr-card">
      <div class="summary-nutr-card-head">
        <div class="summary-section-title" style="margin-bottom:0;">Avg Daily Nutrition</div>
        <span class="summary-nutr-days">${s.daysWithMeals} day${s.daysWithMeals === 1 ? '' : 's'} logged</span>
      </div>
      <div class="summary-nutr-body">
        <div class="summary-cal-ring">${renderCalorieRing(s.avgCalories, s.avgGoalCal)}</div>
        <div class="summary-macro-bars">
          ${renderMacroBar('Protein', 'var(--protein)', s.avgProtein, s.avgGoalP, 'g')}
          ${renderMacroBar('Carbs', 'var(--carbs)', s.avgCarbs, s.avgGoalC, 'g')}
          ${renderMacroBar('Fat', 'var(--fat)', s.avgFat, s.avgGoalF, 'g')}
        </div>
      </div>`;
    if (s.avgCalorieDiff !== null && s.avgGoalCal > 0) {
      const diff = s.avgCalorieDiff;
      if (diff > 0) {
        html += `<div class="summary-cal-balance deficit"><i class="bi bi-arrow-down-circle"></i> Average deficit of <b>${diff}</b> cal/day ${periodWord}.</div>`;
      } else if (diff < 0) {
        html += `<div class="summary-cal-balance surplus"><i class="bi bi-arrow-up-circle"></i> Average surplus of <b>${Math.abs(diff)}</b> cal/day ${periodWord}.</div>`;
      } else {
        html += `<div class="summary-cal-balance"><i class="bi bi-check-circle"></i> Meeting your calorie goal on average ${periodWord}.</div>`;
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
