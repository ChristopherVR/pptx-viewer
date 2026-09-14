---
title: Svelte 查看器导出与打印
description: 从 Svelte 查看器导出 PNG、PDF、GIF、WebM 视频和 SVG，使用独立 renderToCanvas 工具，打印幻灯片、讲义、备注和大纲，以及保存为 .pptx、.ppsx 或 .pptm。
---

# 导出与打印 {#export-print}

Svelte 查看器可以将幻灯片转换为多种格式，也可以将文档保存回 `.pptx`。所有功能都能通过内置工具栏的导出菜单使用，带有进度弹窗和取消操作；也可以通过[组件实例](/zh/svelte/api)编程调用。

## 支持的格式 {#supported-formats}

| 格式 | 处理流程                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------- |
| PNG  | `html2canvas-pro` 栅格化，首次使用时动态导入                                                       |
| PDF  | `jspdf`（动态导入）加栅格化，生成多页文档，每页一张幻灯片                                          |
| GIF  | 对栅格化图像帧使用动态 GIF 帧编码器                                                                |
| WebM | 对画布捕获流使用 `MediaRecorder`，编码格式从共享的 WebM 候选列表中选择                             |
| SVG  | 通过独立函数直接从解析后的数据模型导出矢量图，不进行栅格化                                         |
| 打印 | 在隐藏的同源 iframe 中打开共享打印文档，支持幻灯片、讲义、备注和大纲                               |
| JSON | 核心模型序列化器 `exportToJson`，生成可完整重新导入的可移植 JSON 文档                              |
| PPTX | 通过 `save(format)`、`downloadAs`、`downloadPptx` 使用核心序列化器（`'pptx' \| 'ppsx' \| 'pptm'`） |

::: tip 延迟加载依赖
`html2canvas-pro` 和 `jspdf` 采用动态导入，首次栅格图或 PDF 导出有一次性加载开销；从不导出的应用不会将它们发送到客户端。
:::

## 栅格图与视频导出 {#raster-and-video-export}

所有方法都位于组件实例上，通过 `bind:this` 获取：

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
	let progress = $state('');

	async function exportPdf() {
		await viewer?.exportPdf({
			onProgress: (current, total) => (progress = `${current}/${total}`),
		});
	}
</script>

