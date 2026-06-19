// ── Global Exercise Log Module ──
// Calendar view showing ALL exercise history across all exercises.

import { state } from './state.js';
import { getAllExHistByDate, clearAllExerciseData } from './store.js';
import { MONTHS, renderCalendarGrid, openConfirmDialog, MIN_CAL_YEAR } from './utils.js';
import { showView, setHeader } from './navigation.js';
import { deleteCollection } from './cloud.js';

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
    html += `<div class="exlog-empty">
      <div class="exlog-empty-icon">🏋️</div>
      <div>No exercises logged on this day.</div>
    </div>`;
    container.innerHTML = html;
    return;
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name));
  html += `<div class="exlog-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div>`;

  exercises.forEach(({ name, entry }) => {
    let setsHtml = '';
    // A single stage chip: weight bold with a small muted "kg", then a faint × and reps.
    const stageChip = (w, r) =>
      `<span class="exlog-stage"><span class="exlog-stage-w">${parseFloat(w) || 0}<span class="exlog-unit">kg</span></span><span class="exlog-stage-x">&times;</span>${parseInt(r) || 0}</span>`;
    if (entry.sets && entry.sets.length) {
      setsHtml = entry.sets.map(s => {
        if (Array.isArray(s.drops) && s.drops.length) {
          // Drop set: a tinted block labelled "drop" holding one chip per stage.
          const stages = [s, ...s.drops].map(st => stageChip(st.w, st.r)).join('<span class="exlog-stage-sep">|</span>');
          return `<div class="exlog-set exlog-set-drop">
            <span class="exlog-drop-label">drop</span>
            <span class="exlog-drop-stages">${stages}</span>
          </div>`;
        }
        return `<span class="exlog-set">${stageChip(s.w, s.r)}</span>`;
      }).join('');
    } else if (entry.w) {
      setsHtml = `<span class="exlog-set">${stageChip(entry.w, entry.r)}</span>`;
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
  if (state.exLogCalYear <= MIN_CAL_YEAR && state.exLogCalMon === 0) return;
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

export function openDeleteAllExerciseData() {
  openConfirmDialog({
    title: 'Delete All Exercise Data?',
    message: 'This will permanently remove all exercise logs, notes, and personal records for every exercise. This cannot be undone.',
    confirmLabel: 'Yes, Delete Everything',
    onConfirm: () => {
      clearAllExerciseData();
      deleteCollection('exhist');
      deleteCollection('notes');
      state.exLogSelectedDate = null;
      renderExLogCal();
    },
  });
}
