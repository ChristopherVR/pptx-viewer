---
title: 导出
description: 从 React 组件导出 PNG、PDF、GIF、WebM、SVG 和备注 PDF，了解另存为、renderToCanvas 及内部导出 hooks。
---

# 导出 {#export}

组件可将幻灯片转换为多种格式，也可将文档保存为 `.pptx`。位图格式使用 `html2canvas-pro` 流程，SVG 使用基于模型、与分辨率无关的核心 `SvgExporter`，PPTX 使用核心序列化器。

## 支持的格式 {#supported-formats}

| 格式           | 处理流程                                                                                                         | 输出文件                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| PNG            | `renderToCanvas`（html2canvas-pro，倍率 2）→ `canvas.toBlob('image/png')`，也可通过 `ClipboardItem` 复制到剪贴板 | `slide-<n>.png`          |
| PDF（幻灯片）  | 逐页 Canvas（倍率 2）→ JPEG 帧（质量 0.92）→ 纯 PDF 字节构建器，不使用 jspdf，每张幻灯片一张 A4 页               | `presentation.pdf`       |
| PDF（备注）    | 相同捕获流程，加上备注页布局构建器                                                                               | `presentation-notes.pdf` |
| GIF            | 逐页 Canvas（倍率 0.5）→ 共享的纯 JavaScript GIF89a 编码器，每页 2000 ms                                         | `presentation.gif`       |
| 视频（WebM）   | 逐页 Canvas（倍率 1）→ Canvas `captureStream` + `MediaRecorder`，30 fps、5 Mbps，每页 3000 ms                    | `presentation.webm`      |
| SVG            | 核心 `SvgExporter`，矢量格式，也用于矢量打印                                                                     | 每页一个 SVG             |
| 打印           | 倍率 3 的位图捕获和 HTML 打印文档，支持幻灯片、备注、讲义和大纲，或使用矢量 SVG 打印文档                         | 打印窗口                 |
| JSON           | 核心模型序列化器 `exportToJson`，生成可完整重新导入的可移植 JSON 文档                                            | `presentation.json`      |
| 共享包         | 使用 JSZip 打包序列化后的 `.pptx` 和生成的 `README.txt`                                                          | `<name>-package.zip`     |
| PPTX/PPSX/PPTM | `PptxHandler.save()`，设置密码时为 `saveEncrypted()`，生成用于另存为的 `Uint8Array`                              | `presentation.<ext>`     |

::: info JPEG
没有单独的 JPEG 导出。质量为 0.92 的 JPEG 编码仅用于压缩 PDF 中的幻灯片帧。
:::

## 如何触发导出 {#how-export-is-triggered}

导出由**组件界面**发起，不通过属性或命令式句柄触发：

- 工具栏和导出对话框调用内部 `useExportHandlers` hook，执行上述流程，报告进度，并通过 `AbortController` 支持取消。打印使用同级的 `usePrintHandlers`。
- 稳定命令式句柄中，与导出相关的方法只有 [`getContent()`](/zh/react/handle)，返回序列化后的 `.pptx` `Uint8Array`，等同于 PPTX 的另存为路径。

::: info 稳定句柄没有 export 方法
`PowerPointViewerHandle` 不包含 `export()`。PNG、PDF、GIF、视频和打印由用户通过工具栏或对话框发起。任意 DOM 的编程位图导出可以使用下文的 `renderToCanvas`；需要编程控制组件自身导出流程时，可通过内部子路径使用 hooks。
:::

## 编程导出：`pptx-react-viewer/internals` {#programmatic-export-pptx-react-viewer-internals}

`useExportHandlers` 和 `usePrintHandlers` 从 `pptx-react-viewer/internals` 导出，明确**不受语义化版本兼容保证约束**。稳定根入口仅提供 `renderToCanvas`、组件及句柄。`useExportHandlers(input)` 返回：

```ts
interface ExportHandlersResult {
	handleExportPng: () => Promise<void>; // current slide → PNG download
	handleExportPdf: () => Promise<void>; // all slides → PDF
	handleExportNotesPdf: () => Promise<void>; // all slides → notes-page PDF
	handleCopySlideAsImage: () => Promise<void>; // current slide → clipboard PNG
	handleExportVideo: () => Promise<void>; // all slides → WebM
	handleExportGif: () => Promise<void>; // all slides → GIF
	handlePackageForSharing: () => Promise<void>; // .pptx + README in a ZIP
	handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>; // 'pptx' | 'ppsx' | 'pptm'
	handleSaveAsPptx: () => void;
	handleSaveAsPpsx: () => void;
	handleSaveAsPptm: () => void;
	handleCancelExport: () => void; // aborts the in-flight export
	exportModalOpen: boolean; // progress modal state...
	exportModalTitle: string;
	exportProgress: number; // 0-100
	exportStatusMessage: string;
}
```

