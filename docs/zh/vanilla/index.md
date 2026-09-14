---
title: 原生 JavaScript 查看器概览
description: pptx-vanilla-viewer 是无需框架的浏览器 PowerPoint 查看器，使用普通 DOM 渲染 .pptx 幻灯片，无需 React、Vue 或 Angular。
---

# 原生 JavaScript 查看器概览 {#vanilla-js-viewer-overview}

`pptx-vanilla-viewer` 是**不依赖框架**的 PowerPoint 查看器，使用普通 DOM 在浏览器中渲染 `.pptx` 幻灯片，不依赖 React、Vue 或 Angular。调用工厂函数 `createPptxViewer(container, options)`，会返回具有命令式 API 的查看器实例。解析引擎（[`pptx-viewer-core`](/zh/core/)）和共享渲染逻辑（`pptx-viewer-shared`）已经打包在内，因此该包可以独立使用。

在线[原生 JavaScript 演示](https://christophervr.github.io/pptx-viewer/demo-vanilla/)展示了此包在没有框架时的运行效果。

## 提供的能力 {#what-it-provides}

| 能力           | 说明                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **幻灯片渲染** | 文本、形状、图片、组合、连接线、表格、图表、SmartArt（二维及可选三维）、媒体、墨迹、OLE、内容部件、缩放定位链接和三维模型，都使用专用渲染器。 |
| **导航**       | 工具栏、缩略图侧边栏、键盘导航（方向键、PageUp/PageDown、空格、Home/End）和演讲者备注面板。                                                   |
| **放映**       | 通过真实 Fullscreen API 进入全屏放映模式，Esc 退出，支持媒体自动播放。                                                                        |
| **主题**       | 共享的 `ViewerTheme` 系统，使用 `--pptx-*` CSS 自定义属性，包含朱红色预设。参见[主题](/zh/vanilla/theming)。                                  |
| **编辑**       | 通过 `editable` 启用插入、格式设置、多选和组合、排列、继承模板编辑、富文本备注、撤销和重做、保存和下载。参见[实例 API](/zh/vanilla/api)。     |
| **导出**       | PNG、PDF、GIF、视频、打印、备注页和讲义输出。                                                                                                 |
| **无障碍**     | 元素语义，以及覆盖整个演示文稿并支持问题导航的无障碍检查器。                                                                                  |
| **可扩展性**   | 开放的元素渲染器注册表，可以按元素类型注册或覆盖渲染器，无需 fork。参见[元素渲染器](/zh/vanilla/renderers)。                                  |

::: info 元素覆盖范围
底层解析器的精确支持范围，以及采用近似处理的功能，请参见[已知限制](/zh/guide/limitations)。
:::

## 安装 {#installation}

```bash
npm i pptx-vanilla-viewer
```

核心引擎（`pptx-viewer-core`）和共享渲染层已经**打包在内**，引擎运行时依赖（`jszip`、`fast-xml-parser`）自动安装。没有框架 peer 依赖。

## 简单示例 {#quick-example}

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx', // URL, ArrayBuffer, Uint8Array, Blob, or File
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
});

viewer.next();
viewer.goToSlide(3);
await viewer.enterPresentation();
```

容器需要设置尺寸，查看器会填满它（`width/height: 100%`）。完整说明请参见[快速上手](/zh/vanilla/getting-started)。

## 无需构建步骤 {#no-build-step-required}

组件包提供 ESM 和 CJS 构建。因为没有框架依赖，也可以在普通的 `<script type="module">` 中配合 import map 或无需打包器的 CDN 配置使用，适用于现代 JavaScript 能运行的环境。构建查看器时自动注入样式，使用单个 `<style id="pptx-vanilla-viewer-styles">` 标签，作用域限定在 `.pptxv` 根类下。严格 CSP 宿主可以通过 [`getViewerCss()`](/zh/vanilla/getting-started#csp-strict-hosts-getviewercss) 自行渲染样式表。

## 渲染方式：CSS 与 DOM {#rendering-philosophy-css-not-canvas}

与此 monorepo 中所有绑定一样，幻灯片渲染为 **CSS 定位的 HTML/SVG**，通过 CSS transform 缩放，不绘制到 Canvas 上。文本在任意缩放下都保持可选中且清晰，屏幕阅读器也可以正常工作。相关取舍请参见[已知限制](/zh/guide/limitations)。

## 主要导出 {#key-exports}

| 导出项                                       | 类型 | 用途                                                                        |
| -------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `createPptxViewer`                           | 函数 | 工厂函数，将查看器挂载到容器。参见[快速上手](/zh/vanilla/getting-started)。 |
| `PptxViewerOptions`, `PptxViewerCallbacks`   | 类型 | 选项和事件回调。参见[选项与回调](/zh/vanilla/options)。                     |
| `PptxViewerInstance`                         | 类型 | 返回的句柄。参见[查看器实例 API](/zh/vanilla/api)。                         |
| `PptxViewerSource`                           | 类型 | `ArrayBuffer \| Uint8Array \| Blob \| string`（URL）。                      |
| `ElementRenderer`, `ElementRendererRegistry` | 类型 | 渲染器扩展接口。参见[元素渲染器](/zh/vanilla/renderers)。                   |
| `createDefaultRegistry`                      | 函数 | 默认渲染器注册表，预先注册全部内置渲染器。                                  |
| `getViewerCss`                               | 函数 | 以字符串形式提供完整样式表，适用于严格 CSP 宿主。                           |
| `ViewerTheme`, `ViewerThemeColors`           | 类型 | 主题配置类型。参见[主题](/zh/vanilla/theming)。                             |
| `vermilionLightTheme`, `vermilionDarkTheme`  | 常量 | 内置的朱红色亮色和深色预设。                                                |
| `themeToCssVars`, `defaultCssVars`           | 函数 | 将主题转换为 `--pptx-*` CSS 变量。                                          |
| `PptxHandler`, `PptxSlide`, `PptxElement`    | 类型 | 为 `getHandler()` 高级入口重新导出的核心类型。                              |

## 下一步 {#next-steps}

- [快速上手](/zh/vanilla/getting-started)：挂载、加载、导航和放映。
- [选项与回调](/zh/vanilla/options)：完整的 `PptxViewerOptions` 参考。
- [查看器实例 API](/zh/vanilla/api)：返回实例的全部方法。
- [主题](/zh/vanilla/theming)：颜色、圆角、CSS 变量和朱红色预设。
- [元素渲染器](/zh/vanilla/renderers)：扩展或覆盖幻灯片渲染。
