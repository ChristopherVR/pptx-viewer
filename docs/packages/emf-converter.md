---
title: EMF Converter
description: emf-converter is a zero-dependency TypeScript library that rasterises EMF and WMF metafile binaries into PNG data URLs by replaying their GDI drawing records onto a Canvas 2D context.
---

# EMF Converter

`emf-converter` is a **zero-dependency** TypeScript library that converts **EMF** (Enhanced Metafile) and **WMF** (Windows Metafile) binary buffers into **PNG data URLs**. It parses the metafile's record stream and replays each GDI / GDI+ drawing command onto an HTML Canvas 2D context, then exports the result as a rasterised PNG.

Metafiles are vector image formats that store a sequence of GDI (Graphics Device Interface) drawing commands. They are commonly embedded inside Office documents - including the slides, masters, and OLE objects of a `.pptx`. This package is what lets the [core engine](/core/) and [React viewer](/react/) display those embedded vector images in the browser.

::: tip Where this fits
The converter handles three related formats through two entry points: 32-bit **EMF** (including embedded **EMF+** / GDI+ records inside comments) via `convertEmfToDataUrl`, and legacy 16-bit **WMF** via `convertWmfToDataUrl`.
:::

It supports 300+ EMF GDI record types, the EMF+ (GDI+) extension, and the older WMF record set. See [Supported records](#supported-records) for the breakdown.

## Install

```bash
bun add emf-converter
# or: npm install emf-converter
```

## Public API

The package barrel (`emf-converter`) exports two conversion functions, an options type, and one constant:

| Export                                               | Kind     | Purpose                                                  |
| ---------------------------------------------------- | -------- | -------------------------------------------------------- |
| `convertEmfToDataUrl(buffer, maxWidth?, maxHeight?)` | function | Convert an EMF (incl. EMF+) buffer to a PNG data URL.    |
| `convertWmfToDataUrl(buffer, maxWidth?, maxHeight?)` | function | Convert a legacy WMF buffer to a PNG data URL.           |
| `EmfConvertOptions`                                  | type     | Options interface (`maxWidth`, `maxHeight`, `dpiScale`). |
| `DEFAULT_DPI_SCALE`                                  | const    | The default HiDPI scale factor applied to output.        |

Both functions share the same signature and return type:

```ts
function convertEmfToDataUrl(
	buffer: ArrayBuffer,
	maxWidth?: number,
	maxHeight?: number,
): Promise<string | null>;

function convertWmfToDataUrl(
	buffer: ArrayBuffer,
	maxWidth?: number,
	maxHeight?: number,
): Promise<string | null>;
```

| Parameter   | Type                      | Description                                                                                        |
| ----------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `buffer`    | `ArrayBuffer`             | The raw EMF or WMF file bytes.                                                                     |
| `maxWidth`  | `number` (optional)       | Maximum output width in pixels (aspect ratio preserved).                                           |
| `maxHeight` | `number` (optional)       | Maximum output height in pixels (aspect ratio preserved).                                          |
| **Returns** | `Promise<string \| null>` | A `data:image/png;base64,…` URL, or `null` if the buffer is invalid or no canvas API is available. |

::: info Return value
Both functions resolve to `null` rather than throwing when the buffer cannot be parsed or when no Canvas API is present in the runtime. Always handle the `null` case.
:::

### `EmfConvertOptions`

The exported `EmfConvertOptions` interface documents the full set of tunable parameters used internally by the pipeline:

```ts
interface EmfConvertOptions {
	/** Maximum output width in pixels. */
	maxWidth?: number;
	/** Maximum output height in pixels. */
	maxHeight?: number;
	/**
	 * DPI scale factor for higher-resolution output.
	 * Default is 2 (HiDPI). Set to 1 for 1:1 pixel mapping.
	 * Values above 4 are clamped to 4 to prevent excessive memory usage.
	 */
	dpiScale?: number;
}
```

## Example

Read a metafile, convert it, and use the resulting PNG data URL as an `<img>` source:

```ts
import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';

// Load the bytes however you like - fetch, file input, JSZip entry, etc.
const response = await fetch('/diagram.emf');
const emfBuffer: ArrayBuffer = await response.arrayBuffer();

const pngDataUrl = await convertEmfToDataUrl(emfBuffer);
if (pngDataUrl) {
	const img = document.createElement('img');
	img.src = pngDataUrl; // "data:image/png;base64,iVBORw0KGgo..."
	document.body.append(img);
}

// WMF works identically:
const wmfBuffer = await (await fetch('/logo.wmf')).arrayBuffer();
const wmfPng = await convertWmfToDataUrl(wmfBuffer);

// Clamp output dimensions (aspect ratio preserved):
const thumbnail = await convertEmfToDataUrl(emfBuffer, 1024, 768);
```

## How it works

The converter follows a three-phase pipeline - **Parse → Replay → Export**:

1. **Parse the header** to determine the metafile's logical bounds and the output canvas dimensions. EMF reads its bounds (falling back to the frame rectangle); WMF reads an optional Aldus Placeable (APM) header for bounds and DPI.
2. **Create a canvas** - `OffscreenCanvas` is preferred (so conversion works inside Web Workers), falling back to `HTMLCanvasElement`.
3. **Replay records** sequentially, dispatching each to GDI, EMF+, or WMF handlers that drive the Canvas 2D context. EMF+ records are embedded inside `EMR_COMMENT` records and processed by a parallel GDI+ engine whose state persists across comment blocks.
4. **Resolve deferred images** - bitmap and embedded-metafile draws are collected during the synchronous replay and decoded asynchronously (via `createImageBitmap`), then composited. Embedded metafiles are converted recursively.
5. **Export** the canvas as a PNG data URL.

## Supported records

| Format      | Coverage                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EMF GDI** | Header/control, state (SaveDC, colours, modes), transforms (window/viewport, world transform), objects (pens, brushes, fonts), shapes (lines, rects, ellipses, arcs), poly/path operations, text (`ExtTextOutW`), and bitmaps (`BitBlt`, `StretchDIBits`). |
| **EMF+**    | Control, objects (Brush, Pen, Path, Font, Image, StringFormat, ImageAttributes), shapes, path fill/draw, text, images, the full world-transform matrix, save/restore, and rendering hints.                                                                 |
| **WMF**     | Control, state, objects, shapes, polygons, and text records of the 16-bit format.                                                                                                                                                                          |

DIBs (Device-Independent Bitmaps) are decoded across 1/4/8/16/24/32-bit depths with `BI_RGB`, `BI_RLE4`, `BI_RLE8`, and `BI_BITFIELDS` compression. EMF+ adds GDI+ pixel formats (`24bppRGB`, `32bppRGB`, `32bppARGB`, `32bppPARGB`).

## Environment requirements

The library needs a Canvas API in its runtime:

- **Browser** - works out of the box (uses `HTMLCanvasElement`, or `OffscreenCanvas` in a Web Worker).
- **Web Worker** - fully supported via `OffscreenCanvas`.
- **Node.js** - **not** supported without a canvas polyfill. There is no `OffscreenCanvas`/`HTMLCanvasElement` in plain Node, so both functions return `null`. Provide a polyfill (e.g. `node-canvas` or `@napi-rs/canvas`) that exposes a compatible Canvas API if you need server-side conversion.

::: warning No canvas, no output
If neither `OffscreenCanvas` nor `HTMLCanvasElement` is available, conversion short-circuits and returns `null`. This is the most common reason the function "silently" produces nothing in a Node environment.
:::

## Limitations

The converter is a pragmatic rasteriser, not a pixel-perfect reimplementation of Windows GDI. Notable gaps:

- **No EMF+ region objects** - `EMFPLUS_OBJECTTYPE_REGION` is not parsed; GDI+ regions have no direct Canvas 2D equivalent.
- **Gradient brushes are simplified** - GDI+ `LinearGradient` and `PathGradient` brushes extract only their primary colour rather than rendering full multi-stop gradients.
- **No raster operations (ROP)** - `SetROP2` is acknowledged but GDI blend modes (XOR, NOT, AND, …) are not applied; Canvas 2D has no equivalent.
- **Limited clipping** - `IntersectClipRect` and `SelectClipPath` are supported, but complex multi-region boolean clipping is not (Canvas 2D supports only a single clip path).
- **Maximum canvas size** - output is clamped to **4096×4096** pixels to guard against malformed or oversized metafiles.
- **Maximum record count** - processing stops after 50,000 records (EMF/WMF) or 100,000 records (EMF+) as an infinite-loop safety limit.
- **Font rendering** - text uses the browser's font engine with CSS font matching, so glyph metrics and kerning may differ from native Windows GDI text.
- **No EMF spool records** - print-spooler record types are ignored; they don't appear in metafiles embedded in Office documents.
- **Canvas API required** - see [Environment requirements](#environment-requirements) above.

For the broader picture of what the viewer can and cannot render, see [/guide/limitations](/guide/limitations).
