---
title: 导出
description: 从查看器导出 PNG、PDF、GIF、WebM 视频和 SVG，以及独立的 renderToCanvas 工具、ExportService/ViewerExportService 和 PrintService。
---

# 导出 {#export}

查看器可以将幻灯片转换为多种格式，也可以将文档保存回 `.pptx`。栅格格式使用 `html2canvas-pro` 流程，SVG 使用核心 `SvgExporter`，PPTX 使用核心序列化器。

## 支持的格式 {#supported-formats}

| 格式           | 处理流程                                                                                                         | 输出文件                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PNG            | `renderToCanvas`（html2canvas-pro，缩放比例为 2）→ `canvas.toBlob('image/png')`；也支持复制到剪贴板              | `slide-<n>.png`            |
| PDF            | jsPDF：逐张幻灯片画布 → JPEG 图像帧（质量 0.92）→ A4 页面，方向随宽高比确定                                      | `presentation.pdf`         |
| GIF            | 共享的纯 JavaScript GIF89a 编码器，每张幻灯片 2000 毫秒，帧最长边限制为 1920 像素                                | `presentation.gif`         |
| 视频（WebM）   | 对画布捕获流使用 `MediaRecorder`（默认 30 fps、5 Mbps），每张幻灯片 3000 毫秒                                    | `presentation.webm`        |
| SVG            | 通过 `ExportService.exportSlideToSvg` / `exportAllSlidesToSvg` 使用核心 `SvgExporter`，输出矢量图，无需捕获 DOM  | 每页一个 SVG               |
| 打印           | `PrintService`：幻灯片以矢量 SVG 打印，大纲使用 HTML，备注和讲义使用栅格化截图                                   | 打印窗口                   |
| JSON           | 核心模型序列化器 `exportToJson`，生成可完整重新导入的可移植 JSON 文档                                            | `presentation.json`        |
| 共享包         | `ViewerFileIOService.packageForSharing()`：将序列化后的 `.pptx` 和 README 打包为 ZIP                             | `presentation-package.zip` |
| PPTX/PPSX/PPTM | `ViewerFileIOService.saveAs(format)` → `PptxHandler.save()` → `Uint8Array`，另存为时使用对应格式的正确 MIME 类型 | `presentation.<format>`    |

::: info JPEG
没有独立的 JPEG 导出；JPEG（质量 0.92）仅用于压缩导出 PDF 中的幻灯片图像帧。
:::

## 如何触发导出 {#how-export-is-triggered}

导出由**查看器界面驱动**，不通过输入或公开 API 控制：

- 功能区的文件选项卡或导出操作调用 `ViewerExportService`，它依次找到每张幻灯片当前的 `.pptx-ng-canvas-stage` 元素，通过 `ExportService.renderElement` 捕获到画布，再组装结果。进度和取消操作通过 `ExportProgressModalComponent` 提供，输入为 `open` / `title` / `progress` / `statusMessage`，输出为 `cancel`，底层使用协作式 `AbortController`。
- 公开的编程方式中，只有组件实例的 [`getContent()`](/zh/angular/api) 可以取得文档字节。它返回序列化后的 `.pptx` `Uint8Array`，等同于 PPTX“另存为”流程，也会通过 `contentChange` 输出发出字节。

::: info 组件没有导出方法
`PowerPointViewerComponent` 没有公开的 `export()` 方法。PNG、PDF、GIF、视频导出和打印由用户通过功能区或对话框发起，可以用 `hiddenActions` 输入逐项隐藏，例如 `'export'`。需要对任意 DOM 编程执行栅格导出时，请直接使用下面的 `renderToCanvas`，或自行注入 `ExportService`。
:::

## `renderToCanvas` {#rendertocanvas}

从包根入口导出的独立工具，将 DOM 元素绘制到 Canvas，并处理 `html2canvas-pro` 对 oklch、oklab、lch、lab 和 `color()` 等现代颜色空间解析的兼容问题。

```ts
import { renderToCanvas } from 'pptx-angular-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, options);
```

