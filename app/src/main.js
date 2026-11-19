// The editor: owns the state (photos, panels, caption, layout, size), wires
// every control, and calls the renderer. Also exposes the small command API
// that shots.js uses to apply a screenshot preset through the same code path
// a human user drives. Click a panel on the canvas to select it, drag to
// reposition its photo, wheel or slider to zoom.

import { drawCover } from './render.js';
import { SIZES, LAYOUTS, layoutPanelRects, panelIndexAtPoint } from './layouts.js';
import {
  loadPhotoFromFile,
  panPhotoFit,
  zoomPhotoFit,
  initialPhotoFit,
} from './photos.js';
import { PANEL_TINTS } from './grade.js';
import { CAPTION_FONTS } from './lettering.js';
import { exportCoverAsPng } from './export.js';
import { SHOT_NAMES, applyShotPreset } from './shots.js';
import { clamp, mulberry32 } from './util.js';

// ---- editor state ------------------------------------------------------

const state = {
  sizeId: 'square',
  layout: 'hero-left',
  caption: 'NIGHT DRIVE',
  kicker: 'the boulevard is open',
  fontId: 'impact',
  gradeStrength: 1,
  ruleUnderTitle: true,
  showRatingBox: true,
  ratingValue: '18',
  credit: 'a dusk city story',
  grainSeed: 7,
  panels: [], // { photo, fit, tintId } — see rebuildPanels()
  selectedPanel: 0,
  selectedPhoto: null,
};

const photos = []; // decoded sample/user photos, in load order

const dom = {
  photoInput: document.getElementById('photo-input'),
  photoStrip: document.getElementById('photo-strip'),
  fillAll: document.getElementById('fill-all'),
  assign: document.getElementById('assign'),
  panelBadge: document.getElementById('panel-badge'),
  panelPrev: document.getElementById('panel-prev'),
  panelNext: document.getElementById('panel-next'),
  panelZoom: document.getElementById('panel-zoom'),
  panelTint: document.getElementById('panel-tint'),
  panelReset: document.getElementById('panel-reset'),
  caption: document.getElementById('caption'),
  kicker: document.getElementById('kicker'),
  captionFont: document.getElementById('caption-font'),
  ruleToggle: document.getElementById('rule-toggle'),
  layoutSelect: document.getElementById('layout-select'),
  gradeStrength: document.getElementById('grade-strength'),
  credit: document.getElementById('credit'),
  ratingToggle: document.getElementById('rating-toggle'),
  surprise: document.getElementById('surprise'),
  exportBtn: document.getElementById('export'),
  status: document.getElementById('status'),
  canvas: document.getElementById('cover'),
};

// ---- state helpers -----------------------------------------------------

/** Panel list whose length matches the layout, preserving existing crops. */
function rebuildPanels() {
  const rects = layoutPanelRects(state.layout, 1080, 1080);
  const next = [];
  for (let i = 0; i < rects.length; i += 1) {
    next.push(state.panels[i] ?? { photo: null, fit: initialPhotoFit(), tintId: 'none' });
  }
  state.panels = next;
  state.selectedPanel = clamp(state.selectedPanel, 0, state.panels.length - 1);
}

/** Current canvas pixel size for the chosen post size. */
export function canvasSizeForSizeId(sizeId) {
  return SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
}

/** Resize the backing store and the CSS box to the chosen post size. */
function applyCanvasSize() {
  const size = canvasSizeForSizeId(state.sizeId);
  dom.canvas.width = size.w;
  dom.canvas.height = size.h;
  if (!document.body.classList.contains('shot')) {
    // Editor mode: CSS scales it down to fit the stage.
    dom.canvas.style.width = '';
    dom.canvas.style.height = '';
  } else {
    // Shot mode: the capture rig reads the canvas element at native size, so
    // give the element its full pixel size and let body.shot CSS crop any
    // viewport overflow.
    dom.canvas.style.width = `${size.w}px`;
    dom.canvas.style.height = `${heightForCss(size)}px`;
  }
}

function heightForCss(size) {
  return size.h;
}

/** Render the poster once, from the current state. */
export function render() {
  drawCover(dom.canvas, state);
}

// ---- photo intake ------------------------------------------------------

