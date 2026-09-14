---
title: React 组件概览
description: pptx-react-viewer 为 React 18/19 提供浏览器内的 PowerPoint 预览、编辑、放映、导出和实时协作组件。
---

# React 组件概览 {#react-viewer-overview}

`pptx-react-viewer` 是用于渲染和编辑 `.pptx` 的 **React 18 或 19** 组件，基于 [`pptx-viewer-core`](/zh/core/)，包含工具栏、属性面板、幻灯片画布、动画引擎、放映模式、实时协作和导出。

![包含功能区、缩略图、画布和属性面板的完整编辑器](/docs-shots/editor.jpg)

## 提供的能力 {#what-it-provides}

| 能力                 | 说明                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **预览**             | 渲染包含 16 类元素的幻灯片，包括形状、文本、图片、表格、23 种图表、SmartArt、连接线、媒体、墨迹、OLE、三维模型和缩放定位对象。 |
| **所见即所得编辑器** | 插入、移动、缩放和删除元素，行内编辑文本、修改样式和管理幻灯片，由 `canEdit` 控制。                                            |
| **放映**             | 全屏放映，支持 39 种动画预设、26 种动作路径、57 种切换（含平滑切换）、演讲者备注和带计时器的演讲者视图。                       |
| **导出**             | 导出 PNG、SVG、PDF、GIF、视频和 JSON，也可另存为 PPTX，详见[导出](/zh/react/export)。                                          |
| **协作**             | 基于 Yjs CRDT 的实时多人编辑，提供在线状态、远程光标和头像，详见[协作](/zh/react/collaboration)。                              |

::: info 元素支持范围
底层解析器和序列化器的精确支持范围，以及采用近似实现的功能，见[功能限制](/zh/guide/limitations)。
:::

## 安装 {#installation}

```bash
npm i pptx-react-viewer
```

核心引擎 `pptx-viewer-core` 已**打包在组件中**，无需单独安装。只有还需要直接使用不依赖框架的引擎时，才另外添加该包。

**同级依赖**，由宿主应用提供：

- `react` 和 `react-dom` ^18.2 或 ^19，两个主版本均有独立 CI 测试。
- `framer-motion`、`lucide-react`、`react-icons`
- `jspdf`、`jszip`、`fast-xml-parser`
- `i18next`、`react-i18next`

**可选依赖**，仅特定功能需要：

- `three`：GLB/GLTF 三维模型，以及可选的三维 SmartArt 和三维图表渲染器。
- `yjs`、`y-websocket`：使用中继传输的实时协作。
- `y-webrtc`：点对点协作，无需文档服务器。

::: tip 提示
三维和协作功能可以平稳降级。缺少 `three` 时，三维模型回退为预览图片；缺少 `yjs`/`y-websocket` 时，组件以单用户模式运行。
:::

## 导入路径 {#import-paths}

`package.json` 的 `exports` 提供两个入口：

```tsx
// Root entry - viewer, theme utilities, renderToCanvas
import { PowerPointViewer } from 'pptx-react-viewer';

// Viewer sub-entry - same component PLUS the opt-in hooks/components surface
import { PowerPointViewer } from 'pptx-react-viewer/viewer';
```

两个入口均导出 `PowerPointViewer`。`pptx-react-viewer/viewer` 还提供可按需使用、支持 tree-shaking 的 hooks 和协作组件，详见 [Hooks](/zh/react/hooks)。普通场景使用根入口即可。

## 渲染方式：CSS 与 DOM {#rendering-philosophy-css-not-canvas}

幻灯片通过 **CSS 定位和变换**显示为缩放后的 HTML/SVG，而非 HTML Canvas，因此可以提供：

- 不同缩放比例下清晰的文本。
- 浏览器原生文本选择和无障碍能力。
- 基于 DOM 的点击、拖动和缩放命中检测。
- 阴影、渐变、边框等标准 CSS 效果。

相应的取舍是，部分视觉效果会近似处理，例如 `backdrop-filter`、`mix-blend-mode`、CSS 三维和路径渐变。位图导出使用 `html2canvas`，也受到其自身限制，完整说明见[功能限制](/zh/guide/limitations)。

## 基于 hooks 的架构 {#hooks-based-architecture}

顶层组件通过 `forwardRef` 协调行为，逻辑拆分为 **80 多个自定义 hook**，在 `PowerPointViewer.tsx` 中组合；视觉组件主要负责展示。大部分 hook 属于内部架构，选定的可复用子集则从 `pptx-react-viewer/viewer` 导出并支持 tree-shaking，供高级接入使用。公共 API 范围见 [Hooks](/zh/react/hooks)。

## 主要导出 {#key-exports}

| 导出项                                  | 类型            | 用途                                                                              |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `PowerPointViewer`                      | 组件            | 主要预览和编辑组件。                                                              |
| `PowerPointViewerProps`                 | 类型            | 组件属性接口，详见[组件属性](/zh/react/props)。                                   |
| `PowerPointViewerHandle`                | 类型            | 命令式 ref API，详见[命令式句柄](/zh/react/handle)。                              |
| `renderToCanvas`                        | 函数            | 将 DOM 元素绘制到 Canvas，包含 oklch 颜色兼容处理，详见[导出](/zh/react/export)。 |
| `getAnimationInitialStyle`              | 函数            | 计算动画预设播放前的初始 CSS。                                                    |
| `ViewerTheme`、`ViewerThemeColors`      | 类型            | 主题配置类型，详见[主题配置](/zh/react/theming)。                                 |
| `defaultThemeColors`、`defaultRadius`   | 常量            | 内置深色主题默认值。                                                              |
| `themeToCssVars`、`defaultCssVars`      | 函数            | 将主题转换为 `--pptx-*` CSS 变量。                                                |
| `ViewerThemeProvider`、`useViewerTheme` | Provider / Hook | 高级主题上下文。                                                                  |

## 下一步 {#next-steps}

- [快速接入](/zh/react/getting-started)：最小可运行示例。
- [组件属性](/zh/react/props)：完整的 `PowerPointViewerProps` 参考。
- [命令式句柄](/zh/react/handle)：ref API。
- [主题配置](/zh/react/theming)：颜色、圆角、CSS 变量和 Provider。
- [Hooks](/zh/react/hooks)：架构和公共 hook 接口。
- [导出](/zh/react/export)：PNG、PDF、SVG、GIF、视频和 html2canvas 流程。
- [协作](/zh/react/collaboration)：Yjs 共同编辑和在线状态。
