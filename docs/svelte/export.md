---
title: Svelte Viewer Export & Print
description: Export slides to PNG, PDF, GIF, WebM video, and SVG from the Svelte viewer, print slides, handouts, notes, and outline, and save the document back to .pptx, .ppsx, or .pptm.
---

# Export & Print

The Svelte viewer can turn slides into a range of formats and save the document back to
`.pptx`. Everything is available both from the built-in toolbar's export menu (with a progress
modal and cancellation) and programmatically on the [component instance](/svelte/api).

## Supported formats

| Format | Pipeline                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------- |
| PNG    | `html2canvas-pro` rasterisation (dynamically imported on first use)                             |
| PDF    | `jspdf` (dynamically imported) + rasterisation, multi-page, one slide per page                  |
| GIF    | Animated GIF frame encoder over rasterised frames                                               |
| WebM   | `MediaRecorder` over a canvas capture stream (codec picked from the shared WebM candidates)     |
| SVG    | Vector export straight from the parsed data model (no rasterisation), via standalone functions  |
| Print  | Shared print document (slides / handouts / notes / outline) in a hidden same-origin iframe      |
| PPTX   | Core serializer via `save(format)`, `downloadAs`, `downloadPptx` (`'pptx' \| 'ppsx' \| 'pptm'`) |

::: tip Lazy dependencies
`html2canvas-pro` and `jspdf` are dynamic imports: the first raster/PDF export pays a one-time
load cost, and apps that never export never ship them to the client.
:::

## Raster and video export

All methods live on the component instance (`bind:this`):

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

### `ExportPdfOptions`

| Option       | Type                                       | Default | Description                                      |
| ------------ | ------------------------------------------ | ------- | ------------------------------------------------ |
| `onProgress` | `(current: number, total: number) => void` | -       | Capture-phase progress callback.                 |
| `signal`     | `AbortSignal`                              | -       | Abort the export early (checked between slides). |

### `ExportGifOptions`

| Option            | Type                                       | Default | Description                                                              |
| ----------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------ |
| `slideDurationMs` | `number`                                   | `2000`  | Duration each slide is shown.                                            |
| `slideTimingsMs`  | `number[]`                                 | -       | Per-slide duration overrides (index maps to slide index).                |
| `maxDimension`    | `number`                                   | `960`   | Longest allowed output side in pixels; frames scale down proportionally. |
| `onProgress`      | `(current: number, total: number) => void` | -       | Capture-phase progress callback.                                         |
| `signal`          | `AbortSignal`                              | -       | Abort the export early.                                                  |

### `ExportVideoOptions`

| Option               | Type                                       | Default     | Description                              |
| -------------------- | ------------------------------------------ | ----------- | ---------------------------------------- |
| `slideDurationMs`    | `number`                                   | `3000`      | Duration each slide is shown.            |
| `slideTimingsMs`     | `number[]`                                 | -           | Per-slide duration overrides.            |
| `fps`                | `number`                                   | `30`        | Recording frame rate.                    |
| `videoBitsPerSecond` | `number`                                   | `5_000_000` | Recorder bitrate.                        |
| `onProgress`         | `(current: number, total: number) => void` | -           | Capture-phase progress callback.         |
| `onRecordProgress`   | `(current: number, total: number) => void` | -           | Recording-phase progress callback.       |
| `signal`             | `AbortSignal`                              | -           | Abort between slides and between frames. |

## Print

`print(options)` assembles the shared print document and opens the browser print dialog. The
default print surface is a hidden same-origin iframe, so no popup window is involved. It
resolves `true` once the print surface opened.

```ts
await viewer?.print({ printWhat: 'handouts', slidesPerPage: 6, colorMode: 'grayscale' });
await viewer?.print({
	printWhat: 'slides',
	slideRange: 'custom',
	customRangeFrom: 2,
	customRangeTo: 5,
});
```

`PrintOptions` is any subset of the shared print settings:

