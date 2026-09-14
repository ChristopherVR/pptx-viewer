---
title: 导出
description: 从查看器导出 PNG、PDF、GIF、WebM 视频和 SVG，另存为 PPTX，以及由工具栏驱动的 html2canvas-pro 流程和内部导出组合式函数。
---

# 导出 {#export}

查看器可以将幻灯片转换为多种格式，也可以将文档保存回 `.pptx`。栅格格式使用 `html2canvas-pro` 流程；SVG 使用核心 `SvgExporter`，由模型驱动，无需捕获 DOM；PPTX 使用核心序列化器。

## 支持的格式 {#supported-formats}

| 格式           | 处理流程                                                                                    | 输出文件                |
| -------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| PNG            | `html2canvas-pro` 栅格化（缩放比例固定为 2）→ `canvas.toDataURL('image/png')`               | `<name>-slide-<n>.png`  |
| PDF            | `jspdf`（延迟加载）+ 逐张幻灯片的 PNG 截图 → 多页 PDF，每页一张幻灯片，页面尺寸等于画布尺寸 | `<name>.pdf`            |
| GIF            | 共享的纯 JavaScript GIF89a 编码器（延迟加载），每张幻灯片默认 2000 毫秒                     | `<name>.gif`            |
| WebM           | 对画布捕获流使用 `MediaRecorder`（默认 30 fps、5 Mbps），每张幻灯片默认 3000 毫秒           | `<name>.webm`           |
| SVG            | 核心 `SvgExporter`：包根入口的**稳定**函数，见下文                                          | 每张幻灯片的 SVG 标记   |
| 复制为图片     | 栅格化当前幻灯片 → `ClipboardItem({'image/png'})` → 系统剪贴板                              | -                       |
| 打印           | `usePrint`：幻灯片（矢量 SVG 文档）、大纲（HTML）、备注或讲义（栅格化）、打印窗口           | 打印窗口                |
| JSON           | 核心模型序列化器 `exportToJson`，生成可完整重新导入的可移植 JSON 文档                       | `<name>.json`           |
| 共享包         | 使用 JSZip 打包序列化后的 `.pptx` 和自动生成的 README                                       | `<name>-package.zip`    |
| PPTX/PPSX/PPTM | `saveAs(format)` → `PptxHandler.save()` → `Uint8Array`（另存为）                            | `presentation.<format>` |

`<name>` 为去除扩展名后的 `fileName` 属性，默认是 `presentation`。

::: info 不提供 JPEG 和用户可调缩放选项
Vue 绑定没有 JPEG 输出，栅格化比例固定为 2 倍，工具栏流程中没有分辨率或质量选项。
:::

## 如何触发导出 {#how-export-is-triggered}

导出由**查看器界面驱动**，不通过属性或暴露的 API 控制：

- 工具栏或导出对话框调用内部 `useExportWiring` 组合式函数，它组合使用 `useExport`（PNG/PDF）、`useMediaExport`（GIF/WebM）、`usePrint`，以及负责进度弹窗和通过 `AbortController` 协作式取消的 `useExportProgress`。
- 公开的编程方式中，只有暴露的 [`getContent()`](/zh/vue/handle) 可以取得文档字节。它返回序列化后的 `.pptx` `Uint8Array`，等同于 PPTX“另存为”流程（内部调用 `saveAs('pptx')`）。

::: info 暴露的句柄没有导出方法
`defineExpose` 接口不提供栅格图、PDF、GIF、WebM 或打印方法；这些操作由用户通过工具栏或对话框发起。需要编程控制时，可使用下面的稳定 SVG 函数、`renderToCanvas`（签名与 [React 文档](/zh/react/export#rendertocanvas)相同），或内部组合式函数。
:::

## `renderToCanvas` {#rendertocanvas}

```ts
import { renderToCanvas } from 'pptx-vue-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, { scale: 2 });
```

这是 React、Angular、Svelte 和原生 JavaScript 绑定也导出的同一个 `html2canvas-pro` 包装函数：它将现代 CSS 颜色函数（`oklch` / `oklab` / `lch` / `lab` / `color()`）规范化为 sRGB，并在栅格化之前对克隆的捕获文档执行共享 CSS 预处理。建议使用它，不要直接调用 `html2canvas`，因为查看器主题令牌使用 `oklch`，而 html2canvas 无法解析。

## 稳定接口：SVG 导出函数 {#stable-svg-export-functions}

包根入口导出四个矢量导出函数，它们是**稳定** API 中唯一的一组导出接口：

```ts
import { exportSlideToSvg, exportAllSlidesToSvg } from 'pptx-vue-viewer';
// also: exportSlideToSvgBlob, exportAllSlidesToSvgBlobs

const svg: string = exportSlideToSvg(slide, width, height, options);
const all: string[] = exportAllSlidesToSvg(pptxData, options);
```

`SvgExportOptions`（来自 `pptx-viewer-core`）包括：`includeHidden`（默认 `false`）、`slideIndices`（从 0 开始的索引子集）、`defaultFontFamily`、`defaultFontSize`。

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PowerPointViewer, exportSlideToSvg } from 'pptx-vue-viewer';
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';

