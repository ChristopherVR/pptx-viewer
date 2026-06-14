---
title: SVG Export
description: Export PPTX slides to standalone SVG strings with the headless SvgExporter — no browser DOM required. A vector alternative to the React package's raster export.
---

# SVG Export

`SvgExporter` renders parsed slides to **SVG XML strings** with no browser DOM. Output is built by string concatenation, so it runs in any JavaScript runtime — Node, Bun, Deno, Workers, and server-side pipelines.

::: tip Vector, not raster
This is the headless, dependency-free way to get a vector rendering of each slide. The React package's export (PNG/PDF/GIF/video) rasterizes the live DOM with html2canvas and needs a browser; `SvgExporter` does not. See [/react/](/react/).
:::

## API

`SvgExporter` exposes two static methods:

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

- `exportSlide` renders one slide to a complete `<svg>` document string. `width`/`height` are the viewport in pixels (typically `data.width` / `data.height`).
- `exportAll` renders every slide (subject to options) and returns an array of SVG strings.

## `SvgExportOptions`

| Field               | Type       | Default   | Purpose                                        |
| ------------------- | ---------- | --------- | ---------------------------------------------- |
| `includeHidden`     | `boolean`  | `false`   | Include hidden slides when exporting all.      |
| `slideIndices`      | `number[]` | —         | 0-based indices to export. Omit to export all. |
| `defaultFontFamily` | `string`   | `'Arial'` | Fallback when an element specifies no font.    |
| `defaultFontSize`   | `number`   | `18`      | Fallback font size in points.                  |

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

## Write SVG files to disk (Node)

```ts
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';
import { writeFile } from 'node:fs/promises';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const svgs = SvgExporter.exportAll(data);
await Promise.all(svgs.map((svg, i) => writeFile(`slide_${i + 1}.svg`, svg, 'utf8')));
```

::: info In the browser
Since each SVG is just a string, you can also drop it into the DOM (`el.innerHTML = svg`), wrap it in a `Blob` of type `image/svg+xml` for download, or convert it to a data URL.
:::

The [CLI](/core/cli) `export-svg` command wraps `SvgExporter.exportAll` for one-shot file export.