| Option            | Type                                             | Default       | Description                      |
| ----------------- | ------------------------------------------------ | ------------- | -------------------------------- |
| `printWhat`       | `'slides' \| 'handouts' \| 'notes' \| 'outline'` | `'slides'`    | What to print.                   |
| `orientation`     | `'landscape' \| 'portrait'`                      | `'landscape'` | Page orientation.                |
| `colorMode`       | `'color' \| 'grayscale' \| 'blackAndWhite'`      | `'color'`     | Colour treatment.                |
| `frameSlides`     | `boolean`                                        | `false`       | Draw a border around each slide. |
| `slidesPerPage`   | handout slides-per-page count                    | `6`           | Handout layout density.          |
| `slideRange`      | `'all' \| 'current' \| 'custom'`                 | `'all'`       | Which slides to include.         |
| `customRangeFrom` | `number`                                         | `1`           | Custom range start (1-based).    |
| `customRangeTo`   | `number`                                         | `1`           | Custom range end (1-based).      |

::: warning Popup blockers
The default iframe surface is immune to popup blockers. A custom `window.open`-based opener
(injectable at the controller level) is not; when blocked, the promise resolves `false`.
:::

## Saving the document

| Method              | Signature                                                      | Description                                           |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | Serialise the (edited) slides via the core handler.   |
| `getContent`        | `() => Promise<Uint8Array>`                                    | Alias of `save()` from the shared viewer contract.    |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | Save + browser download in `pptx`, `ppsx`, or `pptm`. |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | Save + download as `.pptx` with a default name.       |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | Assemble and download the sharing package.            |

## SVG: standalone functions {#svg-standalone-functions}

SVG export is vector output straight from the parsed data model, exported as plain functions
from the package root (no component instance needed):

```ts
import { exportSlideToSvg, exportSlideToSvgBlob, exportSlideAsSvg } from 'pptx-svelte-viewer';
```

| Function                    | Signature                                      | Returns                  |
| --------------------------- | ---------------------------------------------- | ------------------------ |
| `exportSlideToSvg`          | `(slide, width, height, options?)`             | SVG markup `string`      |
| `exportSlideToSvgBlob`      | `(slide, width, height, options?)`             | `Blob` (`image/svg+xml`) |
| `exportSlideAsSvg`          | `(slide, slideIndex, width, height, options?)` | triggers a download      |
| `exportAllSlidesToSvg`      | `(data, options?)`                             | `string[]`               |
| `exportAllSlidesToSvgBlobs` | `(data, options?)`                             | `Blob[]`                 |

`slide` is a `PptxSlide` (get one from the instance's `getSlides()` / `getActiveSlide()`);
`width`/`height` are the canvas size in pixels from the `onload` payload. The `exportAll*`
variants take the full parsed `PptxData` from a [`pptx-viewer-core`](/core/) handler.

Options (`SvgExportSingleSlideOptions` / `SvgExportAllOptions`):

| Option              | Type       | Default | Description                                    |
| ------------------- | ---------- | ------- | ---------------------------------------------- |
| `includeHidden`     | `boolean`  | `false` | Include hidden slides when exporting all.      |
| `slideIndices`      | `number[]` | all     | Slide indices to export (0-based).             |
| `defaultFontFamily` | `string`   | -       | Fallback font family for elements without one. |
| `defaultFontSize`   | `number`   | -       | Fallback font size in points.                  |

```ts
const slide = viewer?.getActiveSlide();
if (slide) {
	const svg = exportSlideToSvg(slide, canvasSize.width, canvasSize.height);
	// e.g. inline it, upload it, or hand it to a design tool
}
```

## Pipeline limitations

Raster export inherits the `html2canvas-pro` constraints (see
[Limitations](/guide/limitations)): some CSS features (`backdrop-filter`, CSS 3D transforms)
lose fidelity in capture, `mix-blend-mode` is approximated, and canvas size is capped by the
browser's maximum, bounding the export resolution. The SVG path avoids rasterisation entirely
but covers the data model, not arbitrary DOM styling.
