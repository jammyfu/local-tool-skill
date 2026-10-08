# local-tool-skill

Copy-ready **agent skill** for building a **local tool**: a single-purpose browser page where all processing stays on the user's device. Nothing is uploaded. Zero telemetry. Bilingual. Spec/data-driven. Meant to ship in 1–2 days.

Extracted from the free ID & exam photo maker at [https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo). Spec data: [https://github.com/jammyfu/photo-spec-library](https://github.com/jammyfu/photo-spec-library). [https://bubufu.com](https://bubufu.com) · [@laofu on X](https://x.com/laofu).

This repository has no telemetry.

## Install

Copy the `skills/local-tool` folder (keep `SKILL.md` and `templates/`) into one of:

| Tool | Path |
| --- | --- |
| Claude Code | `~/.claude/skills/local-tool/` |
| Cursor | `~/.cursor/skills/local-tool/` or the project's `.cursor/skills/local-tool/` |
| Codex / any agent | project `.agents/skills/local-tool/`, or add a line to `AGENTS.md`: `@skills/local-tool/SKILL.md` |

This repo already includes a root `AGENTS.md` that points at the skill.

## 30-second usage

1. Install the skill (above).
2. Tell the agent:

   ```
   Build a local tool: <one sentence>.
   Follow the local-tool skill. On-device only. No uploads. No telemetry.
   ```

3. The agent should write a spec JSON (official sources, `null` over guesses), a pure-logic core with tests, then a thin bilingual UI with a privacy sentence on the page.

Worked example and a paste-ready rebuild prompt: [`examples/id-photo.md`](examples/id-photo.md).

Live demo: [https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo).

## What's in the box

- `skills/local-tool/SKILL.md` — build recipe
- `skills/local-tool/templates/` — TypeScript modules + `node:test` files (`spec`, `image-io`, `compress-to-kb`, `print-sheet`, `vision`)
- `examples/id-photo.md` — how the production ID photo tool was built

Templates compile and are tested here. They do not include MediaPipe wasm or `.tflite` binaries. Official Apache-2.0 model URLs are listed in the skill and in `templates/vision.ts` (`MODEL_DOWNLOADS`). Download them at build time; do not fetch them from the browser.

```bash
npm ci
npm run typecheck
npm test
```

## License

MIT. See [LICENSE](LICENSE).

---

# 中文

可复制的 **agent skill**，用来做 **本地工具**：单页、单任务，处理都在用户设备上完成。不上传，无遥测，中英双语，规格/数据驱动，目标是 1–2 天能上线。

从免费证件照 / 考试报名照工具 [https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo) 抽出来。规格库：[https://github.com/jammyfu/photo-spec-library](https://github.com/jammyfu/photo-spec-library)。[https://bubufu.com](https://bubufu.com) · [X @laofu](https://x.com/laofu)。

本仓库不含遥测。

## 安装

把 `skills/local-tool` 目录（保留 `SKILL.md` 和 `templates/`）复制到：

| 工具 | 路径 |
| --- | --- |
| Claude Code | `~/.claude/skills/local-tool/` |
| Cursor | `~/.cursor/skills/local-tool/` 或项目内 `.cursor/skills/local-tool/` |
| Codex / 其他代理 | 项目 `.agents/skills/local-tool/`，或在 `AGENTS.md` 写一行 `@skills/local-tool/SKILL.md` |

本仓库根目录的 `AGENTS.md` 已经指向该 skill。

## 30 秒用法

1. 按上面安装 skill。
2. 对代理说：

   ```
   做一款本地工具：<一句话需求>。
   按 local-tool skill 来。只在端侧处理。不上传。无遥测。
   ```

3. 代理应先写带官方来源的规格 JSON（不知道就 `null`），再写可单测的纯逻辑，最后才是带隐私说明的薄 UI。

完整对照和可粘贴的重建 prompt：[`examples/id-photo.md`](examples/id-photo.md)。

线上演示：[https://tools.bubufu.com/en/id-photo](https://tools.bubufu.com/en/id-photo)。

## 仓库内容

- `skills/local-tool/SKILL.md` — 做法
- `skills/local-tool/templates/` — TypeScript 模板和测试
- `examples/id-photo.md` — 证件照工具是怎么按这套做法做出来的

模板在本仓库里可编译、可测试。不含模型二进制。官方 Apache-2.0 模型地址写在 skill 和 `templates/vision.ts` 的 `MODEL_DOWNLOADS` 里：构建时下载，不要在浏览器里拉取。

## 许可

MIT，见 [LICENSE](LICENSE)。
