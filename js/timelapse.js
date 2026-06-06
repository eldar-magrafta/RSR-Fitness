// ── Progress Photo Timelapse ──
// Stitches body-weight progress photos into a video, oldest → newest, using a
// canvas + MediaRecorder pipeline (no external libraries). Each photo is drawn
// "contained" onto a fixed portrait canvas with an optional date/weight caption,
// and the canvas stream is recorded in real time.

import { getBWData, bwGetWeight, bwGetPhotos, bwHasPhoto } from './store.js';
import { loadPhoto } from './storage.js';
import { fmtDateLabel } from './utils.js';

const CANVAS_W = 720;
const CANVAS_H = 960;

// Frame durations (ms) per speed option.
const SPEEDS = { slow: 800, normal: 500, fast: 300 };

let _busy = false;
let _lastBlobUrl = null;

function _sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function _pickMimeType() {
  const candidates = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* ignore */ }
  }
  return '';
}

// Resolve a date's first progress photo to a base64 string (or null).
async function _resolvePhoto(dateStr, marker) {
  if (marker !== 'cloud') return marker || null;
  const byIndex = await loadPhoto('bw-photos', dateStr + '_0');
  if (byIndex) return byIndex;
  return await loadPhoto('bw-photos', dateStr); // legacy single-photo doc
}

// Ordered list of { date, weight, marker } for every dated photo, oldest first.
function _photoEntries() {
  const data = getBWData();
  return Object.entries(data)
    .filter(([, val]) => bwHasPhoto(val))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, val]) => ({
      date: dateStr,
      weight: bwGetWeight(val),
      marker: bwGetPhotos(val)[0],
    }));
}

export function timelapsePhotoCount() {
  return _photoEntries().length;
}

// ── Modal open / close ──

export function openTimelapse() {
  const count = timelapsePhotoCount();
  if (count < 2) return;
  if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
  document.getElementById('tlCount').textContent = count;
  document.getElementById('tlResult').innerHTML = '';
  document.getElementById('tlGenerateBtn').style.display = '';
  document.getElementById('tlGenerateBtn').disabled = false;
  document.getElementById('tlProgress').style.display = 'none';
  document.getElementById('timelapseOverlay').classList.add('open');
}

export function closeTimelapse() {
  if (_busy) return; // don't allow closing mid-render
  document.getElementById('timelapseOverlay').classList.remove('open');
}

// ── Generation ──

export async function generateTimelapse() {
  if (_busy) return;
  const mime = _pickMimeType();
  if (mime === null) {
    alert('Your browser does not support video recording. Try Chrome on Android or a desktop browser.');
    return;
  }

  const speedSel = document.querySelector('input[name="tlSpeed"]:checked');
  const speed = speedSel ? speedSel.value : 'normal';
  const frameMs = SPEEDS[speed] || SPEEDS.normal;
  const showCaption = document.getElementById('tlCaption').checked;

  const entries = _photoEntries();
  if (entries.length < 2) return;

  _busy = true;
  const genBtn = document.getElementById('tlGenerateBtn');
  const progress = document.getElementById('tlProgress');
  const progressBar = document.getElementById('tlProgressBar');
  const progressTxt = document.getElementById('tlProgressTxt');
  genBtn.disabled = true;
  genBtn.style.display = 'none';
  document.getElementById('tlResult').innerHTML = '';
  progress.style.display = '';
  progressTxt.textContent = 'Loading photos…';
  progressBar.style.width = '0%';

  try {
    // 1) Resolve + preload all photos into Image objects.
    const frames = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const base64 = await _resolvePhoto(e.date, e.marker);
      if (!base64) continue; // offline/missing — skip
      const img = await _loadImage(base64).catch(() => null);
      if (img) frames.push({ img, date: e.date, weight: e.weight });
      progressBar.style.width = `${Math.round(((i + 1) / entries.length) * 35)}%`;
    }

    if (frames.length < 2) {
      throw new Error('Not enough photos could be loaded (some may be offline). Connect to the internet and try again.');
    }

    // 2) Set up canvas + recorder.
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const opts = mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : {};
    const recorder = new MediaRecorder(stream, opts);
    const chunks = [];
    recorder.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const stopped = new Promise(res => { recorder.onstop = res; });

    recorder.start();

    // 3) Draw each frame and hold it in real time.
    progressTxt.textContent = 'Recording…';
    for (let i = 0; i < frames.length; i++) {
      _drawFrame(ctx, frames[i], showCaption);
      progressBar.style.width = `${35 + Math.round(((i + 1) / frames.length) * 60)}%`;
      await _sleep(frameMs);
    }
    // Hold the final frame a touch longer so it doesn't cut off abruptly.
    await _sleep(Math.max(600, frameMs));

    recorder.stop();
    await stopped;
    progressBar.style.width = '100%';
    progressTxt.textContent = 'Finishing…';

    // 4) Build the playable/downloadable result.
    const outType = (mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type: outType });
    const url = URL.createObjectURL(blob);
    _lastBlobUrl = url;
    const ext = outType.includes('mp4') ? 'mp4' : 'webm';

    progress.style.display = 'none';
    document.getElementById('tlResult').innerHTML = `
      <video class="tl-video" src="${url}" controls autoplay loop playsinline muted></video>
      <a class="tl-download-btn" href="${url}" download="progress-timelapse.${ext}">⬇ Download Video</a>
      <button class="tl-regen-btn" onclick="generateTimelapse()">↻ Regenerate</button>
    `;
  } catch (err) {
    progress.style.display = 'none';
    genBtn.style.display = '';
    genBtn.disabled = false;
    document.getElementById('tlResult').innerHTML =
      `<div class="tl-error">${(err && err.message) ? err.message : 'Could not create the video.'}</div>`;
  } finally {
    _busy = false;
  }
}

function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draw one photo "contained" on the canvas with a dark backdrop and caption.
function _drawFrame(ctx, frame, showCaption) {
  const { img, date, weight } = frame;
  // Backdrop.
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Contain the image within the canvas, preserving aspect ratio.
  const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
  const w = img.width * scale, h = img.height * scale;
  const x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  if (!showCaption) return;

  // Caption bar (date + weight) along the bottom.
  const barH = 92;
  const grad = ctx.createLinearGradient(0, CANVAS_H - barH, 0, CANVAS_H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, CANVAS_H - barH, CANVAS_W, barH);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 30px -apple-system, system-ui, sans-serif';
  ctx.fillText(fmtDateLabel(date), 28, CANVAS_H - 34);

  if (weight > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00e5ff';
    ctx.font = '800 34px -apple-system, system-ui, sans-serif';
    ctx.fillText(`${weight.toFixed(1)} kg`, CANVAS_W - 28, CANVAS_H - 32);
  }
}