const viewer = ref<PowerPointViewerExpose>();

function downloadActiveSlideSvg() {
	const slide = viewer.value?.getActiveSlide();
	if (!slide) return;
	const svg = exportSlideToSvg(slide, 960, 540);
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
	const a = Object.assign(document.createElement('a'), { href: url, download: 'slide.svg' });
	a.click();
	URL.revokeObjectURL(url);
}
</script>

<template>
	<button @click="downloadActiveSlideSvg">Export active slide as SVG</button>
	<PowerPointViewer ref="viewer" :content="content" />
</template>
```

## 内部接口：导出组合式函数 {#internals-the-export-composables}

其余接口可以通过 `pptx-vue-viewer/internals` 使用。这些内部构建模块**不受**语义化版本兼容承诺保障，请优先使用稳定的根入口导出：

| 组合式函数          | 返回值                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useExport`         | `{ exporting, exportSlidePng(index), exportPdf(options?) }`                                                                                       |
| `useMediaExport`    | `{ exporting, progress, exportGif(options?), exportWebm(options?) }`，两个导出方法均返回解析为编码后 `Blob` 的 Promise                            |
| `usePrint`          | `{ isPrintDialogOpen, openPrintDialog(), closePrintDialog(), print(settings) }`                                                                   |
| `useExportProgress` | `{ exportModalOpen, exportModalTitle, exportProgress, exportStatusMessage, runPdf(), runGif(), runWebm(), cancelExport() }`                       |
| `useExportWiring`   | 查看器自身使用的完整接线逻辑：`rasterizeSlide`、`onExportPng/Pdf/Gif/Webm()`、`downloadAs(format)`、`packageForSharing()`、`onCopySlideAsImage()` |

`useExport`、`useMediaExport` 和 `usePrint` 使用依赖注入：接受你的 `slides` / `slideCount` ref，以及自行提供的 `rasterizeSlide: (index: number) => Promise<HTMLCanvasElement>`，因此可以驱动任意自行渲染的舞台。

选项结构如下，名称和默认值与实现一致：

```ts
interface ExportPdfOptions {
	onProgress?: (current: number, total: number) => void;
	signal?: AbortSignal;
}

interface MediaExportOptions {
	// GIF: default 2000 ms per slide; WebM: default 3000 ms
	slideDurationMs?: number;
	slideTimingsMs?: number[]; // per-slide overrides (rehearsed timings)
	onProgress?: (current: number, total: number) => void;
	signal?: AbortSignal;
}

interface WebmExportOptions extends MediaExportOptions {
	fps?: number; // default 30
	videoBitsPerSecond?: number; // default 5,000,000
	onRecordProgress?: (current: number, total: number) => void;
}
```

取消采用协作式机制：循环会在幻灯片之间检查 `signal?.aborted`，并抛出名为 `AbortError` 的 `DOMException`；`useExportProgress.cancelExport()` 会中止共享控制器。

## 打印 {#print}

`usePrint`（通过 `useExportWiring` 组合）驱动独立的打印对话框和打印窗口流程，支持幻灯片、备注页、讲义（每页 1/2/3/4/6/9 张幻灯片）和大纲视图。它由共享的 `PrintSettings` 控制：`printWhat`（`'slides' | 'handouts' | 'notes' | 'outline'`）、`orientation`、`colorMode`（`'color' | 'grayscale' | 'blackAndWhite'`）、`frameSlides`、`slidesPerPage`，以及 `slideRange`（`'all' | 'current' | 'custom'`，自定义范围使用 `customRangeFrom` / `To`）。幻灯片通过矢量 SVG 文档打印，大纲使用普通 HTML，无需栅格化；备注和讲义复用栅格化截图。

## 导出流程的限制 {#pipeline-limitations}

栅格导出受 `html2canvas-pro` 的限制，参见[已知限制](/zh/guide/limitations)：

- 原生不支持 `backdrop-filter`、CSS `var()` 和 CSS 三维变换，栅格捕获会损失部分保真度。
- `mix-blend-mode` 采用近似实现，路径渐变会转换为椭圆径向渐变。
- 画布尺寸受浏览器上限约束，通常为 16384×16384 或 32768×32768 像素，取决于浏览器和 GPU，因此最大导出分辨率也受限制。

::: tip 矢量替代方案
对栅格化保真度有要求时，优先使用稳定的 **SVG** 函数。核心 `SvgExporter` 输出与分辨率无关的标记，完全避开 html2canvas 的近似处理。
:::

PPTX 格式底层的保存与序列化说明见[核心引擎](/zh/core/)。