/** Load sample photos by URL (used by the shot presets). */
export function loadPhotosFromUrls(urls) {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`failed to load ${url}`));
          img.src = url;
        }),
    ),
  ).then((loaded) => {
    loaded.forEach((img) => photos.push(img));
    renderPhotoStrip();
    return photos;
  });
}

/** Wire the file input: decode every picked file into the photo strip. */
function handlePhotoFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return Promise.resolve();
  return Promise.all(files.map(loadPhotoFromFile))
    .then((bitmaps) => {
      bitmaps.forEach((b) => photos.push(b));
      if (!state.selectedPhoto && photos.length > 0) {
        state.selectedPhoto = photos[0];
      }
      renderPhotoStrip();
      render();
      setStatus(`${bitmaps.length} photo${bitmaps.length === 1 ? '' : 's'} added`);
    })
    .catch((err) => setStatus(`Could not read those files: ${err.message}`));
}

/** Rebuild the small thumbnails under the photo input. */
function renderPhotoStrip() {
  dom.photoStrip.textContent = '';
  photos.forEach((photo, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 128;
    thumb.height = 96;
    thumb.className = 'photo-thumb';
    if (state.selectedPhoto === photo) thumb.classList.add('selected');
    const tctx = thumb.getContext('2d');
    drawThumb(tctx, photo);
    thumb.addEventListener('click', () => {
      state.selectedPhoto = photos[i];
      renderPhotoStrip();
    });
    dom.photoStrip.appendChild(thumb);
  });
}

