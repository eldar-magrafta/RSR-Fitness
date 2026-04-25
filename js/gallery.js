// ── Progress Photos Gallery ──
// Timeline view of all body weight progress photos.

import { state } from './state.js';
import { getBWData, bwGetWeight, bwGetPhoto } from './store.js';
import { loadPhoto } from './storage.js';
import { showView, setHeader } from './navigation.js';
import { fmtDateLabel } from './utils.js';

export function openGallery() {
  showView('galleryView');
  setHeader('Progress Photos', true);
  document.getElementById('fab').classList.add('hidden');
  state.navContext = 'gallery';
  renderGallery();
}

async function renderGallery() {
  const container = document.getElementById('galleryContent');
  const data = getBWData();

  const photoDates = Object.entries(data)
    .filter(([, val]) => bwGetPhoto(val))
    .sort(([a], [b]) => b.localeCompare(a));

  if (photoDates.length === 0) {
    container.innerHTML = '<div class="gallery-empty">No progress photos yet. Add photos from the Body Weight tab.</div>';
    return;
  }

  container.innerHTML = '<div class="gallery-grid" id="galleryGrid"></div>';
  const grid = document.getElementById('galleryGrid');

  for (const [dateStr, val] of photoDates) {
    const weight = bwGetWeight(val);
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const img = document.createElement('img');
    img.className = 'gallery-img';
    img.alt = dateStr;

    const info = document.createElement('div');
    info.className = 'gallery-info';
    info.innerHTML = `<div class="gallery-date">${fmtDateLabel(dateStr)}</div>` +
      (weight ? `<div class="gallery-weight">${weight.toFixed(1)} kg</div>` : '');

    card.appendChild(img);
    card.appendChild(info);
    grid.appendChild(card);

    card.onclick = () => {
      if (!img.src || img.dataset.loading) return;
      document.getElementById('bwViewerImg').src = img.src;
      document.getElementById('bwViewer').classList.add('open');
    };

    const photo = bwGetPhoto(val);
    if (photo === 'cloud') {
      img.dataset.loading = '1';
      img.style.opacity = '0.3';
      loadPhoto('bw-photos', dateStr).then(base64 => {
        delete img.dataset.loading;
        img.style.opacity = '';
        if (base64) {
          img.src = base64;
        } else {
          img.src = '';
          card.classList.add('gallery-offline');
          info.innerHTML += '<div class="gallery-offline-msg">Offline</div>';
        }
      });
    } else {
      img.src = photo;
    }
  }
}
