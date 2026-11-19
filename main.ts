// NOCTURNE COVERS — hand-in script for the gta6-cover-art-01 entry.
//
// The studio itself is app/: static ES modules a browser loads straight off
// disk, no build step, no network. This file only stages what the judge
// reads — the app, the screenshots, and a dossier.json that bundles both —
// into MAKEFUN_OUTPUT_DIR (the grader's writable volume, /output by default).
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only. Two runs over the same tree must leave
// byte-identical output: nothing here reads the clock or samples randomness.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** Where the hand-in lands. /output is the grader's mount; the env var is
 *  the local stand-in so the same script works on a laptop. */
function outputDir() {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

/** This repo's root, derived from this module's own URL. The grader mounts
 *  the tree read-only at /bot and may start node from any directory, so the
 *  current working directory is never trusted. */
function repoRoot() {
  return fileURLToPath(new URL('.', import.meta.url));
}

/** Quit with a message a human can act on, not a stack trace. */
function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

/** Mirror one source directory into the output tree. A missing source is
 *  not an error (screenshots/ is optional); anything else propagates. */
function mirrorDir(source, destination) {
  if (!existsSync(source)) return false;
  cpSync(source, destination, { recursive: true });
  return true;
}

/** The size limits the scorer enforces on a hand-in. Kept here as one
 *  literal so the dossier call site stays a one-liner:
 *    - text_max_bytes     cap on the dossier's own text block
 *    - screenshots        at most 4 images, each at most 256 KiB
 *    - app_max_files      at most 993 files under app/
 *    - app_max_bytes      at most 48 MiB of app/ payload in total
 *    - app_path_max_bytes no single app/ path longer than 1000 bytes */
function collectCaps() {
  return {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  };
}

// ---- the pipeline: check, stage, dossier ---------------------------------

const root = repoRoot();
const appDir = join(root, 'app');

// The app is the entry. Without it there is nothing to judge, so say so and
// leave a non-zero exit code behind.
if (!existsSync(appDir)) {
  fail(`no app/ directory beside this file (looked in ${appDir}) — nothing to hand in`);
}

const out = outputDir();
mkdirSync(out, { recursive: true });

mirrorDir(appDir, join(out, 'app'));
mirrorDir(join(root, 'screenshots'), join(out, 'screenshots'));

writeFileSync(join(out, 'dossier.json'), buildDossier(out, collectCaps()));
