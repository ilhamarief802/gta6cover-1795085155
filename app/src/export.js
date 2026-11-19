// PNG export: renders the cover at the chosen post size on a fresh canvas and
// triggers a download. The on-screen preview canvas may be a different size;
// the export always paints at full native pixels.

import { drawCover } from './render.js';
import { SIZES } from './layouts.js';

/**
 * Render the current state at `sizeId`'s native pixels and download it as a
 * PNG named `<slug>-<w>x<h>.png`. Returns the size actually exported.
 */
export function exportCoverAsPng(state, sizeId) {
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadNameFor(state, size);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
  return size;
}

/** Deterministic filename: `<caption-slug>-1080x1080.png`. */
export function downloadNameFor(state, size) {
  const slug = state.caption
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cover';
  return `${slug}-${size.w}x${size.h}.png`;
}