其输入涉及组件内部状态，包括幻灯片、实际画布舞台 ref、核心处理器 ref、`serializeSlides` 回调和另存为元数据，因此适合在自定义预览器界面内使用，不适合作为独立工具函数。底层各格式工具接受以下选项：

| 内部工具                     | 选项和默认值                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG（`PngExportOptions`）    | `scale` 默认 2，`backgroundColor`                                                                                                                    |
| PDF（`PdfExportOptions`）    | `scale` 默认 2，`onProgress(current, total)`，`signal`                                                                                               |
| GIF（`GifExportOptions`）    | `scale` 默认 0.5，`slideDurationMs` 默认 2000，`onProgress`，`signal`                                                                                |
| 视频（`VideoExportOptions`） | `scale` 默认 1，`slideDurationMs` 默认 3000，`slideTimingsMs` 为各页排练时间，另有 `onProgress`、`onRecordProgress`、`signal`；30 fps 和 5 Mbps 固定 |

长时间导出共用进度和取消机制：创建 `AbortController`，将 `signal` 传入捕获循环，在幻灯片之间通过抛出 `AbortError` 类型的 `DOMException` 取消，并使用共享逻辑计算百分比。捕获占进度条的大部分，组装阶段固定为 95%，完成时为 100%。

## 打印 {#print}

`usePrintHandlers` 驱动打印对话框和打印窗口，支持幻灯片、备注页、每页 1/2/3/4/6/9 张的讲义和大纲。`PrintSettings` 包括打印内容、方向、颜色模式（`'color' | 'grayscale' | 'blackAndWhite'`）、幻灯片边框和范围（`'all' | 'current' | 'custom'`）。幻灯片可通过**矢量 SVG** 文档打印，无需栅格化；备注和讲义则按倍率 3 捕获。

## `renderToCanvas` {#rendertocanvas}

从包根入口导出的独立工具，将 DOM 元素绘制到 Canvas，并处理 `html2canvas-pro` 对 oklch、oklab、lch、lab 和 `color()` 等现代颜色空间解析的兼容问题。

```ts
import { renderToCanvas } from 'pptx-react-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, options);
const dataUrl = canvas.toDataURL('image/png');
```

签名：

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

它基于 `html2canvas-pro`，在 `onclone` 阶段调用共享渲染层的 `normalizeColorsForCapture` 和 `preprocessCssForCapture`。这些处理使用 Canvas 2D API 将不支持的颜色函数转换为 sRGB，修补 Tailwind v4 的 oklch 自定义属性，并扁平化 html2canvas 无法渲染的 `backdrop-filter`、`mix-blend-mode` 和 CSS 三维变换。

## 示例：从自己的界面另存为 {#example-save-as-from-your-own-ui}

```tsx
import { useRef } from 'react';
import { PowerPointViewer, type PowerPointViewerHandle } from 'pptx-react-viewer';

export function DeckWithDownload({ content }: { content: Uint8Array }) {
	const viewerRef = useRef<PowerPointViewerHandle>(null);

	const download = async () => {
		const bytes = await viewerRef.current!.getContent(); // serialized .pptx
		const blob = new Blob([bytes], {
			type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		});
		const url = URL.createObjectURL(blob);
		const a = Object.assign(document.createElement('a'), { href: url, download: 'deck.pptx' });
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<button onClick={download}>Download .pptx</button>
			<PowerPointViewer ref={viewerRef} content={content} />
		</>
	);
}
```

## 导出流程的限制 {#pipeline-limitations}

位图导出受到 html2canvas 的限制，详见[功能限制](/zh/guide/limitations)：

- 不原生支持 `backdrop-filter`、CSS `var()` 和 CSS 三维变换，组件通过 CSS 预处理近似表达，因此可能损失部分还原度。
- `mix-blend-mode` 回退为不透明度处理，路径渐变转换为椭圆径向渐变。
- Canvas 尺寸受浏览器和 GPU 限制，常见上限为 16384×16384 或 32768×32768 像素，因此该捕获方式的最高分辨率也有限制。

::: tip 矢量替代方案
关注位图还原度时，可以优先考虑 **SVG** 路径。核心 `SvgExporter` 输出与分辨率无关的矢量标记，避开 html2canvas 的颜色和效果近似处理。
:::

PPTX 格式底层的保存与序列化说明见[核心引擎](/zh/core/)。
