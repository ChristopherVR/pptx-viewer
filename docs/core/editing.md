---
title: Editing Programmatically
description: Mutate a loaded PptxData model in pptx-viewer-core - find elements with type guards, edit text and style, move and resize, add and remove elements and slides, work with rawXml round-trip fields, and apply common recipes.
---

# Editing Programmatically

After [loading](/core/loading) a deck into `PptxData`, you edit by mutating the in-memory model directly, then [save](/core/saving). The model is a plain object graph; there is no transaction layer. Mutate `data.slides` and hand it to `handler.save()`.

::: tip Same handler
Always call `save()` on the handler that produced the data. It owns the in-memory ZIP (media, masters, custom parts) that the save pipeline reuses.
:::

## Finding elements

`slide.elements` is a `PptxElement[]`, a discriminated union on the `type` field (`'text'`, `'shape'`, `'image'`, `'picture'`, `'table'`, `'chart'`, `'connector'`, `'group'`, `'smartArt'`, `'media'`, `'ink'`, `'ole'`, and a few more; see [the data model](/guide/data-model)). Narrow with the discriminant, or with the exported type guards:

| Guard                    | Narrows to                                    |
| ------------------------ | --------------------------------------------- |
| `isTextElement(el)`      | `TextPptxElement`                             |
| `isShapeElement(el)`     | `ShapePptxElement`                            |
| `isConnectorElement(el)` | `ConnectorPptxElement`                        |
| `isImageLikeElement(el)` | `PptxImageLikeElement` (`image` or `picture`) |
| `isInkElement(el)`       | `InkPptxElement`                              |
| `isZoomElement(el)`      | `ZoomPptxElement`                             |

Group elements (`type: 'group'`) nest their members in `children: PptxElement[]`, so a full traversal must recurse:

```ts
import type { PptxElement } from 'pptx-viewer-core';

function* walkElements(elements: PptxElement[]): Generator<PptxElement> {
	for (const el of elements) {
		yield el;
		if (el.type === 'group') {
			yield* walkElements(el.children);
		}
	}
}

for (const slide of data.slides) {
	for (const el of walkElements(slide.elements)) {
		if (el.type === 'image') console.log(el.id, el.width, el.height);
	}
}
```

## Editing text

The quickest edit is the `text` field on any text-bearing element (`text`, `shape`, `connector`):

```ts
const data = await handler.load(buffer);

for (const slide of data.slides) {
	for (const el of slide.elements) {
		if (el.type === 'text' || el.type === 'shape') {
			if (el.text === 'DRAFT') el.text = 'FINAL';
		}
	}
}
```

Rich text lives in `textSegments: TextSegment[]` (each `{ text, style }` pair is one styled run). The save pipeline reconciles the two fields: when you set `el.text` and the existing segments all share one style, the plain text drives the output; when the segments carry mixed styles, the edited text is remapped onto the existing run styles so formatting survives a plain-text edit. To control per-run styling explicitly, edit `textSegments` directly.

For deck-wide find and replace, the SDK exposes pure helpers:

```ts
import { findText, replaceText, replaceTextInSlide } from 'pptx-viewer-core';

// findText(slides: PptxSlide[], search: string | RegExp): FindResult[]
const matches = findText(data.slides, /Q[1-4]/g);
// Each FindResult: { slideIndex, elementId, segmentIndex, text, matchIndex }

// replaceText(slides, search, replacement): number of replacements made
const count = replaceText(data.slides, '2025', '2026');

// Scoped to one slide:
replaceTextInSlide(data.slides[0], 'Draft', 'Final');
```

Both search helpers descend into group children and match against segment text.

## Moving and resizing elements

Element geometry is stored as `x`, `y`, `width`, `height` on every element (via `PptxElementBase`), with optional `rotation` (degrees), `flipHorizontal`, `flipVertical`, and `opacity` (0-1):

```ts
const el = data.slides[0].elements[0];
el.x += 100; // shift right
el.y = 50; // move to top
el.width = 400; // resize
el.rotation = 15; // degrees
el.opacity = 0.5;
```

::: info Units
The data model exposes element coordinates in pixels for rendering convenience; PowerPoint's native unit is EMU (`1 px = 9,525 EMU` at 96 DPI). The save pipeline converts back to EMU automatically. Conversion helpers (`emuToPixels`, `pixelsToEmu`, `inchesToEmu`, `cmToEmu`) and the constants (`EMU_PER_PIXEL`, `EMU_PER_INCH`, `EMU_PER_POINT`) are exported.
:::

## Styling elements

