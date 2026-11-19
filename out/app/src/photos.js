// Photo intake and crop maths. Each panel stores an offset and zoom into one
// source photo; cropRectForPanel turns those into the source rectangle to
// draw, cover-fit so every photo always fills its panel with no gaps.

import { clamp } from './util.js';

/**
 * Reads a File (or Blob) into a decoded image, downscaling anything larger
 * than MAX_SOURCE_EDGE so huge phone photos stay fast to re-draw.
 */
export async function loadPhotoFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_SOURCE_EDGE) return bitmap;
  const scale = MAX_SOURCE_EDGE / longest;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

/** Longest allowed source edge, in pixels. */
export const MAX_SOURCE_EDGE = 1600;

export const PHOTO_FIT_DEFAULT_ZOOM = 1;

/** A fresh crop state: centred on the photo, zoomed to cover the panel. */
export function initialPhotoFit() {
  return { offsetX: 0.5, offsetY: 0.5, zoom: PHOTO_FIT_DEFAULT_ZOOM };
}

/** Intrinsic size of a loaded photo (ImageBitmap or canvas). */
export function photoSize(photo) {
  return { w: photo.width, h: photo.height };
}

/**
 * The source rectangle of `photo` that fills `panel` (canvas pixels), given
 * the panel's fit (offset 0..1 within the spare area, zoom above 1 = closer).
 * Computed directly from the fit, so it never drifts out of range.
 */
export function cropRectForPanel(photo, panel, fit) {
  const { w: pw, h: ph } = photoSize(photo);
  const panelAspect = panel.w / panel.h;
  const photoAspect = pw / ph;
  // Cover fit: the crop window uses the panel's aspect at base zoom 1.
  let cropW;
  let cropH;
  if (photoAspect > panelAspect) {
    cropH = ph;
    cropW = ph * panelAspect;
  } else {
    cropW = pw;
    cropH = pw / panelAspect;
  }
  const zoom = Math.max(PHOTO_FIT_DEFAULT_ZOOM, fit.zoom ?? PHOTO_FIT_DEFAULT_ZOOM);
  cropW /= zoom;
  cropH /= zoom;
  // Spare room the crop window can travel within, after zooming in.
  const spareX = Math.max(0, pw - cropW);
  const spareY = Math.max(0, ph - cropH);
  const offsetX = clamp(fit.offsetX ?? 0.5, 0, 1);
  const offsetY = clamp(fit.offsetY ?? 0.5, 0, 1);
  return {
    sx: offsetX * spareX,
    sy: offsetY * spareY,
    sw: cropW,
    sh: cropH,
  };
}

/** Pan the crop by canvas-pixel deltas, keeping the photo edge-locked. */
export function panPhotoFit(fit, photo, panel, dxCanvas, dyCanvas) {
  const crop = cropRectForPanel(photo, panel, fit);
  const drawScale = panel.w / crop.sw; // canvas px per source px
  const next = { ...fit };
  const { w: pw, h: ph } = photoSize(photo);
  if (pw > crop.sw) {
    const spareX = pw - crop.sw;
    const rangeX = spareX * drawScale; // pannable distance in canvas px
    next.offsetX = clamp(fit.offsetX - dxCanvas / rangeX, 0, 1);
  } else {
    next.offsetX = 0.5;
  }
  if (ph > crop.sh) {
    const spareY = ph - crop.sh;
    const rangeY = spareY * drawScale;
    next.offsetY = clamp(fit.offsetY - dyCanvas / rangeY, 0, 1);
  } else {
    next.offsetY = 0.5;
  }
  return next;
}

/** Multiply the zoom, clamped so the crop can never exceed the photo. */
export function zoomPhotoFit(fit, factor) {
  return { ...fit, zoom: clamp((fit.zoom ?? 1) * factor, 1, 4) };
}
