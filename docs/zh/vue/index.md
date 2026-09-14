---
title: Vue 查看器概览
description: pptx-vue-viewer 是 Vue 3 组件，支持在浏览器中查看、编辑、放映、导出及协同编辑 PowerPoint (.pptx) 文件。
---

# Vue 查看器概览 {#vue-viewer-overview}

`pptx-vue-viewer` 是用于渲染和编辑 `.pptx` 文件的 **Vue 3** 组件。它基于 [`pptx-viewer-core`](/zh/core/)，包含工具栏、检查器面板、幻灯片画布、动画引擎、放映模式、实时协作和导出。它是 [React 查看器](/zh/react/)的 `<script setup>` 移植版本，共享底层架构和 `PowerPointViewerAPI` 约定。

![各绑定使用相同的编辑器界面，包括功能区、幻灯片缩略图、画布和检查器](/docs-shots/editor.jpg)

## 提供的能力 {#what-it-provides}

| 能力                 | 说明                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **预览**             | 渲染包含 16 类元素的幻灯片，包括形状、文本、图片、表格、23 种图表、SmartArt、连接线、媒体、墨迹、OLE、三维模型和缩放定位对象。 |
| **所见即所得编辑器** | 插入、移动、缩放和删除元素，内联文本编辑、样式编辑和幻灯片管理，由 `canEdit` 控制是否启用。                                    |
| **放映**             | 全屏幻灯片放映，支持动画、切换效果、演讲者备注和带计时器的演示者视图。                                                         |
| **导出**             | 将幻灯片导出为 PNG / SVG / PDF / GIF / 视频 / JSON，以及另存为 PPTX。参见[导出](/zh/vue/export)。                              |
| **协作**             | 通过 Yjs CRDT 实现多人实时编辑，包含在线状态跟踪和远程光标。参见[实时协作](/zh/vue/collaboration)。                            |

::: info 元素覆盖范围
底层解析器和序列化器的精确支持范围，以及采用近似处理的功能，请参见[已知限制](/zh/guide/limitations)。
:::

## 安装 {#installation}

```bash
npm i pptx-vue-viewer
```

核心引擎 `pptx-viewer-core` 已**打包在组件中**，无需单独安装。只有还需要直接使用不依赖框架的引擎时，才另外添加该包。

**Peer 依赖**（由应用提供）：

- `vue` ^3.5
- `vue-i18n` ^11
- `jszip`, `fast-xml-parser`

**可选依赖**（仅特定功能需要）：

- `three`：GLB/GLTF 三维模型和三维曲面图。
- `yjs`、`y-websocket`：实时协作，中继传输。
- `y-webrtc`：无服务器的点对点协作。

::: tip 提示
三维和协作功能会平稳降级。缺少 `three` 时，三维模型回退为封面图片；缺少 `yjs` / `y-websocket` 时，查看器以单用户模式运行。
:::

## 导入路径 {#import-paths}

组件包提供以下入口，对应 `package.json` 中的 `exports`：

```ts
// Root entry - viewer, theme utilities, i18n helper re-exports
import { PowerPointViewer } from 'pptx-vue-viewer';

// Viewer sub-entry - the component plus renderers and the curated composables
import { PowerPointViewer } from 'pptx-vue-viewer/viewer';

// vue-i18n dictionary (single-brace interpolation, converted from the shared dictionary)
import { translationsEn } from 'pptx-vue-viewer/i18n';

// Bundled stylesheet, for apps that don't already use Tailwind CSS v4
import 'pptx-vue-viewer/styles';
```

`.` 和 `./viewer` 都导出 `PowerPointViewer`；`./viewer` 还导出渲染组件和经过筛选的组合式函数，参见[组合式函数](/zh/vue/composables)。常规场景使用根入口即可。

## 渲染方式：CSS 与 DOM {#rendering-philosophy-css-not-canvas}

幻灯片通过 **CSS 定位和变换**显示为缩放后的 HTML/SVG，而非 HTML Canvas，因此可以提供：

- 任意缩放级别下都保持清晰的文本。
- 原生浏览器文本选择和无障碍支持。
- 基于 DOM 的交互，包括点击、拖动和缩放命中检测。
- 标准 CSS 效果，包括阴影、渐变和边框。

相应的取舍是部分视觉效果采用近似实现，包括 `backdrop-filter`、`mix-blend-mode`、CSS 三维效果和路径渐变。栅格导出通过 `html2canvas-pro` 完成，也受到该库自身的限制。完整说明请参见[已知限制](/zh/guide/limitations)。

## 基于组合式函数的架构 {#composables-based-architecture}

`PowerPointViewer.vue` 是轻量的 `<script setup>` 编排层。逻辑拆分为 `viewer/composables/` 下的 **70 多个自定义组合式函数**，在组件内部组合使用；可视组件（`.vue` 单文件组件）主要负责展示。它有意遵循不同于 React 的框架惯例：

- `forwardRef` 句柄改为 `defineExpose`，参见[命令式句柄](/zh/vue/handle)。
- 函数属性回调改为 emits，参见[属性](/zh/vue/props)。
- React context 改为 Vue `provide` / `inject`，用于主题、表格单元格编辑、SmartArt 节点编辑等。

大多数组合式函数属于内部架构，但经过筛选的一部分由 `pptx-vue-viewer/viewer` 重新导出。哪些属于公开 API，请参见[组合式函数](/zh/vue/composables)。

## 主要导出 {#key-exports}

| 导出项                                      | 类型 | 用途                                             |
| ------------------------------------------- | ---- | ------------------------------------------------ |
| `PowerPointViewer`                          | 组件 | 主要预览和编辑组件。                             |
| `PowerPointViewerProps`                     | 类型 | 属性接口。参见[属性](/zh/vue/props)。            |
| `PowerPointViewerEmits`                     | 类型 | 发出的事件。参见[属性](/zh/vue/props)。          |
| `PowerPointViewerExpose`                    | 类型 | `defineExpose` API。参见[句柄](/zh/vue/handle)。 |
| `ViewerTheme`, `ViewerThemeColors`          | 类型 | 主题配置类型。参见[主题](/zh/vue/theming)。      |
| `defaultThemeColors`, `defaultRadius`       | 常量 | 内置深色主题默认值。                             |
| `vermilionLightTheme`, `vermilionDarkTheme` | 常量 | 内置的朱红色亮色和深色预设。                     |
| `themeToCssVars`, `defaultCssVars`          | 函数 | 将主题转换为 `--pptx-*` CSS 变量。               |
| `provideViewerTheme`, `useViewerTheme`      | 函数 | 用于高级集成的主题 provide/inject。              |
| `translationsEn`                            | 常量 | vue-i18n 消息字典，来自 `pptx-vue-viewer/i18n`。 |

## 下一步 {#next-steps}

- [快速上手](/zh/vue/getting-started)：最小可运行示例。
- [组件属性](/zh/vue/props)：完整的 `PowerPointViewerProps` 参考。
- [命令式句柄](/zh/vue/handle)：`defineExpose` API。
- [主题](/zh/vue/theming)：颜色、圆角、CSS 变量和 provide/inject。
- [组合式函数](/zh/vue/composables)：架构及公开组合式函数接口。
- [导出](/zh/vue/export)：PNG、PDF、SVG、GIF、视频及 html2canvas-pro 流程。
- [实时协作](/zh/vue/collaboration)：Yjs 协同编辑和在线状态。
