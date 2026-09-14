---
title: Angular 查看器概览
description: pptx-angular-viewer 是 Angular 独立组件，支持在浏览器中查看、编辑、放映、导出及协同编辑 PowerPoint (.pptx) 文件。
---

# Angular 查看器概览 {#angular-viewer-overview}

`pptx-angular-viewer` 是用于渲染和编辑 `.pptx` 文件的 **Angular 19 至 22** 独立组件（`<pptx-viewer>`）。它基于 [`pptx-viewer-core`](/zh/core/)，包含功能区工具栏、检查器面板、幻灯片画布、动画引擎、放映模式、实时协作和导出。它是 `pptx-react-viewer` 和 `pptx-vue-viewer` 的 Angular 对应实现，通过内部 `pptx-viewer-shared` 包与两者共享不依赖框架的逻辑。

![各绑定使用相同的编辑器界面，包括功能区、幻灯片缩略图、画布和检查器](/docs-shots/editor.jpg)

## 提供的能力 {#what-it-provides}

| 能力                 | 说明                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **预览**             | 渲染包含 16 种元素类型的幻灯片，例如形状、文本、图片、表格、图表、SmartArt、连接线、媒体、墨迹、OLE、三维模型和缩放定位。 |
| **所见即所得编辑器** | 插入、移动、缩放和删除元素，行内编辑文本、修改样式和管理幻灯片，由 `canEdit` 控制。                                       |
| **放映**             | 全屏幻灯片放映，支持动画播放、切换效果、演讲者备注、带计时器的演示者视图和移动端演示者布局。                              |
| **导出**             | 将幻灯片导出为 PNG / PDF / GIF / WebM 视频，支持打印和另存为 `.pptx`。参见[导出](/zh/angular/export)。                    |
| **协作**             | 通过 Yjs CRDT 实现多人实时编辑，包含在线状态跟踪、远程光标和跟随模式。参见[实时协作](/zh/angular/collaboration)。         |

::: info 元素覆盖范围
底层解析器和序列化器的精确支持范围，以及采用近似处理的功能，请参见[已知限制](/zh/guide/limitations)。
:::

## 安装 {#installation}

```bash
npm i pptx-angular-viewer
```

核心引擎（`pptx-viewer-core`）已经**打包在内**，无需单独安装。

**Peer 依赖**（由应用提供）：

- `@angular/core` 和 `@angular/common`：版本彼此匹配，可使用 ^19 / ^20 / ^21 / ^22。
- `rxjs` ^7。
- `@ngx-translate/core` ^18。

::: info 为什么最低版本是 19
组件包使用最新 Angular 构建，但以可链接的部分编译声明发布，因此实际最低版本取决于这些声明的要求和源码依赖的运行时行为。两个从 v19 起成为默认的行为确定了该下限：组件无需 `standalone: true` 即为独立组件，`effect()` 函数体无需 `allowSignalWrites` 即可写入信号。CI 测试每次都会从构建产物重新推导链接器最低版本，避免它在无人察觉时变化。
:::

**可选 peer 依赖**（仅特定功能需要）：

- `three`：GLB/GLTF 三维模型和可选的三维 SmartArt 渲染器。
- `yjs`，以及 `y-websocket`（基于服务器）或 `y-webrtc`（无服务器的点对点传输）：实时协作。

::: tip 提示
三维和协作功能会平稳降级。缺少 `three` 时，三维模型回退为封面图片；缺少 `yjs` / `y-websocket` / `y-webrtc` 时，查看器以单用户模式运行。
:::

## 导入路径 {#import-paths}

React 提供 `pptx-react-viewer` 和 `pptx-react-viewer/viewer` 两个入口，而 Angular 的 ng-packagr 构建产生**单一入口**，所有内容均从包根入口导入。

```ts
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
```

