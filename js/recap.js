// ── Weekly Recap Card ──
// Shows a 7-day summary at the top of the Nutrition tab.
// Dismissible; only re-appears once a new ISO week begins.

import { getNLMeals, getBWData, bwGetWeight } from './store.js';

const DISMISS_KEY = 'trainer_recap_dismissed_week';

/** ISO week number for a given date */
function isoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

function currentWeekKey() {
  const now = new Date();
  return `${now.getFullYear()}-W${isoWeek(now)}`;
}

function isDismissed() {
  return localStorage.getItem(DISMISS_KEY) === currentWeekKey();
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, currentWeekKey());
  const el = document.getElementById('nlRecapCard');
  if (el) el.remove();
}

/** Compute stats for the past 7 days */
function computeStats() {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Meals logged in the past 7 days
  const meals = getNLMeals().filter(m => m.type === 'logged' && dates.includes(m.createdAt));
  const totalMeals = meals.length;

  // Daily calories
  const calByDay = {};
  meals.forEach(m => {
    const cals = (m.ingredients || []).reduce((sum, ing) => {
      return sum + (ing.cal || 0) * (ing.grams || 0) / 100;
    }, 0);
    calByDay[m.createdAt] = (calByDay[m.createdAt] || 0) + cals;
  });
  const daysWithMeals = Object.keys(calByDay).length;
  const avgCals = daysWithMeals > 0 ? Math.round(Object.values(calByDay).reduce((a, b) => a + b, 0) / daysWithMeals) : 0;

  // Water: only today's data is available (no history stored)
  const waterDate = localStorage.getItem('trainer_water_date');
  const todayStr = today.toISOString().slice(0, 10);
  let waterToday = null;
  if (waterDate === todayStr) {
    waterToday = parseFloat(localStorage.getItem('trainer_water_intake')) || 0;
  }

  // Weight change: first vs last entry within the 7-day window
  const bwData = getBWData();
  const weekWeights = dates
    .filter(d => bwData[d] !== undefined)
    .map(d => ({ date: d, weight: bwGetWeight(bwData[d]) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let weightChange = null;
  if (weekWeights.length >= 2) {
    weightChange = +(weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight).toFixed(1);
  }

  return { totalMeals, avgCals, waterToday, weightChange };
}

/** Render the recap card into the nutrition view */
export function renderRecap() {
  // Remove old card if present
  const existing = document.getElementById('nlRecapCard');
  if (existing) existing.remove();

  if (isDismissed()) return;

  const { totalMeals, avgCals, waterToday, weightChange } = computeStats();

  // Don't show the card if there's absolutely no data
  if (totalMeals === 0 && waterToday === null && weightChange === null) return;

  const weightStr = weightChange !== null
    ? `${weightChange > 0 ? '+' : ''}${weightChange} kg`
    : '—';
  const weightClass = weightChange !== null
    ? (weightChange < 0 ? 'nl-recap-stat-green' : weightChange > 0 ? 'nl-recap-stat-red' : '')
    : '';

  const waterStr = waterToday !== null ? `${waterToday.toFixed(1)} L` : '—';

  const html = `
    <div class="nl-recap-card" id="nlRecapCard">
      <div class="nl-recap-header">
        <span class="nl-recap-title"><i class="bi bi-bar-chart-line"></i> Weekly Recap</span>
        <button class="nl-recap-close" onclick="dismissRecap()" title="Dismiss">&times;</button>
      </div>
      <div class="nl-recap-stats">
        <div class="nl-recap-stat">
          <div class="nl-recap-stat-val">${totalMeals}</div>
          <div class="nl-recap-stat-lbl">Meals</div>
        </div>
        <div class="nl-recap-stat">
          <div class="nl-recap-stat-val">${avgCals}</div>
          <div class="nl-recap-stat-lbl">Avg Cal</div>
        </div>
        <div class="nl-recap-stat">
          <div class="nl-recap-stat-val">${waterStr}</div>
          <div class="nl-recap-stat-lbl">Water Today</div>
        </div>
        <div class="nl-recap-stat">
          <div class="nl-recap-stat-val ${weightClass}">${weightStr}</div>
          <div class="nl-recap-stat-lbl">Weight</div>
        </div>
      </div>
    </div>`;

  const container = document.getElementById('nutritionView');
  container.insertAdjacentHTML('afterbegin', html);
}

export { dismiss as dismissRecap };
