---
name: local-tool
description: >-
  Build a single-purpose browser "local tool": all processing on the user's
  device, nothing uploaded, zero telemetry, bilingual, spec/data-driven, and
  shippable in 1–2 days. Use when creating or reviewing an ID/exam photo maker,
  image converter, print-sheet packer, on-device cutout, calculator, or any
  privacy-first utility with no backend. Do not use for apps that upload files,
  call third-party APIs at runtime, or need accounts.
---

# Local tool

A **local tool** is one page that does one painful job in the browser. After the page loads, airplane mode still works. Copy `templates/` from this folder and adapt them; do not invent a backend.

## Non-negotiables

1. **One task.** One input → one result. No suite, no account, no paywall on the result.
2. **Spec file is the source of truth.** Every number comes from an official page. If the page does not state it, store `null` and say so in `notes`. Never guess.
3. **Pure core, thin UI.** Parse, math, pack, compress, and crop live in modules that `node:test` can import. UI only wires events.
4. **On-device ML only if needed.** Apache-2.0 or MIT models. Self-host wasm + weights. Lazy-load. GPU then CPU. No AGPL.
5. **Image I/O.** Decode with EXIF orientation. Export via canvas. Fit a KB window by binary-searching quality, then downscale.
6. **No third-party requests at runtime.** No CDN, analytics, pixels, error SaaS, webfonts, or map tiles. Same-origin assets only.
7. **Privacy copy on the page**, above the fold, in every locale.
8. **Bilingual keys**, not hardcoded UI strings. `en` + `zh` required; more locales optional.
9. **Tests** for every exported pure function, plus a "no outbound request" grep test.
10. **One PR per tool.** lint / typecheck / test / build green before merge.

## Build order

```
1. Name the painful task in one sentence.
2. Write data/specs.json (official URLs, nulls, en+zh).
3. Copy templates into src/ and make them pass node:test.
4. Add UI: dropzone, privacy banner, locale switch, download.
5. Vendor models at build time (if any). No binaries in git.
6. Grep for fetch / analytics / CDN. Ship.
```

Target layout:

```
src/spec.ts  src/image-io.ts  src/compress-to-kb.ts  src/print-sheet.ts  src/vision.ts
src/ui.*     data/specs.json
public/vendor/mediapipe/<version>/{wasm,models}   # gitignored binaries
tests/*.test.ts  tests/no-outbound.test.ts
```

## Spec file

One object per rule. kebab-case `id`. At least one `https` official `sources[]` with `checked: YYYY-MM-DD`. `status` is `verified` only when every filled number is on that page and sources do not conflict; otherwise `needs-review`.

```json
{
  "id": "us-visa-ds-160",
  "name": {"en": "US visa (DS-160)", "zh": "美国签证（DS-160）"},
  "notes": {"en": "51×51 mm. Official page states print size, not pixels.", "zh": "51×51 mm。官方写的是冲印边长，不是像素。"},
  "sources": [{"url": "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html", "title": "U.S. Department of State", "checked": "2026-10-08"}],
  "size": {"pixels": {"width": null, "height": null}, "print_mm": {"width": 51, "height": 51}, "dpi": 300},
  "file": {"formats": ["jpg"], "min_kb": null, "max_kb": 240},
  "status": "verified"
}
```

Resolve size in this order only: explicit pixels → `mm × dpi` → user custom. If both pixel and mm fields are null, **throw** — do not invent 413×531.

```ts
import {parseToolSpec, resolveOutputSize, mmToPx} from './spec';
mmToPx(35, 300) // 413
resolveOutputSize(spec) // {width, height, source: 'pixels' | 'print-mm'}
```

