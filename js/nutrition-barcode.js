// ── Barcode Scanner (photo-based with BarcodeDetector + WASM polyfill) ──
// Scans a product barcode (live camera or uploaded photo), looks it up on
// OpenFoodFacts, and lets the user save it as a custom ingredient.

import { state } from './state.js';
import { getCustomIngs, saveCustomIngs } from './store.js';
import { escHtml, resizeImage, initModalSwipeDismiss } from './utils.js';
import { savePhoto } from './storage.js';
import { showToast } from './toast.js';
import { cloudImgCache } from './nutrition-shared.js';
import { renderNLPicker } from './nutrition.js';

let _barcodeDetectorClass = null;

async function _getBarcodeDetector() {
  if (_barcodeDetectorClass) return _barcodeDetectorClass;
  if ('BarcodeDetector' in window) {
    _barcodeDetectorClass = window.BarcodeDetector;
    return _barcodeDetectorClass;
  }
  const mod = await import('https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js');
  _barcodeDetectorClass = mod.BarcodeDetector;
  return _barcodeDetectorClass;
}

let _scannerStream = null;
let _scannerInterval = null;

export async function nlOpenBarcodeScanner() {
  const overlay = document.getElementById('barcodeScannerOverlay');
  const video = document.getElementById('barcodeScannerVideo');
  overlay.classList.add('open');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    _scannerStream = stream;
    video.srcObject = stream;
    await video.play();
    _startScanLoop();
  } catch {
    overlay.classList.remove('open');
    alert('Could not access camera. Please check permissions.');
  }
}

