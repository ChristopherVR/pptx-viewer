---
title: Export
description: Export slides to PNG, PDF, GIF, and WebM video from the viewer, plus save-as PPTX, driven by the toolbar and the html2canvas-pro pipeline.
---

# Export

The viewer can turn slides into a range of formats and save the document back to `.pptx`. Raster
formats go through an `html2canvas-pro` pipeline; PPTX goes through the core serializer.

## Supported formats

| Format | Pipeline                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| PNG    | `html2canvas-pro` rasterisation (host-supplied `rasterizeSlide`) -> `canvas.toDataURL()` |
| PDF    | `jspdf` (lazy-loaded) + rasterisation -> multi-page PDF (one slide per page)             |
| GIF    | Animated GIF frame encoder (lazy-loaded, `gif-encoder.ts`)                               |
| WebM   | `MediaRecorder` API over a canvas capture stream                                         |
| PPTX   | `PptxHandler.save()` via `saveAs(format)` -> `Uint8Array` (save-as)                      |

::: warning Narrower than React
The React binding additionally supports **JPEG** and a vector **SVG** export path. The Vue viewer
does not currently have an SVG DOM-to-vector serializer or a JPEG output option, only PNG raster
export. It does support one extra convenience the React docs don't call out: **copy slide as image**
to the clipboard (`onCopySlideAsImage`, wired to the toolbar).
:::

## How export is triggered

Export is **driven by the viewer's UI**, not by props or the exposed API:

- The toolbar / export dialog invoke the internal `useExportWiring` composable (which composes
  `useExport` for PNG/PDF, `useMediaExport` for GIF/WebM, and `usePrint` for printing), with progress
  reporting via `useExportProgress` and cooperative cancellation through an `AbortSignal`.
- The only public, programmatic way to obtain document bytes is the exposed
  [`getContent()`](/vue/handle), which returns the serialized `.pptx` `Uint8Array`, equivalent to the
  PPTX "save-as" path (`saveAs('pptx')` internally).

::: info No export prop or exposed method
There is no `export` prop or `defineExpose` method for raster/PDF/GIF/WebM export. Those are
user-initiated through the toolbar/dialog. If you need to drive rasterisation yourself, the
underlying composables (`useExport`, `useMediaExport`, `usePrint`) are reachable via
[`pptx-vue-viewer/composables-unstable`](/vue/composables-reference), though there is no equivalent
of React's standalone `renderToCanvas` utility exported from the package root.
:::

## Print

`usePrint` (composed via `useExportWiring`) drives a dedicated print dialog and a rasterised
print-window flow, covering slides, notes pages, handouts, and an outline view. It reuses the same
off-screen `rasterizeSlide` the export path drives. There is no separate vector print path.

## Pipeline limitations

Raster export inherits the `html2canvas-pro` constraints (see [Limitations](/guide/limitations)):

- `backdrop-filter`, CSS `var()`, and CSS 3D transforms are not natively supported, some fidelity is
  lost in the raster capture.
- `mix-blend-mode` is approximated; path gradients become elliptical radials.
- Canvas size is capped by the browser's maximum (commonly 16384x16384 or 32768x32768 px depending on
  browser/GPU), bounding maximum export resolution.

For the underlying save/serialize details of the PPTX format, see [Core](/core/).