Fill, stroke, and effects live in `shapeStyle: ShapeStyle` on shapes, connectors, and images; run-level text formatting lives in `textStyle: TextStyle` (and per-run in `textSegments[i].style`):

```ts
if (el.type === 'shape') {
	el.shapeStyle = {
		...el.shapeStyle,
		fillColor: '#00AA55',
		strokeColor: '#333333',
		strokeWidth: 2,
	};
	el.textStyle = { ...el.textStyle, fontSize: 18, bold: true, color: '#ffffff' };
}
```

Colors resolved from the document theme keep their source XML in side fields (for example `shapeStyle.fillColorXml` preserves an `a:schemeClr` node with its transforms). You do not need to touch these: on save, the preserved node is re-emitted only while the resolved color still matches it; once you overwrite `fillColor`, the writer falls back to a canonical `<a:srgbClr>` with your value.

## Adding and removing elements

`slide.elements` is a plain array: push, splice, or filter it. Build new elements with the fluent [element builders](/core/builder) (`TextBuilder`, `ShapeBuilder`, `ImageBuilder`, `TableBuilder`, `ChartBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder`) or the `create*Element` factory functions:

```ts
import { TextBuilder, ShapeBuilder, duplicateElement } from 'pptx-viewer-core';

const slide = data.slides[0];

// Add
slide.elements.push(
	TextBuilder.create('Added at runtime').fontSize(24).position(50, 400).size(600, 40).build(),
);

// Remove by id
slide.elements = slide.elements.filter((e) => e.id !== 'el_to_delete');

// Duplicate (deep clone with fresh ids)
const copy = duplicateElement(slide.elements[0]);
copy.x += 20;
copy.y += 20;
slide.elements.push(copy);
```

For chainable, id-routed mutation there is `PptxXmlBuilder`:

```ts
import { PptxXmlBuilder, ShapeBuilder } from 'pptx-viewer-core';

PptxXmlBuilder.from(data)
	.slide(0)
	.elements()
	.add(ShapeBuilder.create('rect').solidFill('#EEE').size(100, 100).build())
	.removeById('old_id')
	.updateById('el_id', (el) => ({ ...el, x: 200 }))
	.done()
	.notes()
	.set('Updated notes')
	.done()
	.done()
	.project(); // => the same (mutated) PptxData
```

`slide(index)` throws on an out-of-range index. `add` / `removeById` / `updateById` return the elements builder for chaining; `done()` steps back up one level.

## Adding and removing slides

Slides are likewise a plain array. When the handler came from `PptxHandler.create()` / `createBlank()`, the returned `createSlide` factory builds new slides:

```ts
const { handler, data, createSlide } = await PptxHandler.create({ title: 'Report' });

data.slides.splice(1, 0, createSlide('Blank').addText('Inserted').build());
data.slides.splice(3, 1); // remove slide 4
```

To duplicate a loaded slide, use the pure `duplicateSlide(slide, newSlideNumber)` helper, which deep-clones the slide and reassigns its identity:

```ts
import { duplicateSlide } from 'pptx-viewer-core';

data.slides.push(duplicateSlide(data.slides[0], data.slides.length + 1));
```

