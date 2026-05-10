// ── Water Intake Tracker ──

import { state } from './state.js';
import { showView, setHeader } from './navigation.js';

const STORAGE_KEY_TARGET = 'trainer_water_target';
const STORAGE_KEY_INTAKE = 'trainer_water_intake';
const STORAGE_KEY_DATE = 'trainer_water_date';
const STORAGE_KEY_BOTTLE = 'trainer_water_bottle';

function getTarget() {
  return parseFloat(localStorage.getItem(STORAGE_KEY_TARGET)) || 2.5;
}

function setTarget(liters) {
  localStorage.setItem(STORAGE_KEY_TARGET, liters.toString());
}

function getBottleSize() {
  return parseInt(localStorage.getItem(STORAGE_KEY_BOTTLE)) || 600;
}

function setBottleSize(ml) {
  localStorage.setItem(STORAGE_KEY_BOTTLE, ml.toString());
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
  const bottleMl = getBottleSize();
  const bottleLabel = bottleMl >= 1000 ? `+${(bottleMl / 1000).toFixed(bottleMl % 1000 === 0 ? 0 : 1)}L` : `+${bottleMl}ml`;
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
      <button class="water-quick-btn" onclick="waterAdd(1)">+1L</button>
      <button class="water-quick-btn water-quick-btn-bottle" onclick="waterAddBottle()"><i class="bi bi-cup-straw"></i> ${bottleLabel}</button>
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
    </div>
    <div class="water-bottle-section">
      <div class="water-section-label">My Bottle Size</div>
      <div class="water-target-row">
        <button class="water-target-btn" onclick="waterAdjustBottle(-50)">−</button>
        <div class="water-target-display" id="waterBottleDisplay">${bottleMl}ml</div>
        <button class="water-target-btn" onclick="waterAdjustBottle(50)">+</button>
      </div>
    </div>`;
}

let _lastAdd = 0;

export function waterAdd(amount) {
  const prevIntake = getIntake();
  const target = getTarget();
  const intake = prevIntake + amount;
  _lastAdd = amount;
  saveIntake(intake);
  renderWaterView();
  if (prevIntake < target && intake >= target) {
    showWaterCelebration();
  }
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

function showWaterCelebration() {
  const overlay = document.createElement('div');
  overlay.className = 'water-celebration';
  overlay.innerHTML = `
    <div class="water-drops">
      ${Array.from({ length: 20 }, (_, i) => `<div class="water-drop" style="--i:${i};--x:${Math.random() * 100}%;--delay:${Math.random() * 0.5}s;--size:${0.5 + Math.random() * 0.8}rem"></div>`).join('')}
    </div>
    <div class="water-celebration-text">
      <div class="water-celebration-icon">💧</div>
      <div class="water-celebration-msg">Target Reached!</div>
    </div>`;
  document.getElementById('waterView').appendChild(overlay);
  setTimeout(() => { overlay.classList.add('fade-out'); }, 2000);
  setTimeout(() => { overlay.remove(); }, 2500);
}

export function waterAdjustTarget(delta) {
  const target = Math.max(0.5, getTarget() + delta);
  setTarget(target);
  renderWaterView();
}

export function waterAddBottle() {
  const bottleMl = getBottleSize();
  waterAdd(bottleMl / 1000);
}

export function waterAdjustBottle(delta) {
  const current = getBottleSize();
  const next = Math.max(100, Math.min(2000, current + delta));
  setBottleSize(next);
  renderWaterView();
}
