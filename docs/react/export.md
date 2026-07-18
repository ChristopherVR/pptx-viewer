---
title: Export
description: Export slides to PNG, PDF, GIF, and WebM video from the viewer, plus SVG, notes-PDF, save-as formats, the standalone renderToCanvas utility, and the internal export hooks.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas-pro` pipeline; SVG goes through the core `SvgExporter` (model
driven, resolution independent); PPTX goes through the core serializer.

## Supported formats

| Format          | Pipeline                                                                                                               | Output file              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| PNG             | `renderToCanvas` (html2canvas-pro, scale 2) → `canvas.toBlob('image/png')`; also copy-to-clipboard via `ClipboardItem` | `slide-<n>.png`          |
| PDF (slides)    | Per-slide canvases (scale 2) → JPEG frames (quality 0.92) → pure PDF byte builder (no jspdf), one A4 page per slide    | `presentation.pdf`       |
| PDF (notes)     | Same capture + notes-page layout builder                                                                               | `presentation-notes.pdf` |
| GIF             | Per-slide canvases (scale 0.5) → shared pure-JS GIF89a encoder, 2000 ms per slide                                      | `presentation.gif`       |
| Video (WebM)    | Per-slide canvases (scale 1) → canvas `captureStream` + `MediaRecorder` (30 fps, 5 Mbps), 3000 ms per slide            | `presentation.webm`      |
| SVG             | Core `SvgExporter` (vector; also drives the vector print path)                                                         | per-slide SVG            |
| Print           | Raster capture at scale 3 + HTML print document (slides / notes / handouts / outline), or vector SVG print document    | print window             |
| Package (share) | JSZip bundle of the serialized `.pptx` plus a generated `README.txt`                                                   | `<name>-package.zip`     |
| PPTX/PPSX/PPTM  | `PptxHandler.save()` (or `saveEncrypted()` when a password is set) → `Uint8Array` (Save As)                            | `presentation.<ext>`     |

::: info JPEG
There is no standalone JPEG export. JPEG encoding (quality 0.92) is used internally to compress
slide frames inside exported PDFs.
:::

## How export is triggered

Export is **driven by the viewer's UI**, not by props or the imperative handle:

- The toolbar / export dialog invoke the internal `useExportHandlers` hook, which runs the pipeline
  above with progress reporting and an `AbortController` (export can be cancelled). Printing goes
  through the sibling `usePrintHandlers` hook.
- The only export-adjacent method on the stable imperative handle is
  [`getContent()`](/react/handle), which returns the serialized `.pptx` `Uint8Array` - equivalent to
  the PPTX "save-as" path.

::: info No export method on the stable handle
`PowerPointViewerHandle` carries no `export()` method: PNG/PDF/GIF/video exports and printing are
user-initiated through the toolbar/dialog. If you need programmatic raster export of arbitrary DOM,
use `renderToCanvas` (below); if you need the viewer's own export flows programmatically, the hooks
are reachable through the internals subpath (next section).
:::

## Programmatic export: `pptx-react-viewer/internals`

`useExportHandlers` and `usePrintHandlers` are exported from the `pptx-react-viewer/internals`
subpath (explicitly **not** covered by semver; the stable root exports only `renderToCanvas` and the
viewer component/handle). `useExportHandlers(input)` returns:

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

Its input wires deep viewer internals (slides, the live canvas stage ref, the core handler ref, a
`serializeSlides` callback, save-as metadata), so it is practical inside a custom viewer shell, not
as a detached utility. The underlying per-format utilities accept these options:

| Utility (internal)           | Options and defaults                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG (`PngExportOptions`)     | `scale` (default 2), `backgroundColor`                                                                                                                                                  |
| PDF (`PdfExportOptions`)     | `scale` (default 2), `onProgress(current, total)`, `signal`                                                                                                                             |
| GIF (`GifExportOptions`)     | `scale` (default 0.5), `slideDurationMs` (default 2000), `onProgress`, `signal`                                                                                                         |
| Video (`VideoExportOptions`) | `scale` (default 1), `slideDurationMs` (default 3000), `slideTimingsMs` (per-slide rehearsed timings), `onProgress`, `onRecordProgress`, `signal` (fps 30 and 5 Mbps bitrate are fixed) |

Progress and cancellation follow one shared pattern: each long export creates an `AbortController`,
threads its `signal` into the capture loop (which throws an `AbortError` `DOMException` between
slides), and reports percentages via the shared progress math (capture fills most of the bar,
assembly is pinned at 95%, done at 100%).

## Print

`usePrintHandlers` drives the print dialog and a print-window flow covering slides, notes pages,
handouts (1/2/3/4/6/9 slides per page), and an outline view, with `PrintSettings` (what to print,
orientation, color mode `'color' | 'grayscale' | 'blackAndWhite'`, frame slides, slide range
`'all' | 'current' | 'custom'`). Slides can print through a **vector SVG** document (no
rasterization); notes and handouts rasterize at scale 3.

## `renderToCanvas`

A standalone utility (exported from the package root) that rasterizes a DOM element to a Canvas,
working around browsers' modern-color-space (oklch/oklab/lch/lab/`color()`) parsing limitations in
`html2canvas-pro`.

```ts
import { renderToCanvas } from 'pptx-react-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, options);
const dataUrl = canvas.toDataURL('image/png');
```

Signature:

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

It builds on `html2canvas-pro` and, during the `onclone` phase, runs the shared CSS preprocessing
passes (`normalizeColorsForCapture` + `preprocessCssForCapture` from the shared render layer): they
convert unsupported color functions to sRGB via the Canvas 2D API, patch Tailwind v4's oklch
custom-property definitions, and flatten `backdrop-filter`, `mix-blend-mode`, and CSS 3D transforms
that html2canvas cannot render.

## Example: save-as from your own UI

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

## Pipeline limitations

Raster export inherits the html2canvas constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter`, CSS `var()`, and CSS 3D transforms are not natively supported - the library
  preprocesses CSS to approximate them, so some fidelity is lost.
- `mix-blend-mode` is mapped to opacity fallbacks; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384×16384 or 32768×32768 px depending
  on browser/GPU), bounding maximum export resolution.

::: tip Vector alternative
When raster fidelity matters, prefer the **SVG** path - the core `SvgExporter` emits
resolution-independent vector markup and sidesteps the html2canvas color/effect approximations.
:::

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
