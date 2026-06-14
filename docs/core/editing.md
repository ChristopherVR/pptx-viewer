---
title: Editing Programmatically
description: Mutate a loaded PptxData model in pptx-viewer-core — edit text, move and resize elements, add and remove elements and slides, and work with tables and charts.
---

# Editing Programmatically

After [loading](/core/loading) a deck into `PptxData`, you edit by mutating the in-memory model directly, then [save](/core/saving). The model is a plain object graph — there's no transaction layer to fight; mutate `data.slides` and hand it to `handler.save()`.

::: tip Same handler
Always call `save()` on the handler that produced the data. It owns the in-memory ZIP (media, masters, custom parts) that the save pipeline reuses.
:::

## Editing text

The quickest edit is the `text` field on a text/shape element. Narrow on `type` first (see [/guide/concepts](/guide/concepts)):

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

For deck-wide find/replace, the SDK exposes pure helpers:

```ts
import { findText, replaceText } from 'pptx-viewer-core';

const matches = findText(data.slides, /Q[1-4]/g); // FindResult[]
const count = replaceText(data.slides, '2025', '2026');
```

Rich text lives in each element's paragraph/segment structure (see [/guide/data-model](/guide/data-model)); editing the `text` convenience field updates the rendered run text.

## Moving and resizing elements

Element positions are stored as `x`, `y`, `width`, `height`, with optional `rotation`. These are on every element via `PptxElementBase`:

```ts
const el = data.slides[0].elements[0];
el.x += 100; // shift right
el.y = 50; // move to top
el.width = 400; // resize
el.rotation = 15; // degrees
```

::: info Units
The data model exposes element coordinates in pixels for rendering convenience; PowerPoint's native unit is EMU (`1 px = 9,525 EMU` at 96 DPI). The save pipeline converts back to EMU automatically. Constants live in `core/constants.ts`.
:::

## Adding and removing elements

`data.slides[i].elements` is a plain array — push, splice, or filter it. Build new elements with the [element builders](/core/builder):

```ts
import { TextBuilder, ShapeBuilder } from 'pptx-viewer-core';

const slide = data.slides[0];

// Add
slide.elements.push(
	TextBuilder.create('Added at runtime').fontSize(24).position(50, 400).size(600, 40).build(),
);

// Remove by id
slide.elements = slide.elements.filter((e) => e.id !== 'el_to_delete');
```

For chainable, intent-revealing mutation you can use `PptxXmlBuilder`:

```ts
import { PptxXmlBuilder } from 'pptx-viewer-core';

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
	.project(); // => mutated PptxData
```

## Adding and removing slides

Slides are likewise a plain array. Create new slides with `createSlide` (from `PptxHandler.create`) or the high-level `Presentation` class, which offers `insertSlide`, `duplicateSlide`, `removeSlide`, `moveSlide`, `swapSlides`, and `reorderSlides`:

```ts
// Low-level: with a handler returned from create()
data.slides.splice(1, 0, createSlide('Blank').addText('Inserted').build());
data.slides.splice(3, 1); // remove slide 4
```

```ts
// High-level: Presentation manages slides for you
import { Presentation } from 'pptx-viewer-core';

const pptx = await Presentation.load(buffer);
pptx.duplicateSlide(0).moveSlide(0, 2).removeSlide(5);
const bytes = await pptx.save();
```

The save pipeline reconciles added, removed, and reordered slides — rebuilding `ppt/presentation.xml`, relationships, and content types.

## Working with tables

Table content lives in `element.tableData` on a `type: 'table'` element (`rows`, `columns`, `cells`, styles). Mutate cells in place:

```ts
for (const el of slide.elements) {
	if (el.type === 'table' && el.tableData) {
		el.tableData.rows[0].cells[0].text = 'Header';
	}
}
```

## Working with charts

Chart data lives in `element.chartData` on a `type: 'chart'` element. The SDK provides pure operations for data-level edits:

```ts
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartDataPoint,
	setChartTitle,
} from 'pptx-viewer-core';
```

::: warning Chart editing is data-level only
You can add/remove series, edit data points, add/remove categories, change the chart type, and set the title. **Structural** chart properties (axis formatting, legend placement, data labels, trendlines, error bars) are parsed for display but **not** exposed for programmatic editing. See [/guide/limitations](/guide/limitations).
:::

## Complete load → mutate → save

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

See [/core/saving](/core/saving) for writing the result to disk or the browser.
