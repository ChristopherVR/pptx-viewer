---
title: Export
description: Export slides to PNG, PDF, GIF, WebM video, and SVG from the viewer, plus the standalone renderToCanvas utility, the ExportService/ViewerExportService pair, and PrintService.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas-pro` pipeline; SVG goes through the core `SvgExporter`; PPTX goes
through the core serializer.

## Supported formats

| Format          | Pipeline                                                                                                      | Output file                |
| --------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PNG             | `renderToCanvas` (html2canvas-pro, scale 2) → `canvas.toBlob('image/png')`; also copy-to-clipboard            | `slide-<n>.png`            |
| PDF             | jsPDF: per-slide canvases → JPEG frames (quality 0.92) → A4 pages (orientation follows the aspect ratio)      | `presentation.pdf`         |
| GIF             | Shared pure-JS GIF89a encoder, 2000 ms per slide, frames clamped to a 1920 px longest side                    | `presentation.gif`         |
| Video (WebM)    | `MediaRecorder` over a canvas capture stream (30 fps, 5 Mbps default), 3000 ms per slide                      | `presentation.webm`        |
| SVG             | Core `SvgExporter` via `ExportService.exportSlideToSvg` / `exportAllSlidesToSvg` (vector, no DOM capture)     | per-slide SVG              |
| Print           | `PrintService`: slides print as vector SVG, outline as HTML, notes/handouts from rasterised captures          | print window               |
| JSON            | `exportToJson` (core model serializer): a portable JSON document that re-imports with full fidelity           | `presentation.json`        |
| Package (share) | `ViewerFileIOService.packageForSharing()`: ZIP bundle of the serialized `.pptx` plus a README                 | `presentation-package.zip` |
| PPTX/PPSX/PPTM  | `ViewerFileIOService.saveAs(format)` → `PptxHandler.save()` → `Uint8Array` (Save As, correct MIME per format) | `presentation.<format>`    |

::: info JPEG
There is no standalone JPEG export; JPEG (quality 0.92) is only used to compress slide frames
inside exported PDFs.
:::

## How export is triggered

Export is **driven by the viewer's UI**, not by inputs or the public API:

- The ribbon's File tab / export actions invoke `ViewerExportService`, which resolves the live
  `.pptx-ng-canvas-stage` element for each slide in turn, captures it to a canvas via
  `ExportService.renderElement`, and assembles the result. Progress and cancellation are exposed
  through `ExportProgressModalComponent` (inputs `open`/`title`/`progress`/`statusMessage`, output
  `cancel`), backed by a cooperative `AbortController`.
- The only public, programmatic way to obtain document bytes is [`getContent()`](/angular/api) on
  the component instance, which returns the serialized `.pptx` `Uint8Array` - equivalent to the
  PPTX "Save As" path. It also emits the bytes on the `contentChange` output.

::: info No export method on the component
`PowerPointViewerComponent` has no public `export()` method. PNG/PDF/GIF/video exports and printing
are user-initiated through the ribbon/dialogs (individually hideable via the `hiddenActions` input,
e.g. `'export'`). If you need programmatic raster export of arbitrary DOM, use `renderToCanvas`
(below) directly, or inject `ExportService` yourself.
:::

## `renderToCanvas`

A standalone utility (exported from the package root) that rasterizes a DOM element to a Canvas,
working around browsers' modern-color-space (oklch/oklab/lch/lab/`color()`) parsing limitations in
`html2canvas-pro`.

```ts
import { renderToCanvas } from 'pptx-angular-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, options);
```

Signature:

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

It builds on `html2canvas-pro` and, during the `onclone` phase, runs the CSS preprocessing pipeline
shared with React and Vue (from `pptx-viewer-shared`, inlined at build time): it converts unsupported
color functions to `rgb()`/hex, and flattens `backdrop-filter`, `mix-blend-mode`, and CSS 3D
transforms that html2canvas-pro cannot render.

## `ExportService`

Stable, exported from the package root; provide and inject it to reuse the viewer's
rasterisation/assembly primitives in your own components:

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

Complete public surface (exact signatures):

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

The WebM recorder options (shared `recordWebm`) default to `fps: 30`,
`videoBitsPerSecond: 5_000_000`, and a MIME type picked from
`['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']` via
`MediaRecorder.isTypeSupported`. The GIF planner supports `slideTimingsMs` per-slide overrides and
clamps frame dimensions to a 1920 px longest side; the shared helpers (`planGifFrames`, `encodeGif`,
`planVideoSegments`, `recordWebm`, `pickSupportedMimeType`, ...) are all exported from the package
root too.

## `ViewerExportService` (internals)

`ViewerExportService` is the higher-level orchestrator the ribbon actually calls: it owns the
export-progress modal state (signals `exporting`, `modalOpen`, `modalTitle`, `progress`,
`statusMessage`), flips the live stage through every slide in turn (with a settle delay per slide),
and reports per-slide progress. Its public methods are `exportPng()`, `copySlideAsImage()`,
`exportPdf()`, `exportGif()`, `exportVideo()`, `onPrint(settings)`, and `onCancelExport()`; they
take no options (durations and file names are the viewer's fixed defaults listed above).

It requires a `bind()` call with host accessors before use:

```ts
xport.bind({
	activeSlideIndex, // WritableSignal<number>, written to flip the live stage
	slideCount: () => number,
	mergedSlides: () => readonly PptxSlide[],
	resolveStage: () => HTMLElement | undefined, // resolves .pptx-ng-canvas-stage
});
```

::: warning Internal building blocks
`ViewerExportService` and `ExportProgressModalComponent` ship through the package's
`pptx-angular-viewer/internals` surface (not covered by semver), unlike `ExportService`,
`PrintService`, and `renderToCanvas`, which are stable root exports. Reach for `ExportService`
unless you are reproducing the viewer's own multi-slide export loop. See [Services](/angular/services).
:::

## Print: `PrintService`

`PrintService` (stable export) drives the print dialog and window:

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

`PrintSettings` (shared shape, with `DEFAULT_PRINT_SETTINGS`): `printWhat`
(`'slides' | 'handouts' | 'notes' | 'outline'`, default `'slides'`), `orientation` (default
`'landscape'`), `colorMode` (`'color' | 'grayscale' | 'blackAndWhite'`), `frameSlides`,
`slidesPerPage` (`1 | 2 | 3 | 4 | 6 | 9`, default `6`), `slideRange`
(`'all' | 'current' | 'custom'`), `customRangeFrom`, `customRangeTo`. Slides print as vector SVG
and the outline as HTML (no rasterisation); notes and handouts rasterise each selected slide via
`captureSlide`.

## Progress and cancellation

All multi-slide exports share one pattern: `ViewerExportService` creates an `AbortController` per
run, the capture loop checks the signal between slides and throws an `AbortError` `DOMException`,
and `onCancelExport()` aborts it. Progress percentages come from the shared math
(`slideProgressPercent`, `recordProgressPercent`; assembly pinned at 95, done at 100), rendered by
`ExportProgressModalComponent` (only its Cancel button dismisses it).

## Example: PNG button next to the viewer

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

## Pipeline limitations

Raster export inherits the html2canvas-pro constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter` and CSS 3D transforms are not natively supported - the pipeline preprocesses CSS
  to approximate them, so some fidelity is lost.
- `mix-blend-mode` is mapped to opacity fallbacks; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384×16384 or 32768×32768 px depending
  on browser/GPU), bounding maximum export resolution.

::: tip Vector alternative
When raster fidelity matters, prefer the **SVG** methods on `ExportService` - the core
`SvgExporter` emits resolution-independent vector markup and sidesteps the html2canvas
approximations.
:::

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
