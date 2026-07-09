---
title: Export
description: Export slides to PNG, PDF, GIF, and WebM video from the viewer, plus the standalone renderToCanvas utility and the html2canvas-pro pipeline.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas-pro` pipeline; PPTX goes through the core serializer.

## Supported formats

| Format | Pipeline                                                                                  |
| ------ | ----------------------------------------------------------------------------------------- |
| PNG    | `renderToCanvas` (html2canvas-pro) → `canvas.toBlob()` → download                         |
| PDF    | `jspdf` + per-slide canvases → multi-page PDF (one page per slide, sized to aspect ratio) |
| GIF    | Animated GIF frame encoder (`gif-export-helpers`)                                         |
| Video  | WebM via the browser `MediaRecorder` API (`video-export-helpers`)                         |
| Print  | Same per-slide capture loop, routed through `PrintService`                                |
| PPTX   | `PptxHandler.save()` → `Uint8Array` (Save As)                                             |

## How export is triggered

Export is **driven by the viewer's UI**, not by inputs or the public API:

- The ribbon's File tab / export actions invoke `ViewerExportService`, which resolves the live
  `.pptx-ng-canvas-stage` element for each slide in turn, captures it to a canvas via
  `ExportService.renderElement`, and assembles the result. Progress and cancellation are exposed
  through the `ExportProgressModalComponent` (open/title/progress/status signals, with a Cancel
  button wired to a cooperative `AbortController`).
- The only public, programmatic way to obtain document bytes is [`getContent()`](/angular/api) on
  the component instance, which returns the serialized `.pptx` `Uint8Array` - equivalent to the
  PPTX "Save As" path.

::: info No export method on the public API
There is no `export()` method. PNG/PDF/GIF/video exports and printing are user-initiated through the
ribbon/dialogs. If you need programmatic raster export of arbitrary DOM, use `renderToCanvas` (below)
directly, or inject `ExportService` yourself.
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
	options?: Partial<Html2CanvasOptions>,
): Promise<HTMLCanvasElement>;
```

It builds on `html2canvas-pro` and, during the `onclone` phase, runs the CSS preprocessing pipeline
shared with React and Vue (from `pptx-viewer-shared`, inlined at build time): it converts unsupported
color functions to `rgb()`/hex, and flattens `backdrop-filter`, `mix-blend-mode`, and CSS 3D
transforms that html2canvas-pro cannot render.

## `ExportService` and `ViewerExportService`

For advanced integrations you can inject the underlying services directly instead of driving them
through the ribbon:

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

`ExportService`'s methods (`savePptx`, `exportElementToPng`, `renderElement`, `exportCanvasesToPdf`,
`exportCanvasesToGif`, `exportCanvasesToWebm`) are pure rasterisation/assembly primitives with no
knowledge of the viewer's live slide navigation. `ViewerExportService` (also exported, see
[Services](/angular/services)) is the higher-level orchestrator the ribbon actually calls: it owns
the export-progress modal state, flips the live stage through every slide in turn, and reports
per-slide progress, but it requires a `bind()` call with host accessors (`activeSlideIndex`,
`slideCount`, `mergedSlides`, `resolveStage`) - reach for `ExportService` directly unless you are
reproducing the viewer's own multi-slide export loop.

## Pipeline limitations

Raster export inherits the html2canvas-pro constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter` and CSS 3D transforms are not natively supported - the pipeline preprocesses CSS
  to approximate them, so some fidelity is lost.
- `mix-blend-mode` is mapped to opacity fallbacks; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384×16384 or 32768×32768 px depending
  on browser/GPU), bounding maximum export resolution.

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