<PowerPointViewer source={bytes} bind:this={viewer} />
<button onclick={() => viewer?.exportSlidePng()}>PNG (current slide)</button>
<button onclick={() => viewer?.copySlideAsImage()}>Copy as image</button>
<button onclick={exportPdf}>PDF {progress}</button>
```

### `ExportPdfOptions` {#exportpdfoptions}

| 选项         | 类型                                       | 默认值 | 说明                             |
| ------------ | ------------------------------------------ | ------ | -------------------------------- |
| `onProgress` | `(current: number, total: number) => void` | -      | 捕获阶段进度回调。               |
| `signal`     | `AbortSignal`                              | -      | 提前中止导出，在幻灯片之间检查。 |

### `ExportGifOptions` {#exportgifoptions}

| 选项              | 类型                                       | 默认值 | 说明                                         |
| ----------------- | ------------------------------------------ | ------ | -------------------------------------------- |
| `slideDurationMs` | `number`                                   | `2000` | 每张幻灯片的显示时长。                       |
| `slideTimingsMs`  | `number[]`                                 | -      | 逐张覆盖显示时长，索引与幻灯片索引对应。     |
| `maxDimension`    | `number`                                   | `960`  | 允许的输出最长边，单位为像素；帧按比例缩小。 |
| `onProgress`      | `(current: number, total: number) => void` | -      | 捕获阶段进度回调。                           |
| `signal`          | `AbortSignal`                              | -      | 提前中止导出。                               |

### `ExportVideoOptions` {#exportvideooptions}

| 选项                 | 类型                                       | 默认值      | 说明                               |
| -------------------- | ------------------------------------------ | ----------- | ---------------------------------- |
| `slideDurationMs`    | `number`                                   | `3000`      | 每张幻灯片的显示时长。             |
| `slideTimingsMs`     | `number[]`                                 | -           | 逐张覆盖幻灯片时长。               |
| `fps`                | `number`                                   | `30`        | 录制帧率。                         |
| `videoBitsPerSecond` | `number`                                   | `5_000_000` | 录制码率。                         |
| `onProgress`         | `(current: number, total: number) => void` | -           | 捕获阶段进度回调。                 |
| `onRecordProgress`   | `(current: number, total: number) => void` | -           | 录制阶段进度回调。                 |
| `signal`             | `AbortSignal`                              | -           | 在幻灯片之间和图像帧之间检查中止。 |

## `renderToCanvas` {#rendertocanvas}

从包根入口导出的独立工具，无需组件实例，可将任意 DOM 元素栅格化到 Canvas：

```ts
import { renderToCanvas } from 'pptx-svelte-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, { scale: 2 });
const dataUrl = canvas.toDataURL('image/png');
```

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

这是 React、Vue、Angular 和原生 JavaScript 绑定也导出的同一个 `html2canvas-pro` 包装函数。建议使用它，不要直接调用 `html2canvas`：它在 `onclone` 阶段执行共享 CSS 预处理，将现代颜色函数（`oklch` / `oklab` / `lch` / `lab` / `color()`）转换为 sRGB，并展平处理 `backdrop-filter`、`mix-blend-mode` 和 CSS 三维变换。查看器主题令牌使用 `oklch`，html2canvas 本身无法解析。

## 打印 {#print}

`print(options)` 组装共享打印文档并打开浏览器打印对话框。默认打印载体是隐藏的同源 iframe，不涉及弹出窗口。打印载体打开后，Promise 解析为 `true`。

```ts
await viewer?.print({ printWhat: 'handouts', slidesPerPage: 6, colorMode: 'grayscale' });
await viewer?.print({
	printWhat: 'slides',
	slideRange: 'custom',
	customRangeFrom: 2,
	customRangeTo: 5,
});
```

`PrintOptions` 可以是共享打印设置的任意子集：

| 选项              | 类型                                             | 默认值        | 说明                        |
| ----------------- | ------------------------------------------------ | ------------- | --------------------------- |
| `printWhat`       | `'slides' \| 'handouts' \| 'notes' \| 'outline'` | `'slides'`    | 打印内容。                  |
| `orientation`     | `'landscape' \| 'portrait'`                      | `'landscape'` | 页面方向。                  |
| `colorMode`       | `'color' \| 'grayscale' \| 'blackAndWhite'`      | `'color'`     | 颜色处理方式。              |
| `frameSlides`     | `boolean`                                        | `false`       | 在每张幻灯片周围绘制边框。  |
| `slidesPerPage`   | 讲义每页幻灯片数量                               | `6`           | 讲义布局密度。              |
| `slideRange`      | `'all' \| 'current' \| 'custom'`                 | `'all'`       | 要包含的幻灯片。            |
| `customRangeFrom` | `number`                                         | `1`           | 自定义范围起点，从 1 开始。 |
| `customRangeTo`   | `number`                                         | `1`           | 自定义范围终点，从 1 开始。 |

::: warning 弹窗拦截器
默认 iframe 载体不受弹窗拦截器影响。在控制器层注入自定义的 `window.open` 打开方式时则可能被拦截，被拦截后 Promise 解析为 `false`。
:::

## 保存文档 {#saving-the-document}

| 方法                | 签名                                                           | 说明                                                   |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | 通过核心处理器序列化幻灯片，包括编辑后的内容。         |
| `getContent`        | `() => Promise<Uint8Array>`                                    | 共享查看器约定中 `save()` 的别名。                     |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | 保存并以 `pptx`、`ppsx` 或 `pptm` 格式触发浏览器下载。 |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | 保存并使用默认名称下载 `.pptx`。                       |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | 组装并下载共享包。                                     |

## SVG：独立函数 {#svg-standalone-functions}

SVG 导出直接从解析后的数据模型生成矢量输出，以普通函数形式从包根入口导出，无需组件实例：

```ts
import { exportSlideToSvg, exportSlideToSvgBlob, exportSlideAsSvg } from 'pptx-svelte-viewer';
```

| 函数                        | 签名                                           | 返回值                   |
| --------------------------- | ---------------------------------------------- | ------------------------ |
| `exportSlideToSvg`          | `(slide, width, height, options?)`             | SVG 标记 `string`        |
| `exportSlideToSvgBlob`      | `(slide, width, height, options?)`             | `Blob` (`image/svg+xml`) |
| `exportSlideAsSvg`          | `(slide, slideIndex, width, height, options?)` | 触发下载                 |
| `exportAllSlidesToSvg`      | `(data, options?)`                             | `string[]`               |
| `exportAllSlidesToSvgBlobs` | `(data, options?)`                             | `Blob[]`                 |

`slide` 是 `PptxSlide`，可以从实例的 `getSlides()` / `getActiveSlide()` 获取；`width` / `height` 是 `onload` 载荷中以像素表示的画布尺寸。`exportAll*` 变体接受来自 [`pptx-viewer-core`](/zh/core/) 处理器的完整解析结果 `PptxData`。

选项（`SvgExportSingleSlideOptions` / `SvgExportAllOptions`）：

| 选项                | 类型       | 默认值  | 说明                               |
| ------------------- | ---------- | ------- | ---------------------------------- |
| `includeHidden`     | `boolean`  | `false` | 批量导出时包含隐藏页。             |
| `slideIndices`      | `number[]` | 全部    | 要导出的幻灯片索引，从 0 开始。    |
| `defaultFontFamily` | `string`   | -       | 元素未指定字体族时使用的回退字体。 |
| `defaultFontSize`   | `number`   | -       | 回退字号，单位为磅。               |

```ts
const slide = viewer?.getActiveSlide();
if (slide) {
	const svg = exportSlideToSvg(slide, canvasSize.width, canvasSize.height);
	// e.g. inline it, upload it, or hand it to a design tool
}
```

## 导出流程的限制 {#pipeline-limitations}

栅格导出受 `html2canvas-pro` 的限制，参见[已知限制](/zh/guide/limitations)：部分 CSS 功能（`backdrop-filter`、CSS 三维变换）在捕获时会损失保真度，`mix-blend-mode` 采用近似实现，画布尺寸受浏览器上限约束，从而限制导出分辨率。SVG 流程完全避开栅格化，但覆盖的是数据模型，无法复现任意 DOM 样式。
