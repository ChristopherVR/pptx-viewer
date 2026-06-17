---
title: Export
description: Export slides to PNG, JPEG, SVG, PDF, GIF, and video from the viewer, plus the standalone renderToCanvas utility and the html2canvas pipeline.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas` pipeline; SVG goes through a DOM-to-SVG serializer; PPTX goes
through the core serializer.

## Supported formats

| Format     | Pipeline                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| PNG / JPEG | `renderToCanvas` (html2canvas) → `canvas.toDataURL()`                                      |
| SVG        | DOM → SVG serialization (vector, avoids the canvas constraints)                            |
| PDF        | `jspdf` + `renderToCanvas` → multi-page PDF (supports notes pages and overflow pagination) |
| GIF        | Animated GIF frame encoder                                                                 |
| Video      | `MediaRecorder` API                                                                        |
| PPTX       | `PptxHandler.save()` → `Uint8Array` (save-as)                                              |

## How export is triggered

Export is **driven by the viewer's UI**, not by props or the imperative handle:

- The toolbar / export dialog invoke the internal `useExportHandlers` hook, which runs the pipeline
  above with progress reporting and an abort controller (export can be cancelled).
- The only public, programmatic way to obtain document bytes is the handle's
  [`getContent()`](/react/handle), which returns the serialized `.pptx` `Uint8Array` - equivalent to
  the PPTX "save-as" path.

::: info No export prop/handle method
There is no `export()` prop or ref method. PNG/PDF/SVG/GIF/video exports are user-initiated through
the toolbar/dialog. If you need programmatic raster export of arbitrary DOM, use `renderToCanvas`
(below) directly.
:::

## `renderToCanvas`

A standalone utility (exported from the package root) that rasterizes a DOM element to a Canvas,
working around browsers' modern-color-space (oklch/oklab/lch/lab/`color()`) parsing limitations in
`html2canvas`.

```ts
import { renderToCanvas } from 'pptx-react-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, options);
const dataUrl = canvas.toDataURL('image/png');
```

Signature:

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>,
): Promise<HTMLCanvasElement>;
```

It builds on `html2canvas-pro` and, during the `onclone` phase, runs the full CSS preprocessing
pipeline used by the viewer: it converts unsupported color functions to sRGB (via the Canvas 2D API),
patches Tailwind v4's oklch custom-property definitions, converts `blob:` image URLs to `data:` URLs,
and flattens `backdrop-filter`, `mix-blend-mode`, and CSS 3D transforms that html2canvas cannot
render.

## Pipeline limitations

Raster export inherits the html2canvas constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter`, CSS `var()`, and CSS 3D transforms are not natively supported - the library
  preprocesses CSS to approximate them, so some fidelity is lost.
- `mix-blend-mode` is mapped to opacity fallbacks; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384×16384 or 32768×32768 px depending
  on browser/GPU), bounding maximum export resolution.

::: tip Vector alternative
When raster fidelity matters, prefer the **SVG** export path - it serializes the DOM to vector and
sidesteps the html2canvas color/effect approximations.
:::

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
