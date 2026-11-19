# Nocturne Covers

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ilhamarief802/gta6cover-1795085155/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/ilhamarief802/gta6cover-1795085155/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Nocturne Covers is a browser cover-art studio: you bring your own photos and a caption, and it turns them into a multi-panel key-art poster with a sunset grade, exported as a PNG at 1080x1080, 1080x1350 or 1920x1080. It is entered in make.fun's [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty. Everything here is original — no studio logo, wordmark, artwork or font file from any game; every font is a system stack, and every pixel is drawn with Canvas 2D.

## What it does

- Six poster layouts — Hero left, Hero right, Quad, Triptych, Cinema and Mosaic — each a hero panel plus smaller ones, split by black gutters that scale with the canvas and re-flow when you change post size.
- Per-panel crop maths: each photo is cover-fit into its panel so there are never gaps; drag on the canvas to reposition the crop, wheel or slider to zoom (1x–4x), and a button to recentre.
- Lettering that fits itself: the caption is wrapped into at most three lines of heavy condensed capitals, then the type shrinks toward a floor size until the block fits its box, painted with a dark stroke and drop shadow so it reads over any photo; a letterspaced kicker line with flanking rules sits above. Three system font stacks to choose from.
- The sunset grade composes a bottom magenta wash, a top amber light, a soft cyan neon pool, a contrast-lift veil, a vignette and deterministic seeded print grain — plus six named duotone tints applied per panel. All canvas gradients and generated noise, no filters.
- Three post sizes: 1:1 at 1080x1080, 4:5 at 1080x1350 and 16:9 at 1920x1080.
- PNG export renders the current cover at the chosen size's full native pixels on a fresh canvas — the same render path the preview uses — and downloads it as a slug-named file.
- Extras: a photo strip with thumbnails, fill-all and put-in-panel buttons, per-panel tint picker, a "Surprise me" randomiser on a seeded PRNG, a rating box and credit line as poster ornaments, and deterministic screenshot presets behind a query parameter.

## Run it

```sh
node serve.ts                          # serves app/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The app is static files — no build step, no network. The second command copies `app/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored `makefun-app.ts`.

## Layout

| File | What it does |
| --- | --- |
| `app/index.html` | The studio page: grouped controls on the left, the live poster canvas in the middle. |
| `app/style.css` | Dark studio chrome; in shot mode it hides the chrome so captures frame the cover alone. |
| `app/src/main.js` | The editor: owns the state, wires every control, handles canvas click/drag/wheel editing, and drives the renderer. |
| `app/src/layouts.js` | Defines the six layouts and three post sizes; computes panel rectangles and gutter widths for any canvas size. |
| `app/src/photos.js` | Photo intake and crop maths: decodes and downscales uploads, derives cover-fit crop rectangles, clamps pan and zoom. |
| `app/src/render.js` | The renderer: one drawCover call paints the poster base, panels, tints, grade, lettering and ornaments. |
| `app/src/grade.js` | The colour grade: sunset washes, contrast lift, per-panel duotone tints, vignette and seeded print grain. |
| `app/src/lettering.js` | Caption wrapping and auto-fitting, the kicker line and its rules, and the three system font stacks. |
| `app/src/export.js` | PNG export at the chosen size's native pixels, with a deterministic download filename. |
| `app/src/shots.js` | Deterministic screenshot presets applied through the editor's own API, signalling readiness when painted. |
| `app/src/util.js` | Small shared helpers: clamp and the mulberry32 seeded PRNG behind grain, Surprise me and the presets. |
| `main.ts` | Hand-in script: mirrors `app/` and `screenshots/` into the output directory and writes `dossier.json`. |

## Screenshots

`screenshots/` holds four captures taken from the running app: `1-cover-wide.jpg`, `2-editor.jpg`, `3-cover-square.jpg` and `4-cover-story.jpg`. Each cover is exactly what the app painted, only scaled down.

## Licence

MIT — see [LICENSE](LICENSE).

The two photos in `app/samples/`, `boulevard.jpg` and `pier.jpg`, were made with an image model for make.fun and are free to use.