/** Cover-draw a photo into a 128x96 thumbnail canvas. */
function drawThumb(ctx, photo) {
  const { width: w, height: h } = ctx.canvas;
  const s = Math.max(w / photo.width, h / photo.height);
  const dw = photo.width * s;
  const dh = photo.height * s;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// ---- panel editing -----------------------------------------------------

/** The panel whose controls are shown; clamped against the panel count. */
function currentPanel() {
  rebuildPanels(); // defensive: keeps panels aligned if layout changed elsewhere
  return state.panels[state.selectedPanel];
}

/** Fill every panel with the selected photo, keeping each panel's crop. */
export function fillAllPanelsWithSelectedPhoto() {
  if (!state.selectedPhoto) {
    setStatus('Pick a photo first (click a thumbnail).');
    return;
  }
  state.panels.forEach((p) => {
    p.photo = state.selectedPhoto;
  });
  render();
  setStatus('All panels now use the selected photo.');
}

/** Put the selected photo into the selected panel only. */
export function assignSelectedPhotoToSelectedPanel() {
  const panel = currentPanel();
  if (!state.selectedPhoto) {
    setStatus('Pick a photo first (click a thumbnail).');
    return;
  }
  panel.photo = state.selectedPhoto;
  render();
  setStatus(`Photo placed in panel ${state.selectedPanel + 1}.`);
}

/** Select a panel and sync the panel controls to it. */
export function selectPanel(i) {
  state.selectedPanel = clamp(i, 0, state.panels.length - 1);
  syncPanelControls();
  render();
}

/** Sync the zoom slider and tint dropdown to the selected panel. */
function syncPanelControls() {
  dom.panelBadge.textContent = String(state.selectedPanel + 1);
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  dom.panelZoom.value = String(panel.fit.zoom ?? 1);
  dom.panelTint.value = panel.tintId;
}

/** Apply a list of [offsetX, offsetY] crop positions, panel by panel. */
export function applyCropNudges(nudges) {
  state.panels.forEach((panel, i) => {
    const nudge = nudges[i % nudges.length];
    if (!nudge) return;
    panel.fit.offsetX = clamp(nudge[0], 0, 1);
    panel.fit.offsetY = clamp(nudge[1], 0, 1);
  });
}

/** Give every panel its own tint from a list of tint ids. */
export function setPanelTints(tintIds) {
  state.panels.forEach((panel, i) => {
    panel.tintId = tintIds[i % tintIds.length] ?? 'none';
  });
}

/** Assign photos (from loadPhotosFromUrls) to panels: panel i gets photo
 *  assignments[i] (an index into the loaded list). */
export function assignSamplePhotosToPanels(photoList, assignments) {
  assignments.forEach((photoIndex, panelIndex) => {
    const photo = photoList[photoIndex];
    if (photo && state.panels[panelIndex]) state.panels[panelIndex].photo = photo;
  });
  state.selectedPhoto = photoList[0] ?? null;
}

// ---- canvas pointer editing ---------------------------------------------

/** Canvas click → select the panel under the pointer. */
function handleCanvasPointerDown(e) {
  const rect = dom.canvas.getBoundingClientRect();
  const scaleX = dom.canvas.width / rect.width;
  const scaleY = dom.canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const hit = panelIndexAtPoint(layoutPanelRects(state.layout, dom.canvas.width, dom.canvas.height), x, y);
  if (hit === -1) return;
  selectPanel(hit);
  if (e.pointerType === 'mouse' && e.button === 0) {
    drag.active = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    dom.canvas.setPointerCapture(e.pointerId);
  }
}

/** Drag moves the selected panel's photo within its crop. */
function handleCanvasPointerMove(e) {
  if (!drag.active) return;
  const panel = state.panels[state.selectedPanel];
  if (!panel || !panel.photo) return;
  const rect = dom.canvas.getBoundingClientRect();
  const scaleX = dom.canvas.width / rect.width;
  const scaleY = dom.canvas.height / rect.height;
  const dx = (e.clientX - drag.lastX) * scaleX;
  const dy = (e.clientY - drag.lastY) * scaleY;
  const rectNow = layoutPanelRects(state.layout, dom.canvas.width, dom.canvas.height)[state.selectedPanel];
  panel.fit = panPhotoFit(panel.fit, panel.photo, rectNow, dx, dy);
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  drag.moved = true;
  render();
}

function handleCanvasPointerUp(e) {
  drag.active = false;
  try {
    dom.canvas.releasePointerCapture(e.pointerId);
  } catch { /* already released */ }
}

const drag = { active: false, lastX: 0, lastY: 0, startFit: null, moved: false };

/** Wheel over the canvas zooms the selected panel's photo. */
function handleCanvasWheel(e) {
  const rect = dom.canvas.getBoundingClientRect();
  const scaleX = dom.canvas.width / rect.width;
  const scaleY = dom.canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const hit = panelIndexAtPoint(layoutPanelRects(state.layout, dom.canvas.width, dom.canvas.height), x, y);
  if (hit === -1) return;
  e.preventDefault();
  if (state.selectedPanel !== hit) selectPanel(hit);
  const panel = state.panels[hit];
  const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
  panel.fit = zoomPhotoFit(panel.fit, factor);
  syncPanelControls();
  render();
}

// ---- controls wiring -----------------------------------------------------

function wireControls() {
  dom.photoInput.addEventListener('change', (e) => {
    handlePhotoFiles(e.target.files);
    e.target.value = '';
  });
  dom.fillAll.addEventListener('click', fillAllPanelsWithSelectedPhoto);
  dom.assign.addEventListener('click', assignSelectedPhotoToSelectedPanel);

  dom.panelPrev.addEventListener('click', () => selectPanel(state.selectedPanel - 1));
  dom.panelNext.addEventListener('click', () => selectPanel(state.selectedPanel + 1));
  dom.panelZoom.addEventListener('input', () => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    const target = Number(dom.panelZoom.value);
    const factor = target / (panel.fit.zoom || 1);
    panel.fit = zoomPhotoFit(panel.fit, factor);
    render();
  });
  dom.panelTint.addEventListener('change', () => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.tintId = dom.panelTint.value;
    render();
  });
  dom.panelReset.addEventListener('click', () => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.fit = initialPhotoFit();
    dom.panelZoom.value = '1';
    render();
  });

  dom.caption.addEventListener('input', () => {
    state.caption = dom.caption.value;
    render();
  });
  dom.kicker.addEventListener('input', () => {
    state.kicker = dom.kicker.value;
    render();
  });
  dom.captionFont.addEventListener('change', () => {
    state.fontId = dom.captionFont.value;
    render();
  });
  dom.ruleToggle.addEventListener('click', () => {
    state.ruleUnderTitle = !state.ruleUnderTitle;
    dom.ruleToggle.classList.toggle('on', state.ruleUnderTitle);
    render();
  });

  dom.layoutSelect.addEventListener('change', () => {
    state.layout = dom.layoutSelect.value;
    rebuildPanels();
    syncPanelControls();
    render();
  });

  document.querySelectorAll('.size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSizeId(btn.dataset.size);
    });
  });

  dom.gradeStrength.addEventListener('input', () => {
    state.gradeStrength = Number(dom.gradeStrength.value);
    render();
  });
  dom.credit.addEventListener('input', () => {
    state.credit = dom.credit.value;
    render();
  });
  dom.ratingToggle.addEventListener('click', () => {
    state.showRatingBox = !state.showRatingBox;
    dom.ratingToggle.classList.toggle('on', state.showRatingBox);
    render();
  });
  dom.surprise.addEventListener('click', surpriseMe);

  dom.exportBtn.addEventListener('click', () => {
    const size = exportCoverAsPng(state, state.sizeId);
    setStatus(`Saved ${exportName(state, size)} — check your downloads.`);
  });
}

