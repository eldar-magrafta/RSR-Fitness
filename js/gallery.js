// ── Progress Photos Gallery ──
// Timeline view of all body weight progress photos.

import { state } from './state.js';
import { getBWData, bwGetWeight, bwGetPhotos, bwHasPhoto } from './store.js';
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
    .filter(([, val]) => bwHasPhoto(val))
    .sort(([a], [b]) => b.localeCompare(a));

  if (photoDates.length === 0) {
    container.innerHTML = '<div class="gallery-empty">No progress photos yet. Add photos from the Body Weight tab.</div>';
    return;
  }

  let html = '';
  for (const [dateStr, val] of photoDates) {
    const weight = bwGetWeight(val);
    const photos = bwGetPhotos(val);
    html += `<div class="gallery-group">
      <div class="gallery-group-header">
        <span class="gallery-date">${fmtDateLabel(dateStr)}</span>
        ${weight ? `<span class="gallery-weight">${weight.toFixed(1)} kg</span>` : ''}
      </div>
      <div class="gallery-group-photos" id="gallery-${dateStr}"></div>
    </div>`;
  }
  container.innerHTML = html;

  // Load photos asynchronously
  for (const [dateStr, val] of photoDates) {
    const photos = bwGetPhotos(val);
    const row = document.getElementById('gallery-' + dateStr);

    photos.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const img = document.createElement('img');
      img.className = 'gallery-img';
      img.alt = `${dateStr} #${i + 1}`;
      card.appendChild(img);
      row.appendChild(card);

      card.onclick = () => {
        if (!img.src || img.dataset.loading) return;
        document.getElementById('bwViewerImg').src = img.src;
        document.getElementById('bwViewer').classList.add('open');
      };

      if (p === 'cloud') {
        img.dataset.loading = '1';
        img.style.opacity = '0.3';
        loadPhoto('bw-photos', dateStr + '_' + i).then(base64 => {
          if (base64) {
            delete img.dataset.loading;
            img.style.opacity = '';
            img.src = base64;
          } else if (i === 0) {
            return loadPhoto('bw-photos', dateStr).then(legacy => {
              delete img.dataset.loading;
              img.style.opacity = '';
              if (legacy) img.src = legacy;
              else card.classList.add('gallery-offline');
            });
          } else {
            delete img.dataset.loading;
            img.style.opacity = '';
            card.classList.add('gallery-offline');
          }
        });
      } else if (p) {
        img.src = p;
      }
    });
  }
}
