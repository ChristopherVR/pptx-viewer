---
title: 运行环境
description: 了解 pptx-viewer 在浏览器、Node.js 和 Web Worker 中的支持范围，以及浏览器沙箱带来的平台行为差异。
---

# 运行环境 {#runtime-environments}

`pptx-viewer` 分为不依赖 DOM 的核心引擎和仅在浏览器中运行的 UI 组件。本页介绍各部分的运行环境，以及由浏览器沙箱直接决定的平台行为。

## 支持的环境 {#where-it-runs}

| 环境                       | 支持范围   | 注意事项                                                                                                                                    |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 浏览器                     | 支持       | 提供完整功能：解析、渲染、编辑、导出和协作。                                                                                                |
| Node.js（包括 Serverless） | 仅核心引擎 | `pptx-viewer-core` 的加载、编辑、保存、Markdown/SVG 转换和加密不依赖 DOM。UI 组件、位图导出（`html2canvas`）和 EMF/WMF 转换属于浏览器功能。 |
| Web Worker                 | 仅核心引擎 | 与 Node.js 的范围相同，核心引擎不依赖 DOM。                                                                                                 |

## 平台说明 {#platform-notes}

以下差异来自浏览器的安全沙箱。浏览器无法像桌面应用一样访问所有系统能力，这些差异不属于待补齐的组件功能。

### 字体 {#fonts}

浏览器无法像桌面应用一样直接使用完整的系统字体目录，因此 `pptx-viewer` 按三个步骤解析演示文稿中的字体：优先使用阅读者设备上已安装的原字体；否则在排版前从 Google Fonts 加载经过验证、字形度量兼容的替代字体（Calibri -> Carlito、Cambria -> Caladea、Arial -> Arimo、Times New Roman -> Tinos、Courier New -> Cousine、Georgia -> Gelasio），使换行和文本尺寸尽量保持与 PowerPoint 一致；两者均不可用时，才通过 PANOSE 分类回退到同类通用字体，此时字形度量可能发生变化。

### 运行程序动作（`ppaction://program`） {#run-program-actions-ppaction-program}

PowerPoint 的“运行程序”动作设置可以解析，并在加载和保存过程中完整保留原始程序路径或命令。编辑时，也可以像其他动作一样在“动作设置”对话框中查看和修改。浏览器无法执行的是桌面 PowerPoint 在放映时所做的事：启动本地可执行程序。Web 平台出于安全设计，没有提供让网页启动任意本地程序的 API。

放映过程中点击带有“运行程序”动作的形状时，会显示一条不阻塞操作的提示，列出解析后的完整命令，并提供一键复制按钮。命令包含作者输入的路径及参数；OOXML 将它们保存为一个不透明字符串，没有独立字段可供拆分。演讲者可以查看 PowerPoint 原本要执行的命令，再自行决定是否在浏览器外启动。此次点击仍被视为已处理，不会同时切换到下一页，与其他动作类型一致。五个组件共用同一个判断函数（`packages/shared/src/render/presentation-action.ts` 中的 `runProgram` 意图，以及 `packages/shared/src/render/run-program-notice.ts`），`e2e/run-program-notice.spec.ts` 会在五个演示应用中检查提示、复制按钮及点击事件的消费行为。

实现过程中还修复了两个问题。最初 React 将提示渲染为放映时调用 `requestFullscreen()` 的元素的兄弟节点，而系统级全屏元素的顶层会盖住其外部内容，不受 CSS `z-index` 影响，导致复制按钮可见却无法点击。现在提示通过放映舞台自身的浮层插槽渲染，与其他放映界面元素放在一起。此外，不符合 URI 格式的目标字符串（例如 `notepad.exe C:\temp\notes.txt`）在保存时未被识别为外部关系目标，导致 `ppaction://program`、`hlinkfile` 和 `hlinkpres` 的 `TargetMode="External"` 校验失败。保存流程现在会为这三种动作强制设置 `External`。

### 媒体播放 {#media-playback}

音视频播放依赖浏览器自身支持的编解码器。WMV 等旧格式可能无法播放，受 DRM 保护的媒体也无法播放。`pptx-viewer` 使用浏览器原生媒体元素播放，因此只能解码浏览器提供相应编解码器的格式，这属于平台限制。

## 相关阅读 {#related-reading}

- [功能限制](/zh/guide/limitations)：尚未解决的功能缺口。
- [视觉效果还原](/zh/guide/visual-effects)：CSS/SVG 效果的近似实现及验证依据。
