# Nocturne Covers

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ilhamarief802/gta6cover-1795085155/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ilhamarief802/gta6cover-1795085155/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A browser cover-art studio that turns a person's own photos and a caption into a
multi-panel key-art poster with a sunset grade, exported as a PNG for the common
post sizes. An entry in make.fun's
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty.

Everything here is original work: no studio logo, wordmark, artwork or font file is
taken from any game. Every font is a system font stack, and every pixel is drawn
with Canvas 2D.

## What it does

- **Multi-panel posters.** Six layouts (hero-left, hero-right, quad, triptych,
  cinema, mosaic), each built from rectangles split by black gutters, so the
  composition reads as street-poster key art rather than a single photo.
- **Your own photos.** Load several photos, click a panel to select it, then assign
  a photo to that panel or fill every panel with one. Each panel keeps its own crop:
  drag to reposition, and zoom per panel.
- **Poster lettering.** Heavy condensed capitals in the lower third, fitted to the
  width, with a dark outline and a soft shadow so the title reads over any photo,
  plus a small kicker line and a rule beneath.
- **The sunset grade.** A magenta-to-amber vertical gradient over the whole canvas,
  per-panel warm tints, a contrast and saturation lift, a corner vignette and fine
  grain, all measured so the lower third reads warm.
- **Three post sizes.** 1080x1080, 1080x1350 and 1920x1080, re-flowing the layout
  and re-fitting the lettering when you switch.
- **Export.** One click writes a PNG at the chosen size.

## Run it

No build step and no network: it is static files under `app/`.

```sh
node serve.ts          # serves app/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. To hand the entry in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory and writes
`dossier.json` with the vendored `buildDossier` from `vendor/makefun-app.ts`.

## Layout

| Path | What it holds |
| --- | --- |
| `app/index.html` | the editor page and its controls |
| `app/style.css` | the editor chrome |
| `app/src/layouts.js` | the six panel layouts and the gutter maths |
| `app/src/photos.js` | photo intake and per-panel crop maths |
| `app/src/grade.js` | the sunset grade: gradient, tints, vignette, grain |
| `app/src/lettering.js` | caption wrapping, fitting and drawing |
| `app/src/render.js` | composes panels, grade and lettering onto the canvas |
| `app/src/export.js` | PNG export and file naming |
| `app/src/shots.js` | deterministic scenes for the screenshots |
| `app/src/main.js` | editor state and DOM wiring |
| `app/main.ts`… | see `main.ts` at the root for the hand-in script |

The two photos in `app/samples/` were made with an image model for make.fun and are
free to use.

## Screenshots

`screenshots/` holds four captures taken from the running app: the wide hero cover
(1920x1080), the studio with a photo loaded, and the square (1080x1080) and story
(1080x1350) exports. Each cover is exactly what the app painted, only scaled down.

## Licence

MIT — see [LICENSE](LICENSE).