签名：

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

它基于 `html2canvas-pro`，在 `onclone` 阶段运行与 React 和 Vue 共享的 CSS 预处理流程，来自 `pptx-viewer-shared`，在构建时内联。它将不支持的颜色函数转换为 `rgb()` 或十六进制，并将 html2canvas-pro 无法渲染的 `backdrop-filter`、`mix-blend-mode` 和 CSS 三维变换展平处理。

## `ExportService` {#exportservice}

这是由包根入口导出的稳定接口。可以提供并注入它，在自己的组件中复用查看器的栅格化和组装基础功能：

```ts
import { ExportService } from 'pptx-angular-viewer';

@Component({ providers: [ExportService] })
export class MyComponent {
	private readonly exportSvc = inject(ExportService);

	async exportPng(el: HTMLElement) {
		await this.exportSvc.exportElementToPng(el, 'slide-1.png');
	}
}
```

完整公开接口及精确签名如下：

```ts
// Vector (core SvgExporter)
exportSlideToSvg(slide: PptxSlide, width: number, height: number, options?: SvgExportOptions): string;
exportSlideToSvgBlob(slide: PptxSlide, width: number, height: number, options?: SvgExportOptions): Blob;
exportAllSlidesToSvg(data: PptxData, options?: SvgExportOptions): string[];

// Presentation bytes
savePptx(bytes: Uint8Array, fileName: string): void;
savePresentation(bytes: Uint8Array, fileName: string, format: PptxSaveFormat): void; // correct MIME per format

// Raster primitives (scale default 2)
exportElementToPng(el: HTMLElement, fileName: string, scale?: number): Promise<void>;
copyElementAsPng(el: HTMLElement, scale?: number): Promise<void>; // clipboard
renderElement(el: HTMLElement, scale?: number): Promise<HTMLCanvasElement>;

// Assembly from captured canvases
exportCanvasesToPdf(canvases: HTMLCanvasElement[], canvasWidth: number, canvasHeight: number, fileName: string): void;
exportCanvasesToGif(canvases: HTMLCanvasElement[], slideDurationMs: number, fileName: string): void;
exportCanvasesToWebm(
	canvases: HTMLCanvasElement[],
	slideDurationMs: number,
	fileName: string,
	signal?: AbortSignal,
	onProgress?: (current: number, total: number) => void,
): Promise<void>;
```

WebM 录制器选项（共享的 `recordWebm`）默认是 `fps: 30`、`videoBitsPerSecond: 5_000_000`，MIME 类型通过 `MediaRecorder.isTypeSupported` 从 `['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']` 中选择。GIF 规划器支持通过 `slideTimingsMs` 逐张覆盖时长，并将帧的最长边限制为 1920 像素。共享辅助函数（`planGifFrames`、`encodeGif`、`planVideoSegments`、`recordWebm`、`pickSupportedMimeType` 等）也都从包根入口导出。

## `ViewerExportService`（内部接口） {#viewerexportservice-internals}

`ViewerExportService` 是功能区实际调用的高层编排器：管理导出进度弹窗状态（信号 `exporting`、`modalOpen`、`modalTitle`、`progress`、`statusMessage`），依次将当前舞台切换到每张幻灯片，并逐张等待画面稳定，然后报告每张幻灯片的进度。公开方法包括 `exportPng()`、`copySlideAsImage()`、`exportPdf()`、`exportGif()`、`exportVideo()`、`onPrint(settings)` 和 `onCancelExport()`；它们不接受选项，时长和文件名采用上面列出的查看器固定默认值。

使用前需要调用 `bind()`，传入宿主访问器：

```ts
xport.bind({
	activeSlideIndex, // WritableSignal<number>, written to flip the live stage
	slideCount: () => number,
	mergedSlides: () => readonly PptxSlide[],
	resolveStage: () => HTMLElement | undefined, // resolves .pptx-ng-canvas-stage
});
```

