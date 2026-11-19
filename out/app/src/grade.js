// The colour grade: the warm magenta-to-amber wash, per-panel duotone tints,
// contrast lift, vignette and print grain that pull raw photos together into
// one printed poster. Everything here paints with canvas gradients and tiny
// generated noise — no images, no filters, no network.

import { mulberry32 } from './util.js';

/** Named duotone tints, one per panel. `shadow` darkens, `light` brightens. */
export const PANEL_TINTS = [
  { id: 'none', name: 'None', shadow: [0, 0, 0], light: [255, 255, 255], strength: 0 },
  { id: 'magenta', name: 'Magenta', shadow: [64, 8, 60], light: [255, 214, 170], strength: 0.34 },
  { id: 'amber', name: 'Amber', shadow: [70, 26, 2], light: [255, 224, 160], strength: 0.34 },
  { id: 'teal', name: 'Teal', shadow: [4, 34, 46], light: [214, 255, 240], strength: 0.32 },
  { id: 'violet', name: 'Violet', shadow: [38, 6, 66], light: [255, 224, 255], strength: 0.32 },
  { id: 'cyan', name: 'Cyan', shadow: [2, 40, 60], light: [214, 244, 255], strength: 0.3 },
];

export function tintById(id) {
  return PANEL_TINTS.find((t) => t.id === id) ?? PANEL_TINTS[0];
}

/** Mix two rgb triples; t = 0 gives a, t = 1 gives b. */
function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const rgba = ([r, g, b], a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

/**
 * Sunset/neon grade over the whole cover: a warm magenta-to-amber vertical
 * wash plus a contrast lift. Painted with 'overlay' where supported so the
 * photo keeps its detail underneath; plain source over gives a similar wash.
 */
export function applySunsetGrade(ctx, width, height, grade) {
  const { warmth, contrast, strength } = grade;
  // Bottom-up magenta wash, strongest at the foot where the title sits.
  const foot = ctx.createLinearGradient(0, height * 0.3, 0, height);
  foot.addColorStop(0, rgba([255, 46, 122], 0));
  foot.addColorStop(1, rgba([214, 24, 106], 0.42 * strength));
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = foot;
  ctx.fillRect(0, 0, width, height);
  // Top-down amber light, so the sky end of the poster burns warm.
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  sky.addColorStop(0, rgba([255, 158, 44], 0.3 * strength));
  sky.addColorStop(1, rgba([255, 158, 44], 0));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // A soft cyan neon pool low-left, as if a sign sits just out of frame.
  const neon = ctx.createRadialGradient(
    width * 0.14, height * 0.86, 0,
    width * 0.14, height * 0.86, Math.max(width, height) * 0.55,
  );
  neon.addColorStop(0, rgba([38, 214, 255], 0.2 * strength * warmth));
  neon.addColorStop(1, rgba([38, 214, 255], 0));
  ctx.fillStyle = neon;
  ctx.fillRect(0, 0, width, height);
  applyContrastLift(ctx, width, height, contrast);
}

/** A full-canvas veil that gently darkens shadows and pops highlights. */
function applyContrastLift(ctx, width, height, amount) {
  if (amount <= 0) return;
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, rgba([255, 240, 220], 0.06 * amount));
  veil.addColorStop(0.55, rgba([16, 8, 24], 0));
  veil.addColorStop(1, rgba([24, 4, 28], 0.14 * amount));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);
}

/** Duotone a panel: multiply its shadows toward `shadow`, screen toward `light`. */
export function applyPanelTint(ctx, rect, tint) {
  if (!tint || tint.strength <= 0) return;
  const { x, y, w, h } = rect;
  const mid = mixRgb(tint.shadow, tint.light, 0.5);
  // Shadow end: darken toward the tint's shadow colour.
  const dark = ctx.createLinearGradient(x, y, x, y + h);
  dark.addColorStop(0, rgba(tint.shadow, 0.16 * tint.strength * 2));
  dark.addColorStop(1, rgba(mid, 0));
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  // Light end: lift toward the tint's light colour.
  const lift = ctx.createLinearGradient(x, y, x, y + h);
  lift.addColorStop(0, rgba(tint.light, 0));
  lift.addColorStop(1, rgba(tint.light, 0.14 * tint.strength * 2));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lift;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Darkened, vignetted corners: fades the poster's edges like a print. */
export function drawVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.36,
    width / 2, height / 2, Math.hypot(width, height) * 0.62,
  );
  g.addColorStop(0, 'rgba(8, 2, 12, 0)');
  g.addColorStop(1, 'rgba(8, 2, 12, 0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/** Deterministic print grain, from a seeded stream (never Math.random). */
export function drawGrain(ctx, width, height, seed = 7) {
  const step = Math.max(2, Math.round(Math.min(width, height) / 300));
  const rand = mulberry32(seed);
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const v = rand();
      if (v < 0.55) continue;
      const shade = v > 0.78 ? 255 : 0;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.12 + 0.2 * (v - 0.55)})`;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}
