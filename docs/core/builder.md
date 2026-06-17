---
title: The Builder API
description: Create PowerPoint presentations from scratch with the fluent Presentation, SlideBuilder, and element builder APIs in pptx-viewer-core.
---

# The Builder API

`pptx-viewer-core` ships a fluent SDK for building presentations programmatically - no template file needed. There are three tiers, from highest to lowest level:

1. **`Presentation`** / **`PptxHandler.create`** - manage slides, text, sections, merging, and saving with zero boilerplate.
2. **Element builders** - `TextBuilder`, `ShapeBuilder`, `ImageBuilder`, `TableBuilder`, `ChartBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder`.
3. **`PptxXmlBuilder`** - low-level in-place mutation of `PptxData` (see [/core/editing](/core/editing)).

## Creating a presentation

Two equivalent entry points return `{ handler, data, createSlide }`:

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Sales Report',
	creator: 'Sales Team',
	initialSlideCount: 0,
});
```

`PptxHandler.create(options)` is an alias for `PptxHandler.createBlank(options)`. `createSlide(layoutName?)` returns a `SlideBuilder`; call `.build()` to get a `PptxSlide` and push it onto `data.slides`.

### `create` options

```ts
interface PresentationOptions {
	width?: number; // EMU, default 12192000 (16:9)
	height?: number; // EMU, default 6858000  (16:9)
	theme?: PresentationThemeInput;
	title?: string; // docProps/core.xml
	creator?: string; // author
	initialSlideCount?: number; // blank "Blank"-layout slides, default 0
}
```

Use the `SlideSizes` and `ThemePresets` constants and the unit helpers for ergonomic values:

```ts
import { SlideSizes, ThemePresets, inchesToEmu } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	width: SlideSizes.WIDESCREEN_16_9.width,
	height: SlideSizes.WIDESCREEN_16_9.height,
	theme: { name: 'Brand', colors: { accent1: '#2563EB' } },
});
```

`SlideSizes` includes `WIDESCREEN_16_9`, `STANDARD_4_3`, and `A4_LANDSCAPE` (EMU values). The `theme.colors` object accepts the OOXML scheme slots (`dk1`, `lt1`, `dk2`, `lt2`, `accent1`–`accent6`, …) and `theme.fonts` accepts `majorFont` / `minorFont`.

::: tip High-level `Presentation` class
The `Presentation` class wraps the same engine with auto-tracked slides (`Presentation.create(options)` / `Presentation.load(buffer)`), plus `replaceText`, `merge`, `diff`, sections, templates, `applyTemplate`, `mailMerge`, `save()`, and `saveEncrypted()`. It's the recommended top-level entry when you don't need the raw `handler`/`data` references.
:::

## Building a slide with `SlideBuilder`

`createSlide(layoutName?)` (or `Presentation.addSlide(layoutName?)`) returns a chainable `SlideBuilder`. Each `add*` call returns the builder, so calls chain:

```ts
const slide = createSlide('Blank')
	.addText('Q4 2026 Results', { fontSize: 44, bold: true, x: 100, y: 200, width: 800, height: 80 })
	.addShape('roundRect', {
		fill: { type: 'solid', color: '#2563EB' },
		text: 'See appendix',
		x: 700,
		y: 450,
		width: 200,
		height: 40,
	})
	.addImage('data:image/png;base64,iVBOR...', { x: 50, y: 50, width: 200, height: 100 })
	.addTable(
		{ rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }] },
		{ x: 50, y: 150, width: 400, height: 120 },
	)
	.addChart(
		'bar',
		{
			series: [{ name: '2026', values: [140, 170, 195, 210], color: '#2563EB' }],
			categories: ['Q1', 'Q2', 'Q3', 'Q4'],
			title: 'Revenue ($M)',
		},
		{ x: 50, y: 300, width: 600, height: 240 },
	)
	.setBackground({ type: 'solid', color: '#1B2A4A' })
	.setNotes('Open with the revenue highlight')
	.setTransition({ type: 'fade', duration: 500 })
	.build();