/** Deterministic filename for the status line (kept in step with export.js). */
function exportName(state, size) {
  const slug = state.caption.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cover';
  return `${slug}-${size.w}x${size.h}.png`;
}

/** Randomise layout, tints and grain seed — a one-click spread of looks. */
export function surpriseMe() {
  const rand = mulberry32(Date.now() % 2147483647);
  const layout = LAYOUTS[Math.floor(rand() * LAYOUTS.length)];
  state.layout = layout.id;
  rebuildPanels();
  const tintPool = PANEL_TINTS.map((t) => t.id);
  setPanelTints(Array.from({ length: state.panels.length }, () => tintPool[Math.floor(rand() * tintPool.length)]));
  state.grainSeed = Math.floor(rand() * 100000);
  state.fontId = CAPTION_FONTS[Math.floor(rand() * CAPTION_FONTS.length)].id;
  dom.captionFont.value = state.fontId;
  syncPanelControls();
  render();
  setStatus(`Surprise: ${layout.name} layout, fresh tints.`);
}

/** Switch the post size, resize the canvas and re-render. */
export function setSizeId(sizeId) {
  state.sizeId = sizeId;
  document.querySelectorAll('.size-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === sizeId);
  });
  applyCanvasSize();
  rebuildPanels();
  render();
}

/** One-line status message under the export button. */
export function setStatus(message) {
  dom.status.textContent = message;
}

// ---- boot ----------------------------------------------------------------

/** Populate the layout/tint/font dropdowns from the definitions. */
function populateSelects() {
  dom.layoutSelect.textContent = '';
  LAYOUTS.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    dom.layoutSelect.appendChild(opt);
  });
  dom.panelTint.textContent = '';
  PANEL_TINTS.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    dom.panelTint.appendChild(opt);
  });
  dom.captionFont.textContent = '';
  CAPTION_FONTS.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    dom.captionFont.appendChild(opt);
  });
}

/** Attach every listener and paint the first frame. */
function boot() {
  populateSelects();
  wireControls();
  rebuildPanels();
  applyCanvasSize();
  render();

  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot && SHOT_NAMES.includes(shot)) {
    // Cover shots frame the canvas alone; the editor shot keeps the studio
    // chrome so the capture shows the real working UI.
    if (shot !== 'editor') document.body.classList.add('shot');
    // Force layout now so applyShotPreset's element sizing is measured post-CSS.
    void document.body.offsetHeight;
    applyShotPreset(shot, query, editorApi);
  }
}

// The command API shots.js drives — same code paths as the buttons.
const editorApi = {
  loadPhotosFromUrls,
  setSizeId,
  setLayout(layoutId) {
    state.layout = layoutId;
    rebuildPanels();
    if (dom.layoutSelect) dom.layoutSelect.value = layoutId;
    syncPanelControls();
  },
  setCaption(text) {
    state.caption = text;
    if (dom.caption) dom.caption.value = text;
  },
  setKicker(text) {
    state.kicker = text;
    if (dom.kicker) dom.kicker.value = text;
  },
  setFontId(id) {
    state.fontId = id;
    if (dom.captionFont) dom.captionFont.value = id;
  },
  setPanelTints,
  assignSamplePhotosToPanels,
  applyCropNudges,
  render,
};

boot();
