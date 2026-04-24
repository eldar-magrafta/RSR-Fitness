// ── Global Exercise Log Module ──
// Calendar view showing ALL exercise history across all exercises.

import { state } from './state.js';
import { getAllExHistByDate } from './store.js';
import { MONTHS } from './utils.js';
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
  const today = new Date().toISOString().slice(0, 10);
  const firstDow = new Date(state.exLogCalYear, state.exLogCalMon, 1).getDay();
  const daysInMonth = new Date(state.exLogCalYear, state.exLogCalMon + 1, 0).getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(d => `<div class="bw-cal-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDow; i++)
    html += '<div class="bw-cal-day cal-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${state.exLogCalYear}-${String(state.exLogCalMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFuture = ds > today;
    const hasData = !!allData[ds];
    const isSelected = ds === state.exLogSelectedDate;
    const cls = ['bw-cal-day',
      isFuture ? 'future' : '',
      ds === today ? 'today' : '',
      hasData ? 'has-data' : '',
      isSelected ? 'selected' : '',
    ].filter(Boolean).join(' ');
    const count = allData[ds] ? allData[ds].length : 0;
    const badge = count > 0 ? `<span class="exlog-badge">${count}</span>` : '';
    html += `<div class="${cls}"${isFuture ? '' : ` onclick="exLogSelectDate('${ds}')"`}>${d}${badge}</div>`;
  }

  const remain = 42 - (firstDow + daysInMonth);
  for (let i = 0; i < remain; i++)
    html += '<div class="bw-cal-day cal-empty"></div>';

  document.getElementById('exLogCalGrid').innerHTML = html;

  if (state.exLogSelectedDate && allData[state.exLogSelectedDate]) {
    renderExLogDayDetail(state.exLogSelectedDate, allData[state.exLogSelectedDate]);
  } else {
    document.getElementById('exLogDayDetail').innerHTML =
      '<div class="exlog-empty">Tap a day to see exercises</div>';
  }
}

function renderExLogDayDetail(dateStr, exercises) {
  const container = document.getElementById('exLogDayDetail');
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  exercises.sort((a, b) => a.name.localeCompare(b.name));

  let html = `<div class="exlog-date-label">${label}</div>`;
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