`./styles` 子路径导出打包的样式表，参见[快速上手](/zh/angular/getting-started)。这是导出映射中唯一的其他入口，没有 React 和 Vue 那样独立的 `/viewer` 或 `/i18n` 子路径。`translationsEn`、`keyToLabel`、主题工具和其他命名导出都位于包根入口。国际化细节请参见[本地化](/zh/guide/localization)。

## 渲染方式：CSS 与 DOM {#rendering-philosophy-css-not-canvas}

幻灯片通过 **CSS 定位和变换**显示为缩放后的 HTML/SVG，而非 HTML Canvas，因此可以提供：

- 任意缩放级别下都保持清晰的文本。
- 原生浏览器文本选择和无障碍支持。
- 基于 DOM 的交互，包括点击、拖动和缩放命中检测。
- 标准 CSS 效果，包括阴影、渐变和边框。

相应的取舍是部分视觉效果采用近似实现，包括 `backdrop-filter`、`mix-blend-mode`、CSS 三维效果和路径渐变。栅格导出通过 `html2canvas-pro` 完成，也受到该库自身的限制。完整说明请参见[已知限制](/zh/guide/limitations)。

## 内部架构：服务与独立组件 {#internal-architecture-services-and-standalone-components}

`PowerPointViewerComponent` 是轻量的 `OnPush`、信号驱动编排器。其逻辑拆分为约四十多个 `@Injectable` 编排服务，在组件上提供，通过 `inject()` 和 `bind()` 交接模式接线，另有 200 多个独立子组件和纯辅助函数，与 React 的 80 多个内部 Hook 及 Vue 的组合式函数对应。多数属于内部架构，但经过筛选的一部分由包根入口重新导出，用于围绕查看器构建自定义界面。哪些属于公开 API，请参见[服务](/zh/angular/services)。

## 主要导出 {#key-exports}

| 导出项                                           | 类型             | 用途                                                                       |
| ------------------------------------------------ | ---------------- | -------------------------------------------------------------------------- |
| `PowerPointViewerComponent`                      | 独立组件         | 主查看器和编辑器组件，选择器为 `pptx-viewer`。                             |
| `LoadContentService`, `ExportService`, ...       | 服务             | 经过筛选的编排服务，也可以在组件外使用。参见[服务](/zh/angular/services)。 |
| `ViewerTheme`, `ViewerThemeColors`               | 类型             | 主题配置类型。参见[主题](/zh/angular/theming)。                            |
| `provideViewerTheme`, `VIEWER_THEME`             | 提供程序或令牌   | 通过 Angular 依赖注入在整个应用中共享主题。                                |
| `defaultThemeColors`, `defaultRadius`            | 常量             | 内置深色主题默认值。                                                       |
| `vermilionLightTheme`, `vermilionDarkTheme`      | 常量             | 预制的亮色和深色主题。                                                     |
| `themeToCssVars`, `defaultCssVars`, `themeStyle` | 函数             | 将主题转换为 `--pptx-*` CSS 变量或 `[ngStyle]` 映射。                      |
| `translationsEn`, `keyToLabel`, `TranslationKey` | 常量、函数或类型 | 英文国际化字典和回退标签辅助函数。参见[本地化](/zh/guide/localization)。   |
| `renderToCanvas`                                 | 函数             | 将 DOM 元素渲染到 Canvas，并兼容处理 oklch 颜色。                          |

## 下一步 {#next-steps}

- [快速上手](/zh/angular/getting-started)：最小可运行示例。
- [组件输入与输出](/zh/angular/props)：完整的 `@Input()` / `@Output()` 参考。
- [公开 API](/zh/angular/api)：组件实例暴露的方法。
- [主题](/zh/angular/theming)：颜色、圆角、CSS 变量和依赖注入提供程序。
- [服务](/zh/angular/services)：架构及公开服务接口。
- [导出](/zh/angular/export)：PNG、PDF、GIF、视频及 html2canvas-pro 流程。
- [实时协作](/zh/angular/collaboration)：Yjs 协同编辑和在线状态。
