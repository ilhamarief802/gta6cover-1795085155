// Poster lettering: wraps the caption into up to three lines of heavy
// condensed capitals, fits the block to its box by shrinking toward a floor,
// and paints it with a dark stroke and drop shadow so it reads over any
// photo. System font stacks only — no web fonts, nothing fetched.

import { clamp } from './util.js';

export const CAPTION_FONTS = [
  {
    id: 'impact',
    name: 'Poster Condensed',
    stack: 'Impact, Haettenschweiler, "Franklin Gothic Bold", "Arial Narrow Bold", "Anton", sans-serif',
    tracking: 0.01,
    lineHeight: 0.94,
    weight: '400',
  },
  {
    id: 'system',
    name: 'Bold System',
    stack: 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
    tracking: 0.02,
    lineHeight: 1.02,
    weight: '800',
  },
  {
    id: 'serif',
    name: 'Serif Display',
    stack: 'Georgia, "Times New Roman", serif',
    tracking: 0.03,
    lineHeight: 1.04,
    weight: '700',
  },
];

export function fontById(id) {
  return CAPTION_FONTS.find((f) => f.id === id) ?? CAPTION_FONTS[0];
}

/** Break `text` into at most `maxLines` lines no wider than maxWidth. Any
 *  words that would spill onto a fourth line are absorbed into the last one
 *  (the fitter then shrinks the type until the block fits its box). */
export function wrapCaptionLines(ctx, text, maxWidth, maxLines) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let index = 0;
  for (let lineNo = 0; lineNo < maxLines && index < words.length; lineNo += 1) {
    const isLastLine = lineNo === maxLines - 1;
    let line = words[index];
    index += 1;
    while (index < words.length) {
      const candidate = `${line} ${words[index]}`;
      if (!isLastLine && ctx.measureText(candidate).width > maxWidth) break;
      line = candidate;
      index += 1;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Find the largest font size, in box pixels, whose wrapped lines all fit the
 * box width and whose block height fits the box height. Returns the lines
 * and the chosen size so the caller can paint without re-wrapping.
 */
export function fitCaptionToBox(ctx, text, box, fontDef, opts = {}) {
  const maxLines = opts.maxLines ?? 3;
  const minSize = opts.minSize ?? Math.max(12, box.h * 0.16);
  const startSize = opts.startSize ?? box.h * 0.52;
  let size = startSize;
  let attempt = null;
  while (size >= minSize) {
    ctx.font = `${fontDef.weight} ${Math.round(size)}px ${fontDef.stack}`;
    const lines = wrapCaptionLines(ctx, text, box.w, maxLines);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const blockH = lines.length * size * fontDef.lineHeight;
    const fitsWidth = widest <= box.w;
    const fitsHeight = blockH <= box.h;
    if (lines.length > 0 && fitsWidth && fitsHeight) {
      attempt = { lines, size: Math.round(size), width: widest };
      break;
    }
    size -= Math.max(1, size * 0.05);
  }
  if (!attempt) {
    // Floor: three lines at minSize, even if they crowd the box.
    ctx.font = `${fontDef.weight} ${Math.round(minSize)}px ${fontDef.stack}`;
    const lines = wrapCaptionLines(ctx, text, box.w, maxLines);
    attempt = { lines, size: Math.round(minSize), width: box.w };
  }
  return attempt;
}

/**
 * Paint the caption block inside `box` (canvas pixels). White heavy capitals
 * with a dark stroke and soft drop shadow, tight leading, slight tracking.
 */
export function drawCaption(ctx, box, fit, fontDef) {
  if (!fit || fit.lines.length === 0) return;
  const { size, lines } = fit;
  const lineH = size * fontDef.lineHeight;
  const tracking = size * fontDef.tracking;
  const blockH = lines.length * lineH;
  const startY = box.y + (box.h - blockH) / 2 + size * 0.8;
  const centerX = box.x + box.w / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontDef.weight} ${size}px ${fontDef.stack}`;

  // Drop shadow pass, offset before the white face pass.
  ctx.shadowColor = 'rgba(10, 2, 14, 0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.06;
  for (let i = 0; i < lines.length; i += 1) {
    paintTrackedLine(ctx, lines[i], centerX, startY + i * lineH, tracking);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Crisp dark outline, then the white face on top.
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.strokeStyle = 'rgba(16, 4, 20, 0.85)';
  for (let i = 0; i < lines.length; i += 1) {
    paintTrackedLine(ctx, lines[i], centerX, startY + i * lineH, tracking, true);
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i += 1) {
    paintTrackedLine(ctx, lines[i], centerX, startY + i * lineH, tracking);
  }
  ctx.restore();
}

/** Fill (and optionally stroke) one line with per-character tracking. */
function paintTrackedLine(ctx, line, centerX, baselineY, tracking, stroke = false) {
  const chars = [...line];
  const width =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    tracking * Math.max(0, chars.length - 1);
  let x = centerX - width / 2;
  for (const ch of chars) {
    if (stroke) ctx.strokeText(ch, x, baselineY);
    else ctx.fillText(ch, x, baselineY);
    x += ctx.measureText(ch).width + tracking;
  }
}

/** A small all-caps kicker line above the title, letterspaced and pale. */
export function drawKicker(ctx, box, text, fontDef, size) {
  const clean = text.trim().toUpperCase();
  if (!clean) return;
  const px = clamp(size ?? box.h, 10, box.h);
  ctx.save();
  ctx.font = `700 ${px}px ${fontDef.stack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const tracking = px * 0.42;
  ctx.fillStyle = 'rgba(255, 216, 160, 0.94)';
  ctx.shadowColor = 'rgba(10, 2, 14, 0.6)';
  ctx.shadowBlur = px * 0.3;
  const chars = [...clean];
  const width =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    tracking * Math.max(0, chars.length - 1);
  let x = box.x + box.w / 2 - width / 2;
  const baselineY = box.y + box.h / 2 + px * 0.36;
  for (const ch of chars) {
    ctx.fillText(ch, x, baselineY);
    x += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
}

/** Thin decorative rules flanking the kicker: the poster's little flourish. */
export function drawKickerRules(ctx, box, fontDef, size) {
  const px = clamp(size ?? box.h, 10, box.h);
  const gap = px * 1.6;
  const half = box.w * 0.16;
  const cy = box.y + box.h / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 216, 160, 0.8)';
  ctx.lineWidth = Math.max(1, px * 0.08);
  ctx.beginPath();
  ctx.moveTo(box.x + box.w / 2 - gap - half, cy);
  ctx.lineTo(box.x + box.w / 2 - gap, cy);
  ctx.moveTo(box.x + box.w / 2 + gap, cy);
  ctx.lineTo(box.x + box.w / 2 + gap + half, cy);
  ctx.stroke();
  ctx.restore();
}
