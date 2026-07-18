---
title: SVG Export
description: Export PPTX slides to standalone SVG strings with the headless SvgExporter - no browser DOM required. A vector alternative to the viewer packages' raster export.
---

# SVG Export

`SvgExporter` renders parsed slides to **SVG XML strings** with no browser DOM. Output is built by string concatenation, so it runs in any JavaScript runtime - Node, Bun, Deno, Workers, and server-side pipelines - with zero extra dependencies.

::: tip Vector, not raster
This is the headless, dependency-free way to get a vector rendering of each slide. The framework bindings' raster export (PNG/PDF/GIF/video) rasterizes the live DOM with html2canvas and needs a browser; `SvgExporter` does not. See [/react/](/react/).
:::

## API

`SvgExporter` is a class with two static methods (verified against `packages/core/src/converter/SvgExporter.ts`):

```ts
class SvgExporter {
	static exportSlide(
		slide: PptxSlide,
		width: number,
		height: number,
		options?: SvgExportOptions,
	): string;

	static exportAll(data: PptxData, options?: SvgExportOptions): string[];
}
```

- `exportSlide` renders one slide to a complete `<svg>` document string with `xmlns`, `xmlns:xlink`, a `viewBox`, and explicit `width`/`height`. Pass the viewport in pixels (typically `data.width` / `data.height`).
- `exportAll` iterates `data.slides`, applies the `slideIndices` filter, skips hidden slides unless `includeHidden` is set, and returns one SVG string per exported slide. Filtering happens **only** in `exportAll`; `exportSlide` always renders the slide you give it.

## `SvgExportOptions`

| Field               | Type       | Default   | Purpose                                                         |
| ------------------- | ---------- | --------- | --------------------------------------------------------------- |
| `includeHidden`     | `boolean`  | `false`   | Include hidden slides when exporting all.                       |
| `slideIndices`      | `number[]` | -         | 0-based indices to export (`exportAll` only). Omit for all.     |
| `defaultFontFamily` | `string`   | `'Arial'` | Fallback font family when an element specifies no font.         |
| `defaultFontSize`   | `number`   | `18`      | Fallback font size in points when an element specifies no size. |

## What gets rendered

Every element type in the model has a renderer; nothing throws on exotic content:

| Element type                                     | Rendering                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `text`, `shape`                                  | Shape body (fill/border via the preset geometry) plus laid-out text runs.                     |
| `connector`                                      | Routed path with arrow `<marker>` heads. Markers are deduplicated per colour in `<defs>`.     |
| `image`, `picture`                               | `<image>` element; PowerPoint picture effects become SVG `<filter>` defs.                     |
| `table`                                          | Grid of rects and text runs.                                                                  |
| `group`                                          | Recursively rendered children inside a transformed `<g>`.                                     |
| `ink`                                            | Ink stroke paths.                                                                             |
| `chart`                                          | Full inline chart rendering (falls back to a labelled placeholder if the data is incomplete). |
| `smartArt`                                       | SmartArt shape rendering (placeholder fallback).                                              |
| `ole`, `media`, `model3d`, `contentPart`, `zoom` | Preview/poster rendering (placeholder fallback).                                              |
| `unknown`                                        | Labelled placeholder box.                                                                     |
| slide background                                 | Solid colour rect, or the background image with `preserveAspectRatio="xMidYMid slice"`.       |

Hidden elements (`el.hidden`) are skipped, element `opacity` and flip/rotation transforms are applied on the wrapping `<g>`, and gradient fills currently degrade to the first gradient stop colour (best effort).

## Export all slides

```ts
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const svgs = SvgExporter.exportAll(data, { includeHidden: false });
console.log(`${svgs.length} slides exported`); // string[]
```

## Export a single slide

```ts
const svg = SvgExporter.exportSlide(data.slides[0], data.width, data.height, {
	defaultFontFamily: 'Inter',
});
```

## Write SVG files to disk (Node / Bun)

::: code-group

```ts [Node fs]
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';
import { readFile, writeFile } from 'node:fs/promises';

const file = await readFile('deck.pptx');
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

const handler = new PptxHandler();
const data = await handler.load(buffer as ArrayBuffer);

const svgs = SvgExporter.exportAll(data);
await Promise.all(svgs.map((svg, i) => writeFile(`slide_${i + 1}.svg`, svg, 'utf8')));
```

```ts [Bun]
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';

const buffer = await Bun.file('deck.pptx').arrayBuffer();

const handler = new PptxHandler();
const data = await handler.load(buffer);

const svgs = SvgExporter.exportAll(data);
await Promise.all(svgs.map((svg, i) => Bun.write(`slide_${i + 1}.svg`, svg)));
```

```ts [From raw bytes (no handler juggling)]
// The CLI command handler wraps load + export in one call:
import { handleExportSvg } from 'pptx-viewer-core/cli';

const { slideCount, svgs } = await handleExportSvg(bytes, {
	includeHidden: true,
	slideIndices: [0, 2],
});
```

:::

::: info In the browser
Since each SVG is just a string, you can drop it into the DOM (`el.innerHTML = svg`), wrap it in a `Blob` of type `image/svg+xml` for download, or convert it to a data URL. Note that embedded images reference the data URLs the load pipeline produced, so the output is self-contained.
:::

## See also

- The [CLI](/core/cli) `export-svg` command wraps `SvgExporter.exportAll` for one-shot file export (`pptx export-svg deck.pptx ./out`).
- The [Geometry Engine](/core/geometry) provides the preset-shape path evaluation the exporter uses for shape outlines.
