# local-tool-skill

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文（台灣）](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

做一个真正有用的浏览器小工具，而不是再做一套账号系统。**local-tool** 是面向 Agent 的 Skill 与 TypeScript 模板，适合证件照裁切、图片压缩、打印排版等本机处理流程。

## 从实际用途开始

[证件照完整示例](examples/id-photo.md) · [已发布的证件照工具](https://tools.bubufu.com/en/id-photo) · [Skill 正文](skills/local-tool/SKILL.md)

示例是实现参考，不代表所有生成结果都已达到生产标准。仓库提供指引和辅助模块，不是托管文件处理服务。

## 安装完整 Skill

复制整个 `skills/local-tool/`，保留 `SKILL.md` 和 `templates/`：

| Agent | 放置位置 |
| --- | --- |
| Claude Code | `~/.claude/skills/local-tool/` |
| Cursor | 项目的 `.cursor/skills/local-tool/` |
| Codex | 项目的 `.agents/skills/local-tool/` |

可以这样提需求：

> 按 local-tool skill 制作证件照尺寸调整工具。文件仅在本机处理，不上传、不加遥测。提供预览、明确的导出限制与隐私说明。

## 可以直接复用什么

| 模块 | 解决的问题 |
| --- | --- |
| `spec.ts` | 整理尺寸和文件大小要求，不编造缺失的官方规范 |
| `image-io.ts` | 图片解码与方向处理 |
| `compress-to-kb.ts` | 搜索满足目标大小的 JPEG 质量 |
| `print-sheet.ts` | 多张照片的打印排版 |
| `vision.ts` | 可选的人脸检测和分割接入 |

代码在 [templates](skills/local-tool/templates/)。视觉模型需另行配置，模板不附带模型二进制文件。

## 发布前验证

需要 Node.js 20+：

```bash
npm ci
npm test
npm run typecheck
```

对生成应用还要检查网络请求、手机布局、导出尺寸与官方证件照规范。“本机处理、无遥测”是设计要求，不是对任意生成代码的审计保证。可选模型应本地托管，不要悄悄增加第三方运行时下载；不保证开发时长或所有场景都合规。

Skill 当前要求英文和简中界面；五语 README 不等于生成应用自动支持五种语言。

## 使用与贡献

可以商用和修改，保留版权与许可证声明即可。
（[MIT](LICENSE)）

欢迎提交可复现问题和通过测试的流程。[原详细说明](README.reference.md) · [机器可读摘要](llms.txt)