::: warning 内部构建模块
`ViewerExportService` 和 `ExportProgressModalComponent` 通过 `pptx-angular-viewer/internals` 提供，不受语义化版本兼容承诺保障；`ExportService`、`PrintService` 和 `renderToCanvas` 则是稳定的根入口导出。除非要复现查看器自身的多幻灯片导出循环，否则应使用 `ExportService`。参见[服务](/zh/angular/services)。
:::

## 打印：`PrintService` {#print-printservice}

`PrintService` 是稳定导出，用于驱动打印对话框和窗口：

```ts
openDialog(): void;
closeDialog(): void;
updateSettings(partial: Partial<PrintSettings>, slideCount: number): PrintSettings;
print(
	settings: PrintSettings,
	slides: PptxSlide[],
	activeSlideIndex: number,
	captureSlide: (index: number) => Promise<string | null>, // PNG data URL per slide
	slideSize?: { width: number; height: number },
): Promise<boolean>; // false when the popup was blocked or nothing to print
```

`PrintSettings` 使用共享结构，带有 `DEFAULT_PRINT_SETTINGS`：`printWhat`（`'slides' | 'handouts' | 'notes' | 'outline'`，默认 `'slides'`）、`orientation`（默认 `'landscape'`）、`colorMode`（`'color' | 'grayscale' | 'blackAndWhite'`）、`frameSlides`、`slidesPerPage`（`1 | 2 | 3 | 4 | 6 | 9`，默认 `6`）、`slideRange`（`'all' | 'current' | 'custom'`）、`customRangeFrom`、`customRangeTo`。幻灯片以矢量 SVG 打印，大纲使用 HTML，无需栅格化；备注和讲义通过 `captureSlide` 栅格化每张选中的幻灯片。

## 进度与取消 {#progress-and-cancellation}

所有多幻灯片导出遵循相同模式：`ViewerExportService` 为每次运行创建 `AbortController`，捕获循环在幻灯片之间检查信号，并抛出名为 `AbortError` 的 `DOMException`；`onCancelExport()` 负责中止。进度百分比来自共享计算函数（`slideProgressPercent`、`recordProgressPercent`；组装阶段固定为 95，完成时为 100），由 `ExportProgressModalComponent` 渲染，只有取消按钮可以关闭它。

## 示例：在查看器旁添加 PNG 按钮 {#example-png-button-next-to-the-viewer}

```ts
import { Component, inject, viewChild, ElementRef } from '@angular/core';
import { ExportService, PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-deck',
	standalone: true,
	imports: [PowerPointViewerComponent],
	providers: [ExportService],
	template: `
		<button (click)="exportPng()">Export view as PNG</button>
		<div #host><pptx-viewer [content]="content" /></div>
	`,
})
export class DeckComponent {
	protected readonly content: Uint8Array = loadBytesSomehow();
	private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
	private readonly exportSvc = inject(ExportService);

	async exportPng() {
		const stage = this.host().nativeElement.querySelector<HTMLElement>('.pptx-ng-canvas-stage');
		if (stage) {
			await this.exportSvc.exportElementToPng(stage, 'slide.png');
		}
	}
}
```

## 导出流程的限制 {#pipeline-limitations}

栅格导出受 html2canvas-pro 的限制，参见[已知限制](/zh/guide/limitations)：

- 原生不支持 `backdrop-filter` 和 CSS 三维变换，流程通过 CSS 预处理近似实现，因此会损失部分保真度。
- `mix-blend-mode` 映射为透明度回退效果，路径渐变转换为椭圆径向渐变。
- 画布尺寸受浏览器上限约束，通常为 16384×16384 或 32768×32768 像素，取决于浏览器和 GPU，因此最大导出分辨率也受限制。

::: tip 矢量替代方案
对栅格化保真度有要求时，优先使用 `ExportService` 的 **SVG** 方法。核心 `SvgExporter` 输出与分辨率无关的矢量标记，避开 html2canvas 的近似处理。
:::

PPTX 格式底层的保存与序列化说明见[核心引擎](/zh/core/)。