Domain libraries (example: [photo-spec-library](https://github.com/jammyfu/photo-spec-library)) may add fields. Keep the contract stable; do not rename published keys.

## Image I/O

```ts
import {decodeImage, browserDecodeHost, exportCanvas, browserExportHost} from './image-io';
const {width, height, bitmap} = await decodeImage(file, browserDecodeHost());
const blob = await exportCanvas(canvas, browserExportHost(), 'image/jpeg', 0.92);
```

- Prefer `createImageBitmap(file, {imageOrientation: 'from-image'})`.
- Enforce byte / pixel / edge limits before work.
- Tests inject a fake host; do not require jsdom for the core.

## Compress to a KB window

Inject the encoder so tests never touch a real canvas:

```ts
import {compressToKb} from './compress-to-kb';
const out = await compressToKb(
  (quality, w, h) => canvasToBlob(draw(w, h), 'image/jpeg', quality),
  width, height,
  {minKb: spec.file.minKb, maxKb: spec.file.maxKb},
);
```

Quality search `0.12…0.95` (about 8 steps). If the smallest quality still exceeds `maxKb`, scale by `0.92` until `0.55` or 32 px. PNG skips the KB search (lossless).

## Print sheet

Pack as many copies as fit on **4×6 in @ 300 DPI** (1200×1800). Emit `cutGuides(pack)` and stroke them. Optional mixed sizes are shop convenience, not issuer rules — label them that way.

## On-device vision

Use only when the task needs a mask or a face box.

- Runtime: `@mediapipe/tasks-vision@0.10.32` (Apache-2.0). Copy `node_modules/@mediapipe/tasks-vision/wasm/` → `/vendor/mediapipe/0.10.32/wasm/`.
- Models (Apache-2.0). **Download at build time. Do not commit binaries. Do not fetch in the browser.**
  - Selfie Segmenter: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`
  - BlazeFace short range: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`
- Load with `loadVision(runtime)` from `templates/vision.ts`: singleton, GPU then CPU, paths from `vendorPaths()` (`/vendor/...` only).
- Reject AGPL / non-permissive weights. If a model cannot be self-hosted, cut the feature.

## UI rules

Privacy, first screen, both locales:

```ts
t('Your file never leaves this device.', '文件不会离开这台设备。')
t('Cutout, export and compression run in this browser. Nothing is uploaded. Airplane mode works.',
  '抠图、导出和压缩都在浏览器内完成，不会上传。飞行模式也能用。')
```

- Copy lives in a dictionary (`copy.privacyTitle.en` / `.zh`) or a `t(en, zh)` helper. No raw English (or raw Chinese) sprinkled in JSX beyond that helper.
- Link every spec to its official source. Say the page does not certify acceptance.
- Neutral wording: no flag emoji, no payment-app links, no jurisdiction slogans.
- After first load, disable the network in DevTools and complete the happy path.

## Tests (required)

| Area | Assert |
| --- | --- |
| `spec` | kebab id; https sources; reject empty sources; `mmToPx(35,300)===413`; null size throws |
| `compress-to-kb` | lands in the KB window; downscales when quality cannot |
| `print-sheet` | placements in-bounds; leftover counted; 4 cut segments per tile |
| `image-io` | EXIF 6 swaps edges; limits throw |
| `vision` | GPU then CPU; second call is cached; remote path throws |
| `no-outbound` | source grep: no `fetch(`, `XMLHttpRequest`, `sendBeacon`, analytics, CDN, `https://` outside `MODEL_DOWNLOADS` |

`MODEL_DOWNLOADS` in `vision.ts` is documentation for the build script. Runtime must not read `.url`.

## Spec library (public, PR-friendly)

When many official rules exist, split data into its own MIT repo:

1. `specs/<id>.json` — one file per rule; `id` matches the filename.
2. `schema/*.json` — published contract; do not rename fields.
3. `dist/bundle.json` — generated, sorted by `id`.
4. PR template: official URL, what changed, why remaining fields are `null`.
5. `needs-review` = official page left a gap or sources conflict. It does **not** mean you filled a guess.
6. Vendors pin / vendor the bundle; they do not scrape at runtime.

Reference implementation: https://github.com/jammyfu/photo-spec-library

## Ship checklist

- [ ] `npm run lint` (if the host app has it)
- [ ] `npm run typecheck`
- [ ] `npm test` — includes no-outbound
- [ ] `npm run build`
- [ ] Privacy sentence visible without scrolling on mobile
- [ ] Official source link on every spec
- [ ] Models (if any) same-origin, lazy, Apache/MIT
- [ ] Airplane-mode happy path after first load
- [ ] One tool, one PR

Worked example: `examples/id-photo.md` in this repository (live tool: https://tools.bubufu.com/en/id-photo).
