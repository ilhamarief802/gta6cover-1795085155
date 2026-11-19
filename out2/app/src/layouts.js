// Poster layouts: each layout builds the panel rectangles, in pixels, for a
// canvas size. Every layout is one hero panel plus a few smaller ones, split
// by the black gutters that give the poster its street look. Coordinates are
// computed per size, so picking a post size re-flows the whole composition.

import { clamp } from './util.js';

const GUTTER_FRACTION = 0.02; // of the shorter canvas side
const MIN_GUTTER = 6;
const MAX_GUTTER = 26;

/** The black gutter width, in pixels, for a canvas of this size. */
export function gutterFor(width, height) {
  return Math.round(clamp(Math.min(width, height) * GUTTER_FRACTION, MIN_GUTTER, MAX_GUTTER));
}

/** A column of `rows` equal cells inside the box (x, y, w, h). */
function stackedCells(x, y, w, h, rows, g) {
  const rowH = (h - g * (rows - 1)) / rows;
  return Array.from({ length: rows }, (_, i) => ({
    x,
    y: y + i * (rowH + g),
    w,
    h: rowH,
  }));
}

/** A row of `cols` equal cells inside the box (x, y, w, h). */
function linedCells(x, y, w, h, cols, g) {
  const colW = (w - g * (cols - 1)) / cols;
  return Array.from({ length: cols }, (_, i) => ({
    x: x + i * (colW + g),
    y,
    w: colW,
    h,
  }));
}

/** Tall hero down the left, three stacked panels on the right. */
function buildHeroLeft(w, h, g) {
  const heroW = Math.round(w * 0.56);
  return [
    { x: 0, y: 0, w: heroW, h },
    ...stackedCells(heroW + g, 0, w - heroW - g, h, 3, g),
  ];
}

/** Mirror of hero-left: hero down the right. */
function buildHeroRight(w, h, g) {
  const heroW = Math.round(w * 0.56);
  return [
    ...stackedCells(0, 0, w - heroW - g, h, 3, g),
    { x: w - heroW, y: 0, w: heroW, h },
  ];
}

/** Plain 2x2 quad, equal panels. */
function buildQuad(w, h, g) {
  const colW = (w - g) / 2;
  const rowH = (h - g) / 2;
  return [
    { x: 0, y: 0, w: colW, h: rowH },
    { x: colW + g, y: 0, w: colW, h: rowH },
    { x: 0, y: rowH + g, w: colW, h: rowH },
    { x: colW + g, y: rowH + g, w: colW, h: rowH },
  ];
}

/** Wide hero across the top, three panels along the bottom. */
function buildTriptych(w, h, g) {
  const heroH = Math.round(h * 0.58);
  return [
    { x: 0, y: 0, w, h: heroH },
    ...linedCells(0, heroH + g, w, h - heroH - g, 3, g),
  ];
}

/** Wide hero across the top, four small panels along the bottom. */
function buildCinema(w, h, g) {
  const heroH = Math.round(h * 0.62);
  return [
    { x: 0, y: 0, w, h: heroH },
    ...linedCells(0, heroH + g, w, h - heroH - g, 4, g),
  ];
}

/** Big hero top-left, tall panel on the right, two panels along the bottom. */
function buildMosaic(w, h, g) {
  const heroW = Math.round(w * 0.6);
  const topH = Math.round(h * 0.62);
  const bottomH = h - topH - g;
  const bottomW = (w - g) / 2;
  return [
    { x: 0, y: 0, w: heroW, h: topH },
    { x: heroW + g, y: 0, w: w - heroW - g, h: topH },
    { x: 0, y: topH + g, w: bottomW, h: bottomH },
    { x: bottomW + g, y: topH + g, w: bottomW, h: bottomH },
  ];
}

export const LAYOUTS = [
  { id: 'hero-left', name: 'Hero left', build: buildHeroLeft },
  { id: 'hero-right', name: 'Hero right', build: buildHeroRight },
  { id: 'quad', name: 'Quad', build: buildQuad },
  { id: 'triptych', name: 'Triptych', build: buildTriptych },
  { id: 'cinema', name: 'Cinema', build: buildCinema },
  { id: 'mosaic', name: 'Mosaic', build: buildMosaic },
];

/** The three post sizes the app exports, labelled for the buttons. */
export const SIZES = [
  { id: 'square', label: 'Square 1080', w: 1080, h: 1080 },
  { id: 'story', label: 'Story 1080×1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920×1080', w: 1920, h: 1080 },
];

/** Panel rectangles, in pixels, for a layout on a canvas of this size. */
export function layoutPanelRects(layoutId, width, height) {
  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0];
  return layout.build(width, height, gutterFor(width, height));
}

/** Which panel rectangle contains this canvas point, or -1 for none. */
export function panelIndexAtPoint(rects, x, y) {
  return rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
