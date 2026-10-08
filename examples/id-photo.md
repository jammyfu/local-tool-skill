# Example: ID & exam photo maker

This is how the production tool at [https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo) was built with the local-tool recipe. Spec data lives in [https://github.com/jammyfu/photo-spec-library](https://github.com/jammyfu/photo-spec-library). Site: [https://bubufu.com](https://bubufu.com) · [X @laofu](https://x.com/laofu).

## English

### What the tool does

One job: turn a selfie into an issuer-sized ID / exam / visa photo, plus an optional 4×6 in print sheet. After the page loads, the photo never leaves the device.

### How it maps to the skill

1. **One painful task.** People need a 35×45 mm exam photo or a 51×51 mm visa photo at a stated KB limit. Photo-shop apps upload the face. This tool does not.
2. **Spec file as source of truth.** Twenty issuer rules in photo-spec-library. Each number is copied from a government or exam-body page. Missing values are `null` (`needs-review`), not guessed. The app vendors `dist/specs.json`; it does not scrape at runtime.
3. **Pure core.** Size resolve (`mm × dpi`, pixels, or custom), JPEG quality search, face-to-crop math, 4×6 packer, mask refine. All of that is unit-tested with `node:test` and an injected encoder — no browser required.
4. **On-device ML.** MediaPipe Selfie Segmenter + BlazeFace short range, Apache-2.0. Wasm and `.tflite` copied into `/vendor/mediapipe/0.10.32/`. Lazy `import('@mediapipe/tasks-vision')`. GPU, then CPU. No AGPL, no CDN.
5. **Image I/O.** `createImageBitmap(..., {imageOrientation: 'from-image'})`, canvas export, `compressToKb` against `file.min_kb` / `file.max_kb`, then downscale if needed.
6. **Print sheet.** Pack as many copies as fit on 4×6 in (production used 102×152 mm ≈ 1205×1795 px at 300 DPI). Stroke cut guides. Optional 1-inch / 2-inch mix is labeled as a shop size, not an issuer rule.
7. **Privacy + bilingual.** Banner: “Your photo never leaves this device.” / “照片不会离开这台设备。” Every string goes through `t(en, zh)`. Official source links sit on each spec. The page states it does not certify acceptance.
8. **Tests.** Parser rejects missing sources and non-kebab ids; `mmToPx(35,300)===413`; packer stays in-bounds; compress hits the KB window; FAQ copy says the file is not uploaded.
9. **Ship.** One PR, lint / typecheck / test / build green. Zero telemetry.

The skill templates (`spec.ts`, `image-io.ts`, `compress-to-kb.ts`, `print-sheet.ts`, `vision.ts`) are the generalized form of that core. They are not a paste of the private app.

### Paste this prompt to rebuild a similar tool

```
Build a local-only ID and exam photo tool. Follow the local-tool skill
(skills/local-tool/SKILL.md) and start from skills/local-tool/templates/.

Product
- Single page. One job: make an issuer-sized ID / exam / visa photo from a
  selfie or upload, plus an optional 4×6 in / 300 DPI print sheet with cut
  guides.
- After first load, airplane mode must still work.
- Free. No account. No upload. No telemetry. No CDN. No analytics.
- Bilingual en + zh via a t(en, zh) helper or copy keys. No hardcoded UI
  strings. Neutral wording: no flag emoji, no payment-app links.

Data
- Vendor https://github.com/jammyfu/photo-spec-library (dist/specs.json).
- parse + validate with the spec template. Official https sources required.
- null if the official page does not state a value. Never invent pixels or KB.
- Resolve size: spec pixels, else mm × dpi (default 300), else custom px/mm.
- Show each spec's official source link. Mark needs-review clearly.

Pipeline
- Decode with EXIF orientation (image-io template).
- Lazy-load MediaPipe tasks-vision from same-origin /vendor/mediapipe/0.10.32/
  (vision template). GPU then CPU. Download Apache-2.0 models at build time
  only; do not commit .tflite or wasm; do not fetch storage.googleapis.com
  in the browser.
  - selfie_segmenter.tflite
    https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
  - blaze_face_short_range.tflite
    https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
- Segment person, detect primary face, crop to head ratio when the spec has
  one, composite a solid background, export JPEG/PNG.
- Fit file.minKb/maxKb with compress-to-kb (inject the canvas encoder).
- Pack N copies with print-sheet. Optional mixed shop sizes must be labeled
  as not issuer rules.

UI
- Privacy banner above the fold: the photo never leaves this device.
- Spec search, custom size, background swatches, edge softness, crop adjust,
  export photo, export 4×6 sheet.
- Disclaimer: always check the official source; this page does not certify
  acceptance.

Tests
- node:test for every pure function (spec, compress, print-sheet, image-io,
  vision load with a mock runtime).
- no-outbound test: no fetch, analytics, CDN, or runtime http(s) URLs.
- npm test and npm run typecheck green. One PR.
```

---

## 中文

### 工具做什么

线上工具：[https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo)。规格数据：[photo-spec-library](https://github.com/jammyfu/photo-spec-library)。

只做一件事：把自拍做成发证机关尺寸的证件 / 考试 / 签证照，并可选导出 4×6 英寸冲印版。页面加载完成后，照片不离开这台设备。

### 和 skill 的对应关系

1. **一个痛点。** 需要 35×45 mm 报名照或 51×51 mm 签证照，并满足 KB 限制。常见 App 会上传人脸；这个工具不上传。
2. **规格文件是唯一事实来源。** photo-spec-library 里二十条规则，数字来自政府或考试主办方页面。官方没写的字段是 `null`（`needs-review`），不编造。应用只打包 `dist/specs.json`，运行时不抓取。
3. **纯逻辑核心。** 尺寸解析、JPEG 码率搜索、人脸构图、4×6 拼版、遮罩处理均可在 `node:test` 里跑，编码器可注入。
4. **端侧模型。** MediaPipe Selfie Segmenter + BlazeFace，Apache-2.0。wasm 与 `.tflite` 放到 `/vendor/mediapipe/0.10.32/`。懒加载，GPU 失败再 CPU。不使用 AGPL，不走 CDN。
5. **图像 I/O。** 按 EXIF 方向解码，canvas 导出，按 `min_kb` / `max_kb` 二分质量，必要时缩小。
6. **冲印版。** 在 4×6 英寸上能放几张放几张，并画裁切线。一寸 / 二寸混排标明是冲印店尺寸，不是发证规则。
7. **隐私与双语。** 首屏写明“照片不会离开这台设备。” 文案走 `t(en, zh)`。每条规格带官方链接，并声明本页不保证被接受。
8. **测试与发布。** 纯函数全覆盖，外加“无出站请求”检查。一次一个工具、一个 PR。

模板是上述核心的通用版，不是把私有应用源码贴进来。

重建时，把上文英文框里的 prompt 整段贴给代理即可。