async function _startScanLoop() {
  const BDClass = await _getBarcodeDetector();
  const detector = new BDClass({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const video = document.getElementById('barcodeScannerVideo');
  const canvas = document.getElementById('barcodeScannerCanvas');
  const ctx = canvas.getContext('2d');

  _scannerInterval = setInterval(async () => {
    if (video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    try {
      const results = await detector.detect(canvas);
      if (results.length) {
        const code = results[0].rawValue;
        nlCloseBarcodeScanner();
        document.getElementById('nlBarcodeInput').value = code;
        document.getElementById('nlBarcodeRow').style.display = '';
        nlSearchBarcode();
      }
    } catch {}
  }, 400);
}

export function nlCloseBarcodeScanner() {
  if (_scannerInterval) { clearInterval(_scannerInterval); _scannerInterval = null; }
  if (_scannerStream) { _scannerStream.getTracks().forEach(t => t.stop()); _scannerStream = null; }
  const video = document.getElementById('barcodeScannerVideo');
  if (video) video.srcObject = null;
  const overlay = document.getElementById('barcodeScannerOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Stop the camera + interval if the page is being hidden/closed without
// the user explicitly tapping the close button.
window.addEventListener('pagehide', () => { if (_scannerInterval || _scannerStream) nlCloseBarcodeScanner(); });

export async function nlBarcodeScanFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  try {
    const BDClass = await _getBarcodeDetector();
    const detector = new BDClass({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const bitmap = await createImageBitmap(file);
    const results = await detector.detect(bitmap);
    bitmap.close();
    if (!results.length) throw new Error('none');
    const code = results[0].rawValue;
    document.getElementById('nlBarcodeInput').value = code;
    document.getElementById('nlBarcodeRow').style.display = '';
    nlSearchBarcode();
  } catch {
    alert('Could not read barcode from photo. Make sure the barcode is clearly visible and in focus.');
  }
}

async function _fetchProductData(barcode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status === 0 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments || {};
    return {
      name: p.product_name || p.product_name_en || p.product_name_he || p.product_name_fr || 'Unknown Product',
      brand: p.brands || '',
      p: Math.round((n.proteins_100g || 0) * 10) / 10,
      c: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
      f: Math.round((n.fat_100g || 0) * 10) / 10,
      cal: Math.round(n['energy-kcal_100g'] || (n.energy_100g ? n.energy_100g / 4.184 : 0)),
      imageUrl: p.image_front_url || p.image_url || p.image_front_small_url || '',
    };
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw e;
    throw e;
  }
}

let _barcodeBusy = false;

export async function nlSearchBarcode() {
  const input = document.getElementById('nlBarcodeInput');
  const barcode = input.value.trim();
  if (!barcode || _barcodeBusy) return;
  _barcodeBusy = true;
  input.disabled = true;

  try {
    const result = await _fetchProductData(barcode);
    if (!result) {
      _showBarcodeNotFound(barcode);
      return;
    }
    _showBarcodeResult(result);
    input.value = '';
  } catch (err) {
    if (err.name === 'AbortError') {
      alert('Request timed out. Please try again.');
    } else {
      alert('Network error. Please check your connection and try again.');
    }
  } finally {
    _barcodeBusy = false;
    input.disabled = false;
  }
}

async function _fetchImageAsBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('image fetch failed');
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

function _showBarcodeResult(product) {
  state._barcodeProduct = product;
  state._barcodePhotoBase64 = null;
  const content = document.getElementById('barcodeResultContent');
  const brandDisplay = product.brand ? `${product.name} (${product.brand})` : product.name;
  content.innerHTML = `
    <div class="nl-custom-row">
      <div class="nl-custom-field" style="flex:1;">
        <label>Name</label>
        <input id="barcodeEditName" type="text" value="${escHtml(brandDisplay)}">
      </div>
    </div>
    <div class="nl-custom-row">
      <div class="nl-custom-field">
        <label>Protein (g)</label>
        <input id="barcodeEditP" type="number" step="0.1" value="${product.p}">
      </div>
      <div class="nl-custom-field">
        <label>Carbs (g)</label>
        <input id="barcodeEditC" type="number" step="0.1" value="${product.c}">
      </div>
    </div>
    <div class="nl-custom-row">
      <div class="nl-custom-field">
        <label>Fat (g)</label>
        <input id="barcodeEditF" type="number" step="0.1" value="${product.f}">
      </div>
      <div class="nl-custom-field">
        <label>Calories</label>
        <input id="barcodeEditCal" type="number" step="1" value="${product.cal}">
      </div>
    </div>
    <div class="nl-custom-photo-area">
      <input type="file" id="barcodePhotoInput" accept="image/*" style="display:none" onchange="nlBarcodePhotoSelected(this)">
      <div id="barcodePhotoArea">
        <button class="nl-custom-photo-btn" onclick="document.getElementById('barcodePhotoInput').click()">📷 Add Photo (optional)</button>
      </div>
    </div>
    <div style="font-size:0.78rem;color:var(--muted);margin-bottom:16px;text-align:center;">Values per 100g — edit if needed</div>
    <button class="nl-confirm-btn" onclick="nlSaveBarcodeAsCustom()">Add to Foods List</button>
  `;
  document.getElementById('barcodeResultOverlay').classList.add('open');
  setTimeout(() => document.getElementById('barcodeResultSheet').style.transform = 'translateY(0)', 10);

  if (product.imageUrl) {
    const requestUrl = product.imageUrl;
    _fetchImageAsBase64(requestUrl).then(base64 => {
      if (state._barcodeProduct !== product) return;
      if (state._barcodePhotoBase64) return;
      state._barcodePhotoBase64 = base64;
      const area = document.getElementById('barcodePhotoArea');
      if (!area) return;
      area.innerHTML = `
        <img src="${base64}" style="width:100%;max-height:160px;object-fit:cover;border-radius:14px;margin-bottom:8px;">
        <button class="nl-custom-photo-btn" onclick="nlRemoveBarcodePhoto()">Remove Photo</button>
      `;
    }).catch(() => {});
  }
}

export function nlBarcodePhotoSelected(input) {
  if (!input.files || !input.files[0]) return;
  resizeImage(input.files[0], 1200, 0.92, base64 => {
    state._barcodePhotoBase64 = base64;
    const area = document.getElementById('barcodePhotoArea');
    area.innerHTML = `
      <img src="${base64}" style="width:100%;max-height:160px;object-fit:cover;border-radius:14px;margin-bottom:8px;">
      <button class="nl-custom-photo-btn" onclick="nlRemoveBarcodePhoto()">Remove Photo</button>
    `;
  });
}

export function nlRemoveBarcodePhoto() {
  state._barcodePhotoBase64 = null;
  document.getElementById('barcodePhotoInput').value = '';
  document.getElementById('barcodePhotoArea').innerHTML =
    '<button class="nl-custom-photo-btn" onclick="document.getElementById(\'barcodePhotoInput\').click()">📷 Add Photo (optional)</button>';
}

function _showBarcodeNotFound(barcode) {
  state._barcodeProduct = null;
  const content = document.getElementById('barcodeResultContent');
  content.innerHTML = `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:2.5rem;margin-bottom:12px;">🔍</div>
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px;">Product Not Found</div>
      <div style="color:var(--muted);font-size:0.88rem;margin-bottom:20px;">
        Barcode <b>${escHtml(barcode)}</b> was not found in the database.
      </div>
      <button class="nl-add-ing-btn" onclick="nlCloseBarcodeResult();nlOpenCustomModal()">Create Custom Ingredient</button>
      <button class="nl-add-ing-btn" style="margin-top:8px;background:none;border-color:var(--border);" onclick="nlCloseBarcodeResult()">Close</button>
    </div>
  `;
  document.getElementById('barcodeResultOverlay').classList.add('open');
  setTimeout(() => document.getElementById('barcodeResultSheet').style.transform = 'translateY(0)', 10);
}

export function nlCloseBarcodeResult() {
  document.getElementById('barcodeResultSheet').style.transform = '';
  document.getElementById('barcodeResultOverlay').classList.remove('open');
  state._barcodeProduct = null;
  state._barcodePhotoBase64 = null;
}

export async function nlSaveBarcodeAsCustom() {
  const name = (document.getElementById('barcodeEditName').value || '').trim();
  const p = parseFloat(document.getElementById('barcodeEditP').value) || 0;
  const c = parseFloat(document.getElementById('barcodeEditC').value) || 0;
  const f = parseFloat(document.getElementById('barcodeEditF').value) || 0;
  const cal = Math.round(parseFloat(document.getElementById('barcodeEditCal').value) || 0);
  if (!name) { document.getElementById('barcodeEditName').focus(); return; }
  const customs = getCustomIngs();
  if (customs.some(x => x.name === name)) {
    nlCloseBarcodeResult();
    showToast(`"${name}" already exists`, { background: 'linear-gradient(135deg, var(--accent), var(--accent2))' });
    return;
  }
  const ingData = { name, cat: 'custom', p: Math.round(p * 10) / 10, c: Math.round(c * 10) / 10, f: Math.round(f * 10) / 10, cal };
  if (state._barcodePhotoBase64) {
    const docId = 'cing_' + Date.now();
    try {
      await savePhoto('custom-ing-photos', docId, state._barcodePhotoBase64);
      ingData.img = 'cloud:' + docId;
      cloudImgCache.set(`custom-ing-photos/${docId}`, state._barcodePhotoBase64);
    } catch {
      ingData.img = state._barcodePhotoBase64;
    }
  }
  customs.push(ingData);
  saveCustomIngs(customs);
  state._barcodePhotoBase64 = null;
  nlCloseBarcodeResult();
  showToast(`Added "${name}" to Foods List`, { background: 'linear-gradient(135deg, var(--green), #00c9a7)' });
  renderNLPicker();
}

// Swipe-to-dismiss for the barcode result sheet (called from app.js init).
export function initBarcodeSwipe() {
  initModalSwipeDismiss('barcodeResultOverlay', 'barcodeResultSheet', nlCloseBarcodeResult);
}
