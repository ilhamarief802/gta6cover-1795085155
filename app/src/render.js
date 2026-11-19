// The cover renderer: composes the black poster base, the photo panels, the
// per-panel tints, the sunset grade, the caption lettering and the small
// poster ornaments into one drawCover(canvas, state) call. The editor, the
// exports and the screenshot presets all render through this single path, so
// what you see is always exactly what exports.

import { layoutPanelRects } from './layouts.js';
import { cropRectForPanel } from './photos.js';
import { applySunsetGrade, applyPanelTint, drawVignette, drawGrain, tintById } from './grade.js';
import { drawCaption, drawKicker, drawKickerRules, fitCaptionToBox, fontById } from './lettering.js';

// Poster furniture, as fractions of the canvas, so it re-flows at every size.
const TITLE_BOX = { x: 0.07, y: 0.6, w: 0.86, h: 0.27 };
const TITLE_FLOOR = 0.11; // min title size as a fraction of box height
const KICKER_BOX = { x: 0.2, y: 0.525, w: 0.6, h: 0.06 };
const KICKER_SIZE = 0.42; // kicker px as a fraction of its box height
const RATING_SIZE = 0.075; // rating box edge as a fraction of the short side
const RATING_MARGIN = 0.045;
const CREDIT_SIZE = 0.018; // credit px as a fraction of the short side
const RULES_INSET = 0.16; // horizontal inset for the rule under the title

const INK = 'rgba(255, 255, 255, 0.92)';
const INK_DIM = 'rgba(255, 228, 190, 0.85)';
const HAIRLINE = 'rgba(255, 214, 160, 0.9)';

/**
 * Draw the whole cover for `state` onto `canvas`, at whatever pixel size the
 * canvas is set to. Pure w.r.t. state: nothing here mutates the editor state.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return;

  paintPosterBase(ctx, width, height);
  const rects = layoutPanelRects(state.layout, width, height);
  rects.forEach((rect, i) => {
    drawPanel(ctx, rect, state.panels[i]);
  });

  applySunsetGrade(ctx, width, height, { warmth: 1, contrast: 1, strength: state.gradeStrength });
  drawVignette(ctx, width, height);
  drawGrain(ctx, width, height, grainSeedFor(state));
  drawTitleBlock(ctx, width, height, state);
  drawOrnaments(ctx, width, height, state);
}

/** The black stock the poster prints on, visible as gutters and margins. */
function paintPosterBase(ctx, width, height) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, width, height);
}

/** One panel: photo crop, tint, inner shadow, hairline frame. */
function drawPanel(ctx, rect, panel) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (panel.photo) {
    const crop = cropRectForPanel(panel.photo, rect, panel.fit);
    ctx.drawImage(
      panel.photo,
      crop.sx, crop.sy, crop.sw, crop.sh,
      x, y, w, h,
    );
  } else {
    drawEmptyPanelPlaceholder(ctx, x, y, w, h);
  }

  applyPanelTint(ctx, rect, tintById(panel.tintId));
  ctx.restore();

  // Frame details painted outside the clip so they stay crisp.
  drawPanelInnerShadow(ctx, x, y, w, h);
  drawPanelHairline(ctx, x, y, w, h);
}

/** Photo-less panels get a graded dusk placeholder, not a hole. */
function drawEmptyPanelPlaceholder(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#241428');
  g.addColorStop(0.55, '#3c1430');
  g.addColorStop(1, '#58203c');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Faint diagonal stripes so an empty panel reads as "slot", not "bug".
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += Math.max(8, w / 12)) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.09)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PANEL', x + w / 2, y + h / 2);
}

/** Soft inner shadow along the panel's top edge, from the gutter light. */
function drawPanelInnerShadow(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + Math.min(h * 0.18, 40));
  g.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, Math.min(h * 0.18, 40));
}

/** One-pixel warm hairline framing each panel. */
function drawPanelHairline(ctx, x, y, w, h) {
  ctx.strokeStyle = 'rgba(255, 214, 160, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** The caption block: kicker, fitted title, and the thin rule under it. */
function drawTitleBlock(ctx, width, height, state) {
  const titleBox = {
    x: width * TITLE_BOX.x,
    y: height * TITLE_BOX.y,
    w: width * TITLE_BOX.w,
    h: height * TITLE_BOX.h,
  };
  const kickerBox = {
    x: width * KICKER_BOX.x,
    y: height * KICKER_BOX.y,
    w: width * KICKER_BOX.w,
    h: height * KICKER_BOX.h,
  };
  const fontDef = fontById(state.fontId);

  drawKicker(ctx, kickerBox, state.kicker, fontDef, kickerBox.h * KICKER_SIZE);
  if (state.kicker.trim()) drawKickerRules(ctx, kickerBox, fontDef, kickerBox.h * KICKER_SIZE);

  const fit = fitCaptionToBox(ctx, state.caption, titleBox, fontDef, {
    minSize: titleBox.h * TITLE_FLOOR,
    startSize: titleBox.h * 0.52,
  });
  drawCaption(ctx, titleBox, fit, fontDef);

  if (state.ruleUnderTitle) {
    drawTitleRule(ctx, titleBox, fit, fontDef);
  }
}

/** Thin warm rule under the title block, inset like a print ornament. */
function drawTitleRule(ctx, titleBox, fit, fontDef) {
  if (!fit || fit.lines.length === 0) return;
  const lineH = fit.size * fontDef.lineHeight;
  const blockH = fit.lines.length * lineH;
  const ruleY = titleBox.y + (titleBox.h - blockH) / 2 + blockH + titleBox.h * 0.06;
  const inset = titleBox.w * RULES_INSET;
  ctx.save();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = Math.max(1, titleBox.h * 0.012);
  ctx.beginPath();
  ctx.moveTo(titleBox.x + inset, ruleY);
  ctx.lineTo(titleBox.x + titleBox.w - inset, ruleY);
  ctx.stroke();
  ctx.restore();
}

/** Rating box (our own design) and the tiny credit line along the foot. */
function drawOrnaments(ctx, width, height, state) {
  const short = Math.min(width, height);
  if (state.showRatingBox) drawRatingBox(ctx, width, height, short, state);
  if (state.credit) drawCreditLine(ctx, width, height, short, state.credit);
}

/**
 * A bordered square with a number inside — poster furniture of our own
 * design, not any real ratings board's mark.
 */
function drawRatingBox(ctx, width, height, short, state) {
  const edge = short * RATING_SIZE;
  const m = short * RATING_MARGIN;
  const x = width - m - edge;
  const y = height - m - edge;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = 'rgba(10, 4, 14, 0.55)';
  ctx.lineWidth = Math.max(1.5, short * 0.004);
  ctx.fillRect(x, y, edge, edge);
  ctx.strokeRect(x, y, edge, edge);
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(edge * 0.52)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.ratingValue ?? '18', x + edge / 2, y + edge / 2 + edge * 0.02);
  ctx.restore();
}

/** Tiny credit line along the bottom-left, like a poster's imprint. */
function drawCreditLine(ctx, width, height, short, credit) {
  const px = Math.max(9, Math.round(short * CREDIT_SIZE));
  ctx.save();
  ctx.fillStyle = INK_DIM;
  ctx.font = `500 ${px}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = px * 0.6;
  ctx.fillText(credit.toUpperCase(), width * 0.045, height - short * RATING_MARGIN * 0.85);
  ctx.restore();
}

/** Seed for the grain pass, so Surprise-me renders are distinct but stable. */
function grainSeedFor(state) {
  return (state.grainSeed ?? 7) % 100000;
}
