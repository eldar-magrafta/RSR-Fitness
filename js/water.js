// ── Water Intake Tracker ──

import { state } from './state.js';
import { showView, setHeader } from './navigation.js';

const STORAGE_KEY_TARGET = 'trainer_water_target';
const STORAGE_KEY_INTAKE = 'trainer_water_intake';
const STORAGE_KEY_DATE = 'trainer_water_date';

function getTarget() {
  return parseFloat(localStorage.getItem(STORAGE_KEY_TARGET)) || 2.5;
}

function setTarget(liters) {
  localStorage.setItem(STORAGE_KEY_TARGET, liters.toString());
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getIntake() {
  const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
  if (savedDate !== getTodayKey()) {
    localStorage.setItem(STORAGE_KEY_DATE, getTodayKey());
    localStorage.setItem(STORAGE_KEY_INTAKE, '0');
    return 0;
  }
  return parseFloat(localStorage.getItem(STORAGE_KEY_INTAKE)) || 0;
}

function saveIntake(liters) {
  localStorage.setItem(STORAGE_KEY_DATE, getTodayKey());
  localStorage.setItem(STORAGE_KEY_INTAKE, Math.max(0, liters).toString());
}

export function openWaterView() {
  showView('waterView');
  setHeader('Water Intake', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'water';
  renderWaterView();
}

export function renderWaterView() {
  const target = getTarget();
  const intake = getIntake();
  const pct = Math.min(100, Math.round((intake / target) * 100));
  const container = document.getElementById('waterContent');

  container.innerHTML = `
    <div class="water-card">
      <div class="water-progress-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" class="water-ring-bg"/>
          <circle cx="60" cy="60" r="52" class="water-ring-fill" style="stroke-dashoffset:${326.7 - (326.7 * pct / 100)}"/>
        </svg>
        <div class="water-progress-text">
          <div class="water-progress-val">${intake.toFixed(1)}L</div>
          <div class="water-progress-label">of ${target.toFixed(1)}L</div>
        </div>
      </div>
      <div class="water-pct">${pct}%</div>
    </div>
    <div class="water-quick-row">
      <button class="water-quick-btn" onclick="waterAdd(0.15)">+150ml</button>
      <button class="water-quick-btn" onclick="waterAdd(0.25)">+250ml</button>
      <button class="water-quick-btn" onclick="waterAdd(0.5)">+500ml</button>
      <button class="water-quick-btn water-quick-btn-custom" onclick="waterAdd(1)">+1L</button>
    </div>
    <div class="water-undo-row">
      <button class="water-undo-btn" onclick="waterUndo()"><i class="bi bi-arrow-counterclockwise"></i> Undo Last</button>
      <button class="water-undo-btn" onclick="waterReset()"><i class="bi bi-x-circle"></i> Reset</button>
    </div>
    <div class="water-target-section">
      <div class="water-section-label">Daily Target</div>
      <div class="water-target-row">
        <button class="water-target-btn" onclick="waterAdjustTarget(-0.25)">−</button>
        <div class="water-target-display" id="waterTargetDisplay">${target.toFixed(2)}L</div>
        <button class="water-target-btn" onclick="waterAdjustTarget(0.25)">+</button>
      </div>
    </div>`;
}

let _lastAdd = 0;

export function waterAdd(amount) {
  const intake = getIntake() + amount;
  _lastAdd = amount;
  saveIntake(intake);
  renderWaterView();
}

export function waterUndo() {
  if (_lastAdd <= 0) return;
  const intake = getIntake() - _lastAdd;
  saveIntake(intake);
  _lastAdd = 0;
  renderWaterView();
}

export function waterReset() {
  saveIntake(0);
  _lastAdd = 0;
  renderWaterView();
}

export function waterAdjustTarget(delta) {
  const target = Math.max(0.5, getTarget() + delta);
  setTarget(target);
  renderWaterView();
}
