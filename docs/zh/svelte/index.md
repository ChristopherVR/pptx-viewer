---
title: Svelte 查看器概览
description: pptx-svelte-viewer 是 Svelte 5 PowerPoint 查看器组件，与 React、Vue、Angular 和原生 JavaScript 绑定使用同一引擎，通过一个组件渲染、编辑、放映和导出 .pptx 幻灯片。
---

# Svelte 查看器概览 {#svelte-viewer-overview}

`pptx-svelte-viewer` 是用于 `.pptx` 文件的 **Svelte 5** 查看器和编辑器组件。其 `<PowerPointViewer>` 组件使用与 React、Vue、Angular 和原生 JavaScript 绑定相同的共享渲染逻辑及主题系统渲染 `.pptx` 幻灯片。解析引擎（[`pptx-viewer-core`](/zh/core/)）和共享渲染层都打包在组件包中。

可以体验在线 [Svelte 演示](https://christophervr.github.io/pptx-viewer/demo-svelte/)。

## 提供的能力 {#what-it-provides}

| 能力           | 说明                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **幻灯片渲染** | 文本、形状、图片、组合、连接线、表格、图表、SmartArt（二维及可选三维）、媒体、墨迹、OLE，以及元素模型中的其他类型。    |
| **编辑**       | 通过 `editable` 启用插入、格式设置、组合、排列、拖动、缩放、旋转、富文本和备注、母版视图、撤销和重做，以及保存和下载。 |
| **导航**       | 适配桌面和移动端的响应式界面、缩略图栏、键盘导航和演讲者备注面板。                                                     |
| **放映**       | 通过真实 Fullscreen API 进入全屏放映模式，支持切换效果、动画播放，以及带观众窗口的演示者视图。                         |
| **导出**       | PNG、PDF、GIF、WebM 视频、SVG、打印（幻灯片、讲义、备注、大纲），以及另存为 `.pptx` / `.ppsx` / `.pptm`。              |
| **协作**       | 可选的 Yjs 实时协同编辑，使用 y-websocket 或无服务器的 y-webrtc，包含在线状态、远程光标和共享或广播对话框。            |
| **自动保存**   | 编辑时提供 `filePath`，即可在 IndexedDB 中保存带防抖的崩溃恢复快照；宿主可通过 `autosave={false}` 禁用。               |
| **主题**       | 共享的 `ViewerTheme` 系统，使用 `--pptx-*` CSS 自定义属性，包含朱红色预设。参见[主题](/zh/svelte/theming)。            |
| **国际化**     | 内置英文，可通过 `pptx-svelte-viewer/i18n` 注册更多语言。参见[本地化](/zh/svelte/i18n)。                               |

::: info 元素覆盖范围
底层解析器的精确支持范围，以及采用近似处理的功能，请参见[已知限制](/zh/guide/limitations)。
:::

## 安装 {#installation}

```bash
npm i pptx-svelte-viewer
```

需要 `svelte` ^5 peer 依赖。核心引擎（`pptx-viewer-core`）和共享渲染层已经**打包在内**，引擎的运行时依赖（`jszip`、`fast-xml-parser`）会随组件包自动安装。

两项功能具有可选依赖，仅在使用时需要安装：

```bash
npm i three                    # opt-in 3D SmartArt and 3D chart renderers
npm i yjs y-websocket          # collaboration, server-based transport
npm i yjs y-webrtc             # collaboration, serverless peer-to-peer transport
```

::: warning 导入样式表
与原生 JavaScript 绑定不同，Svelte 包不会在运行时注入样式。请在应用入口导入一次提取出的样式表：

```ts
import 'pptx-svelte-viewer/styles.css';
```

:::

::: info 仅提供 ESM
组件包只提供 ESM 构建。Svelte 5 客户端运行时仅支持 ESM，因此即使提供 CJS 产物，也无法成功通过 `require()` 加载。
:::

## 简单示例 {#quick-example}

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import 'pptx-svelte-viewer/styles.css';

	let bytes = $state<Uint8Array | null>(null);

	async function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) bytes = new Uint8Array(await file.arrayBuffer());
	}
</script>

<input type="file" accept=".pptx,.ppt" onchange={onPick} />
{#if bytes}
	<PowerPointViewer source={bytes} onload={({ slideCount }) => console.log(slideCount)} />
{/if}
```

## 主要导出 {#key-exports}

| 导出项                                                       | 类型 | 用途                                                                                  |
| ------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| `PowerPointViewer`                                           | 组件 | 查看器和编辑器组件。参见[快速上手](/zh/svelte/getting-started)。                      |
| `PowerPointViewerProps`, `ViewerLoadDetail`                  | 类型 | 属性和回调载荷。参见[组件属性](/zh/svelte/props)。                                    |
| `PowerPointViewerApi`                                        | 类型 | 通过 `bind:this` 访问的命令式接口。参见[实例 API](/zh/svelte/api)。                   |
| `ViewerTheme`, `ViewerThemeColors`                           | 类型 | 主题配置类型。参见[主题](/zh/svelte/theming)。                                        |
| `vermilionLightTheme`, `vermilionDarkTheme`                  | 常量 | 内置的朱红色亮色和深色预设。                                                          |
| `themeToCssVars`, `defaultCssVars`                           | 函数 | 将主题转换为 `--pptx-*` CSS 变量。                                                    |
| `registerTranslations`                                       | 函数 | 注册语言字典。参见[本地化](/zh/svelte/i18n)。                                         |
| `exportSlideToSvg`, `exportAllSlidesToSvg`, ...              | 函数 | 独立 SVG 导出辅助函数。参见[导出与打印](/zh/svelte/export#svg-standalone-functions)。 |
| `CollaborationConfig`, `CollaborationRole`                   | 类型 | 实时协同编辑配置。参见[实时协作](/zh/svelte/collaboration)。                          |
| `getAutosaveSnapshot`, `listAutosaveSnapshots`, ...          | 函数 | 供宿主驱动恢复流程的 IndexedDB 恢复存储辅助函数。                                     |
| `ExportPdfOptions`, `ExportGifOptions`, `ExportVideoOptions` | 类型 | 命令式导出方法的选项。参见[导出与打印](/zh/svelte/export)。                           |

## 渲染方式：CSS 与 DOM {#rendering-philosophy-css-not-canvas}

与此 monorepo 中所有绑定一样，幻灯片渲染为 **CSS 定位的 HTML/SVG**，通过 CSS transform 缩放，不绘制到 Canvas 上。文本在任意缩放下都保持可选中且清晰，屏幕阅读器也可以正常工作。相关取舍请参见[已知限制](/zh/guide/limitations)。

## 下一步 {#next-steps}

- [快速上手](/zh/svelte/getting-started)：挂载、加载、放映和编辑。
- [组件属性](/zh/svelte/props)：完整的属性和事件回调约定。
- [实例 API](/zh/svelte/api)：组件实例的全部方法。
- [主题](/zh/svelte/theming)：颜色、圆角、CSS 变量和朱红色预设。
- [导出与打印](/zh/svelte/export)：PNG、PDF、GIF、视频、SVG、打印和另存为。
- [实时协作](/zh/svelte/collaboration)：通过 Yjs 实现实时协同编辑。
- [本地化](/zh/svelte/i18n)：注册语言字典。
