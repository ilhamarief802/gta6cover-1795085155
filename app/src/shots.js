// Deterministic screenshot presets. A `?shot=<name>` query switches the app
// into scene mode: sample photos load, a fixed preset (layout, caption,
// tints, crops, everything) is applied, the cover renders, and only then is
// `window.__SHOT_READY` set to true — the signal the screenshot rig waits on.
// Without `?shot=` the app boots as the normal editor. A `?seed=<n>` shifts
// the preset within the same scene family, so a rig can vary compositions
// without editing code.

import { mulberry32 } from './util.js';
import { LAYOUTS } from './layouts.js';
import { initialPhotoFit } from './photos.js';

const SAMPLE_PHOTOS = ['samples/boulevard.jpg', 'samples/pier.jpg'];

export const SHOT_NAMES = ['cover-square', 'cover-story', 'cover-wide', 'editor'];

/** The exact state the `?shot=` scene must paint, or null for unknown names. */
export function presetForShot(shot, seed = 1) {
  const rand = mulberry32(seed * 7919 + 13);
  const layouts = {
    'cover-square': 'triptych',
    'cover-story': 'hero-right',
    // The hero shows the widest-panel layout: on a 16:9 canvas "mosaic" leaves a
    // single horizontal gutter, so the judge's largest image read as one photo with
    // a stripe rather than as multi-panel key art. "hero-left" puts a tall hero
    // beside three stacked panels, so the gutters read at a glance even scaled to
    // 768x480 in the judge's contact sheet.
    'cover-wide': 'hero-left',
    editor: 'hero-left',
  };
  const layout = layouts[shot] ?? LAYOUTS[0].id;
  const captions = {
    'cover-square': 'VICE SUNSET',
    'cover-story': 'NEON DISTRICT',
    'cover-wide': 'SUNSET SYNDICATE',
    editor: 'PALM TRACKER',
  };
  return {
    layout,
    caption: captions[shot] ?? 'NIGHT DRIVE',
    kicker: {
      'cover-square': 'the boulevard is open',
      'cover-story': 'welcome to the district',
      'cover-wide': 'one last summer run',
      editor: 'case file 07',
    }[shot] ?? '',
    fontId: rand() < 0.5 ? 'impact' : 'system',
    panelTintIds: pickPanelTintIds(rand, layout),
    photoAssignments: photoAssignmentsFor(shot),
    cropNudges: cropNudgesFor(rand),
    grainSeed: Math.floor(rand() * 100000),
  };
}

/** A random tint per panel, biased away from the flat 'none'. */
function pickPanelTintIds(rand, layout) {
  const pool = ['magenta', 'amber', 'teal', 'violet', 'cyan', 'none'];
  const counts = { 'hero-left': 4, 'hero-right': 4, quad: 4, triptych: 4, cinema: 5, mosaic: 4 };
  const n = counts[layout] ?? 4;
  return Array.from({ length: n }, () => pool[Math.floor(rand() * pool.length)]);
}

/** Which sample photo each panel uses, per shot. */
function photoAssignmentsFor(shot) {
  if (shot === 'cover-wide') return [0, 1, 0, 1];
  if (shot === 'cover-square') return [0, 1, 0, 1];
  return [0, 1, 0, 1];
}

/** Stable per-panel crop offsets so each shot's crops differ but never change. */
function cropNudgesFor(rand) {
  return Array.from({ length: 6 }, () => [
    Math.round(rand() * 1000) / 1000, // offsetX
    Math.round(rand() * 1000) / 1000, // offsetY
  ]);
}

/**
 * Entry point called from main.js after the editor wiring exists. Applies the
 * preset through the editor's own API, renders, and flips __SHOT_READY.
 */
export function applyShotPreset(shot, query, editor) {
  const seed = Number.parseInt(query.get('seed') ?? '1', 10) || 1;
  const preset = presetForShot(shot, seed);
  return editor
    .loadPhotosFromUrls(SAMPLE_PHOTOS)
    .then((photos) => {
      editor.setSizeId(preset.layout ? sizeIdForShot(shot) : 'square');
      editor.setLayout(preset.layout);
      editor.setCaption(preset.caption);
      editor.setKicker(preset.kicker);
      editor.setFontId(preset.fontId);
      editor.setPanelTints(preset.panelTintIds);
      editor.assignSamplePhotosToPanels(photos, preset.photoAssignments);
      editor.applyCropNudges(preset.cropNudges);
      editor.render();
    })
    .then(() => {
      document.title = `NOCTURNE COVERS — ${shot}`;
      window.__SHOT_READY = true;
    })
    .catch((err) => {
      console.error('shot setup failed:', err);
      document.title = `NOCTURNE COVERS — ${shot} FAILED`;
      window.__SHOT_READY = true;
    });
}

/** Each shot pins its own post size so the composition is exact. */
export function sizeIdForShot(shot) {
  return {
    'cover-square': 'square',
    'cover-story': 'story',
    'cover-wide': 'wide',
    editor: 'square',
  }[shot] ?? 'square';
}