The high-level `Presentation` class manages slides for you: `addSlide`, `insertSlide`, `duplicateSlide(index)` (returns the new slide's index), `removeSlide`, `moveSlide`, `swapSlides`, `reorderSlides`, and `clearSlides`. The removal/ordering methods return `this` for chaining:

```ts
import { Presentation } from 'pptx-viewer-core';

const pptx = await Presentation.load(buffer);
const copyIndex = pptx.duplicateSlide(0); // returns the new index, not `this`
pptx.moveSlide(copyIndex, 2).removeSlide(5);
const bytes = await pptx.save();
```

The save pipeline reconciles added, removed, and reordered slides, rebuilding `ppt/presentation.xml`, relationships, and content types.

## Working with tables

Table content lives in `element.tableData` on a `type: 'table'` element: `rows` (each with `cells`), `columnWidths` (proportions summing to 1), banding flags, and `tableStyleId`. Each cell has `text`, an optional `style` (font size, bold, color, ...), and merge fields (`gridSpan`, `rowSpan`, `vMerge`, `hMerge`). Mutate in place:

```ts
for (const el of slide.elements) {
	if (el.type === 'table' && el.tableData) {
		el.tableData.rows[0].cells[0].text = 'Header';
		el.tableData.rows[0].cells[0].style = { bold: true };
	}
}
```

## Working with charts

Chart data lives in `element.chartData` on a `type: 'chart'` element. The SDK provides pure operations that mutate it in place, from data-level edits:

```ts
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartDataPoint,
	setChartTitle,
} from 'pptx-viewer-core';

if (el.type === 'chart') {
	setChartTitle(el, 'Quarterly Revenue');
	setChartCategories(el, ['Q1', 'Q2', 'Q3', 'Q4']);
	addChartSeries(el, { name: 'Revenue', values: [100, 150, 130, 170], color: '#4472C4' });
	updateChartDataPoint(el, 0, 2, 145); // series 0, point 2
}
```

to structural formatting:

| Operations                                                                                                 | Concern                              |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `setChartType`, `setChartGrouping`, `setChartSeriesChartType`                                              | Chart/series type and grouping       |
| `setChartLegend`, `setChartDataLabels`                                                                     | Legend placement, data labels        |
| `setChartAxis`, `setChartAxisLogScale`, `setChartAxisTitleStyle`, `setChartAxisGridlineStyle`              | Axis range, scale, titles, gridlines |
| `setChartSeriesTrendline`, `setChartSeriesErrorBars`                                                       | Trendlines and error bars            |
| `setChartSeriesColor`, `setChartSeriesMarker`                                                              | Series appearance                    |
| `setChartDataPointFill`, `setChartDataPointExplosion`, `setChartDataPointMarker`, `setChartDataPointLabel` | Per-data-point overrides             |

Series-index arguments are validated and throw on out-of-range values.

## rawXml and round-trip fields

Elements parsed from a real `.pptx` carry `rawXml`: the original parsed OOXML node (`p:sp`, `p:pic`, `p:graphicFrame`, ...). On save, the writer starts from `rawXml` when present and re-applies the typed model fields (transform, geometry, style, text) on top of it, so attributes and children the typed model does not represent survive the round trip. Elements built with the SDK have no `rawXml` and get canonical XML generated from scratch.

The same pattern appears at finer granularity: `shapeStyle.fillColorXml` / `fillGradientXml` / `fillPatternXml`, `textStyle.runPropertiesXml`, table-cell `tcPr` storage, animation and extension-list captures, and others.

::: warning Leave rawXml alone
Treat `rawXml` and the `*Xml` side fields as opaque. Do not delete them (that discards fidelity the writer would otherwise preserve) and do not hand-edit them unless you are deliberately writing OOXML; the supported editing surface is the typed fields, which take precedence where they overlap.
:::

## Recipes

### Bulk find and replace

```ts
import { PptxHandler, replaceText } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);
replaceText(data.slides, /\b2025\b/g, '2026');
const bytes = await handler.save(data.slides);
```

### Restyle with a theme preset

`THEME_PRESETS` ships built-in color/font schemes (office, facet, integral, ion, organic, retrospect, slate, metropolitan, ...). `handler.switchThemePreset` updates both the in-memory ZIP (so the change persists through save) and the resolved colors in the parsed data:

```ts
import { THEME_PRESETS } from 'pptx-viewer-core';

const preset = THEME_PRESETS.find((p) => p.id === 'ion')!;
const rethemed = await handler.switchThemePreset(data, preset);
const bytes = await handler.save(rethemed.slides);
```

For a custom scheme, `handler.applyTheme(colorScheme, fontScheme, themeName?)` plus the pure `applyThemeToData(data, colorScheme, fontScheme?, themeName?)` do the same in two steps.

### Reorder slides

```ts
// In place on the array:
const [moved] = data.slides.splice(4, 1);
data.slides.splice(0, 0, moved);

// Or with the Presentation class:
pptx.reorderSlides([2, 0, 1, 3]); // new order by old index
```

### Stamp every slide

```ts
import { TextBuilder } from 'pptx-viewer-core';

for (const slide of data.slides) {
	slide.elements.push(
		TextBuilder.create('Confidential')
			.fontSize(12)
			.color('#999999')
			.position(50, 520)
			.size(300, 20)
			.build(),
	);
}
```

Builders generate fresh unique ids on every `build()`, so the same chain can be rebuilt per slide.

## Complete load, mutate, save

```ts
import { PptxHandler, replaceText, TextBuilder } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

// 1. Find/replace across the deck
replaceText(data.slides, '2025', '2026');

// 2. Reposition the first element
const el = data.slides[0].elements[0];
el.x = 100;
el.y = 100;

// 3. Add a footer to slide 1
data.slides[0].elements.push(
	TextBuilder.create('Confidential')
		.fontSize(12)
		.color('#999')
		.position(50, 520)
		.size(300, 20)
		.build(),
);

// 4. Save
const bytes = await handler.save(data.slides); // Uint8Array
```

See [/core/saving](/core/saving) for writing the result to disk or the browser, and [/core/builder](/core/builder) for creating decks from scratch.