data.slides.push(slide);
```

### `SlideBuilder` methods

| Group              | Methods                                                                                                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add elements**   | `addText(text, options)`, `addShape(preset, options)`, `addImage(src, options)`, `addTable(data, options?)`, `addChart(type, data, options?)`, `addConnector(options)`, `addMedia(kind, src, options)`, `addGroup(children, options)`, `addFreeform(svgPath, options)`, `addElement(element)`, `addBuilderElement(builder)` |
| **Slide props**    | `setBackground(fill)`, `setTransition(transition)`, `addAnimation(elementId, options)`, `setNotes(text)`, `setHidden(bool)`, `setSection(name)`, `setName(name)`                                                                                                                                                            |
| **Query / finish** | `getElements()`, `getLastElement()`, `elementCount`, `removeElement(id)`, `build()`                                                                                                                                                                                                                                         |

Positions in `add*` options are **pixels** (converted to EMU internally). `addText` options include `fontSize`, `fontFamily`, `bold`, `italic`, `underline`, `color`, `x`, `y`, `width`, `height`, and more.

## Element builders

For step-by-step construction, the eight element builders each expose a `.create(...)` static and a `.build()` that produces a standard `PptxElement`. Hand the builder straight to `addBuilderElement`, or `.build()` it yourself.

```ts
import { TextBuilder, ShapeBuilder, ChartBuilder, TableBuilder } from 'pptx-viewer-core';

// Text - rich, chainable styling
const title = TextBuilder.create('Hello World')
	.fontSize(36)
	.bold()
	.color('#2563EB')
	.fontFamily('Inter')
	.alignment('center')
	.position(100, 100)
	.size(600, 80)
	.build();

// Shape - fill/stroke/shadow convenience methods + geometry adjustments
const button = ShapeBuilder.create('roundRect')
	.solidFill('#4472C4')
	.stroke({ color: '#000', width: 2 })
	.text('Click me')
	.adjustments({ adj1: 16667 })
	.position(200, 200)
	.size(300, 200)
	.build();

// Chart - bar | line | pie | doughnut | area | scatter | ...
const chart = ChartBuilder.create('bar')
	.categories(['North', 'South', 'East', 'West'])
	.addSeries('2026', [210, 150, 180, 120], '#2563EB')
	.title('Revenue ($M)')
	.legend(true, 'b')
	.grouping('clustered')
	.bounds(50, 100, 860, 420)
	.build();

// Table - header row, data rows, banding, proportional widths
const table = TableBuilder.create()
	.headerRow(['Name', 'Q1', 'Q2'])
	.addRow(['North', '120', '145'])
	.columnWidths([2, 1, 1])
	.bandRows()
	.position(50, 150)
	.size(860, 250)
	.build();
```

The remaining builders follow the same pattern: `ImageBuilder.create(src)`, `ConnectorBuilder.create()`, `MediaBuilder.video(src)` / `MediaBuilder.audio(src)`, and `GroupBuilder.create()` (which accepts `addChild`, `addChildBuilder`, and `addChildren`).

## Saving

Once `data.slides` holds your slides, serialize with the handler that created them:

```ts
const bytes = await handler.save(data.slides); // Uint8Array
```

See [/core/saving](/core/saving) for writing to disk or triggering a browser download, and [/core/editing](/core/editing) for mutating decks you've loaded.

## Unit helpers and theme presets

```ts
import { inches, cm, mm, pt, inchesToEmu, SlideSizes, ThemePresets } from 'pptx-viewer-core';

inches(1); // => 96 (pixels at 96 DPI)
inchesToEmu(10); // => 9144000 (EMU, for width/height options)
ThemePresets.MODERN_BLUE; // one of 8 built-in presets
```

`ThemePresets` provides `OFFICE`, `MODERN_BLUE`, `CORPORATE`, `DARK`, `VIBRANT`, `EARTH`, `MONOCHROME`, and `MINIMAL`.
