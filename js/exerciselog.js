// ── Global Exercise Log Module ──
// Calendar view showing ALL exercise history across all exercises.

import { state } from './state.js';
import { getAllExHistByDate } from './store.js';
import { MONTHS, renderCalendarGrid } from './utils.js';
import { showView, setHeader } from './navigation.js';

export function openExerciseLog() {
  showView('exerciseLogView');
  setHeader('Exercise Log', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'exercise-log';
  const now = new Date();
  state.exLogCalYear = now.getFullYear();
  state.exLogCalMon = now.getMonth();
  state.exLogSelectedDate = null;
  renderExLogCal();
}

function renderExLogCal() {
  document.getElementById('exLogCalTitle').textContent =
    MONTHS[state.exLogCalMon] + ' ' + state.exLogCalYear;

  const allData = getAllExHistByDate();

  document.getElementById('exLogCalGrid').innerHTML = renderCalendarGrid(state.exLogCalYear, state.exLogCalMon, {
    hasData: ds => !!allData[ds],
    selected: state.exLogSelectedDate,
    disableFuture: true,
    onClick: 'exLogSelectDate',
    badge: ds => {
      const count = allData[ds] ? allData[ds].length : 0;
      return count > 0 ? `<span class="exlog-badge">${count}</span>` : '';
    },
  });

  if (state.exLogSelectedDate) {
    renderExLogDayDetail(state.exLogSelectedDate, allData[state.exLogSelectedDate] || []);
  } else {
    document.getElementById('exLogDayDetail').innerHTML = '';
  }
}

function renderExLogDayDetail(dateStr, exercises) {
  const container = document.getElementById('exLogDayDetail');
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  let html = `<div class="exlog-date-label">${label}</div>`;

  if (exercises.length === 0) {
    html += '<div class="exlog-empty">No exercises logged</div>';
    container.innerHTML = html;
    return;
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name));
  html += `<div class="exlog-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div>`;

  exercises.forEach(({ name, entry }) => {
    let setsHtml = '';
    if (entry.sets && entry.sets.length) {
      setsHtml = entry.sets.map(s =>
        `<span class="exlog-set">${parseFloat(s.w) || 0}kg &times; ${parseInt(s.r) || 0}</span>`
      ).join('');
    } else if (entry.w) {
      setsHtml = `<span class="exlog-set">${parseFloat(entry.w) || 0}kg &times; ${parseInt(entry.r) || 0}</span>`;
    }
    const notesHtml = entry.n ? `<div class="exlog-notes">${entry.n}</div>` : '';
    html += `<div class="exlog-exercise">
      <div class="exlog-ex-name">${name}</div>
      <div class="exlog-sets-row">${setsHtml}</div>
      ${notesHtml}
    </div>`;
  });

  container.innerHTML = html;
}

export function exLogPrevMonth() {
  if (state.exLogCalYear <= 2020 && state.exLogCalMon === 0) return;
  if (state.exLogCalMon === 0) { state.exLogCalMon = 11; state.exLogCalYear--; }
  else state.exLogCalMon--;
  state.exLogSelectedDate = null;
  renderExLogCal();
}

export function exLogNextMonth() {
  if (state.exLogCalYear >= 2035 && state.exLogCalMon === 11) return;
  if (state.exLogCalMon === 11) { state.exLogCalMon = 0; state.exLogCalYear++; }
  else state.exLogCalMon++;
  state.exLogSelectedDate = null;
  renderExLogCal();
}

export function exLogSelectDate(dateStr) {
  state.exLogSelectedDate = dateStr;
  renderExLogCal();
}
