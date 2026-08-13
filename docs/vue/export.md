---
title: Export
description: Export slides to PNG, PDF, GIF, WebM video, and SVG from the viewer, plus save-as PPTX, the toolbar-driven html2canvas-pro pipeline, and the internal export composables.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas-pro` pipeline; SVG goes through the core `SvgExporter` (model
driven, no DOM capture); PPTX goes through the core serializer.

## Supported formats

| Format          | Pipeline                                                                                                 | Output file             |
| --------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| PNG             | `html2canvas-pro` rasterisation (scale 2, fixed) → `canvas.toDataURL('image/png')`                       | `<name>-slide-<n>.png`  |
| PDF             | `jspdf` (lazy-loaded) + per-slide PNG captures → multi-page PDF (one slide per page, page = canvas size) | `<name>.pdf`            |
| GIF             | Shared pure-JS GIF89a encoder (lazy-loaded), 2000 ms per slide by default                                | `<name>.gif`            |
| WebM            | `MediaRecorder` over a canvas capture stream (30 fps, 5 Mbps default), 3000 ms per slide by default      | `<name>.webm`           |
| SVG             | Core `SvgExporter`: **stable** package-root functions (see below)                                        | per-slide SVG markup    |
| Copy as image   | Rasterise the active slide → `ClipboardItem({'image/png'})` → system clipboard                           | -                       |
| Print           | `usePrint`: slides (vector SVG document), outline (HTML), notes/handouts (rasterised), print window      | print window            |
| JSON            | `exportToJson` (core model serializer): a portable JSON document that re-imports with full fidelity      | `<name>.json`           |
| Package (share) | JSZip bundle of the serialized `.pptx` plus a generated README                                           | `<name>-package.zip`    |
| PPTX/PPSX/PPTM  | `saveAs(format)` → `PptxHandler.save()` → `Uint8Array` (Save As)                                         | `presentation.<format>` |

`<name>` is the `fileName` prop with its extension stripped, defaulting to `presentation`.

::: info No JPEG, no user-facing scale option
The Vue binding has no JPEG output, and the raster scale is fixed at 2x (there is no
resolution/quality option on the toolbar flows).
:::

## How export is triggered

Export is **driven by the viewer's UI**, not by props or the exposed API:

- The toolbar / export dialog invoke the internal `useExportWiring` composable, which composes
  `useExport` (PNG/PDF), `useMediaExport` (GIF/WebM), and `usePrint`, plus `useExportProgress` for
  the progress modal and cooperative cancellation through an `AbortController`.
- The only public, programmatic way to obtain document bytes is the exposed
  [`getContent()`](/vue/handle), which returns the serialized `.pptx` `Uint8Array`, equivalent to the
  PPTX "save-as" path (`saveAs('pptx')` internally).

::: info No export method on the exposed handle
The `defineExpose` surface has no raster/PDF/GIF/WebM/print methods; those are user-initiated
through the toolbar/dialog. For programmatic flows use the stable SVG functions below,
`renderToCanvas` (see [React's docs](/react/export#rendertocanvas) for the identical signature), or
the internal composables.
:::

## `renderToCanvas`

```ts
import { renderToCanvas } from 'pptx-vue-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, { scale: 2 });
```

The same `html2canvas-pro` wrapper React, Angular, Svelte and Vanilla export: it
normalises modern CSS colour functions (`oklch` / `oklab` / `lch` / `lab` /
`color()`) to sRGB and runs the shared CSS-preprocessing pass over the cloned
capture document before rasterising. Reach for it rather than calling
`html2canvas` yourself: the viewer's theme tokens are authored in `oklch`, which
html2canvas cannot parse.

## Stable: SVG export functions

The package root exports four vector-export functions (the only export family in the **stable**
API):

```ts
import { exportSlideToSvg, exportAllSlidesToSvg } from 'pptx-vue-viewer';
// also: exportSlideToSvgBlob, exportAllSlidesToSvgBlobs

const svg: string = exportSlideToSvg(slide, width, height, options);
const all: string[] = exportAllSlidesToSvg(pptxData, options);
```

`SvgExportOptions` (from `pptx-viewer-core`): `includeHidden` (default `false`), `slideIndices`
(0-based subset), `defaultFontFamily`, `defaultFontSize`.

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

## Internals: the export composables

Everything else is reachable via `pptx-vue-viewer/internals` (internal building blocks, **not**
covered by semver; prefer the stable root exports):

| Composable          | Returns                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useExport`         | `{ exporting, exportSlidePng(index), exportPdf(options?) }`                                                                                                 |
| `useMediaExport`    | `{ exporting, progress, exportGif(options?), exportWebm(options?) }` (both resolve to the encoded `Blob`)                                                   |
| `usePrint`          | `{ isPrintDialogOpen, openPrintDialog(), closePrintDialog(), print(settings) }`                                                                             |
| `useExportProgress` | `{ exportModalOpen, exportModalTitle, exportProgress, exportStatusMessage, runPdf(), runGif(), runWebm(), cancelExport() }`                                 |
| `useExportWiring`   | The full wiring the viewer itself uses: `rasterizeSlide`, `onExportPng/Pdf/Gif/Webm()`, `downloadAs(format)`, `packageForSharing()`, `onCopySlideAsImage()` |

`useExport`, `useMediaExport`, and `usePrint` are dependency-injected: they take your `slides` /
`slideCount` refs and a `rasterizeSlide: (index: number) => Promise<HTMLCanvasElement>` you supply,
so they can drive any stage you render.

Option shapes (exact names, with defaults):

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

Cancellation is cooperative: the loops check `signal?.aborted` between slides and throw an
`AbortError` `DOMException`; `useExportProgress.cancelExport()` aborts the shared controller.

## Print

`usePrint` (composed via `useExportWiring`) drives a dedicated print dialog and a print-window flow,
covering slides, notes pages, handouts (1/2/3/4/6/9 slides per page), and an outline view, driven by
the shared `PrintSettings`: `printWhat` (`'slides' | 'handouts' | 'notes' | 'outline'`),
`orientation`, `colorMode` (`'color' | 'grayscale' | 'blackAndWhite'`), `frameSlides`,
`slidesPerPage`, and `slideRange` (`'all' | 'current' | 'custom'` with `customRangeFrom`/`To`).
Slides print through a vector SVG document and the outline as plain HTML (no rasterisation);
notes/handouts reuse the rasterised captures.

## Pipeline limitations

Raster export inherits the `html2canvas-pro` constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter`, CSS `var()`, and CSS 3D transforms are not natively supported, some fidelity is
  lost in the raster capture.
- `mix-blend-mode` is approximated; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384x16384 or 32768x32768 px depending on
  browser/GPU), bounding maximum export resolution.

::: tip Vector alternative
When raster fidelity matters, prefer the stable **SVG** functions: the core `SvgExporter` emits
resolution-independent markup and sidesteps the html2canvas approximations entirely.
:::

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
