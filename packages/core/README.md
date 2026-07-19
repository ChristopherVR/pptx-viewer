# pptx-viewer-core

[![npm version](https://img.shields.io/npm/v/pptx-viewer-core.svg)](https://www.npmjs.com/package/pptx-viewer-core)
[![license](https://img.shields.io/npm/l/pptx-viewer-core.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/pptx-viewer-core.svg)](https://www.npmjs.com/package/pptx-viewer-core)

> A TypeScript library that **reads, creates, edits, and saves** PowerPoint (`.pptx`) files. It runs in the browser and in Node.js, with no native or system dependencies.

Hand it the bytes of a `.pptx` file and it gives you back a structured, fully typed object that describes every slide: text, shapes, images, charts, tables, and more. Change anything in that object and write it back to a valid `.pptx`. You can also build new presentations from scratch with a simple chainable API, or turn a deck into Markdown.

There is no UI here: this is the engine on its own. Use it directly when you need to process `.pptx` files without a screen, for example on a server, in a script, or in a build step. The same engine powers the [React](https://www.npmjs.com/package/pptx-react-viewer), [Vue](https://www.npmjs.com/package/pptx-vue-viewer), [Angular](https://www.npmjs.com/package/pptx-angular-viewer), [Svelte](https://www.npmjs.com/package/pptx-svelte-viewer), and [Vanilla JavaScript](https://www.npmjs.com/package/pptx-vanilla-viewer) viewers.

![The core engine loading a PPTX into a typed slide model, then saving or converting it](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/core-engine.svg)

<samp>**[📦 npm](https://www.npmjs.com/package/pptx-viewer-core)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[▶️ Live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[Choose a viewer](https://christophervr.github.io/pptx-viewer/guide/installation)**</samp>

---

## Install

```bash
npm install pptx-viewer-core
```

> That's it, nothing else to install. All runtime dependencies are pulled in automatically by your package manager. Password protection and digital signatures need a few extra packages (`node-forge`, `xml-crypto`, `@xmldom/xmldom`), but only if you actually use those features.

## What it does

| Capability  | Description                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Read**    | Open a `.pptx` and pull out slides, text, shapes, images, charts, tables, SmartArt, themes, comments, animations, transitions, and document info |
| **Edit**    | Change the data in memory: add, remove, or reorder slides; insert elements; edit text; restyle; switch themes                                    |
| **Save**    | Write the changed data back to a valid `.pptx`, leaving everything you did not touch untouched                                                   |
| **Convert** | Turn a deck into Markdown, optionally pulling the images out alongside it                                                                        |
| **Export**  | Save individual slides as their own standalone `.pptx` files                                                                                     |
| **Protect** | Open and save password-protected files (AES-128/256 encryption)                                                                                  |

Positions and sizes use PowerPoint's own internal unit, the EMU (English Metric Unit): 1 inch = 914,400 EMU, 1 point = 12,700 EMU, and 1 pixel = 9,525 EMU at 96 DPI. You rarely deal with the raw numbers: helpers (`inches`, `cm`, `mm`, `pt`) let you work in familiar units instead.

---

## Quick start

```typescript
import { PptxHandler } from 'pptx-viewer-core';

// 1. Open a .pptx file
const handler = new PptxHandler();
const buffer = await fetch('presentation.pptx').then((r) => r.arrayBuffer());
const data = await handler.load(buffer);

console.log(
	`${data.slides.length} slides, canvas ${data.canvasSize.width}×${data.canvasSize.height}`,
);

// 2. Change a slide
data.slides[0].elements[0].text = 'Updated title';

// 3. Save it back to .pptx bytes
const outputBytes = await handler.save(data.slides); // => Uint8Array

// 4. Or pull out just a few slides as separate files
const exports = await handler.exportSlides(data.slides, { slideIndexes: [0, 2] }); // => Map<number, Uint8Array>
```

`load()` gives you a `PptxData` object: a plain, fully typed description of the presentation. Read from it, change it, and pass its `slides` back to `save()` to get a valid `.pptx` file as bytes.

### Build a presentation from scratch

The chainable API lets you create a deck step by step, without touching any file format details:

```typescript
import { Presentation, ThemePresets, ChartBuilder } from 'pptx-viewer-core';

const pptx = await Presentation.create({
	title: 'Sales Report',
	theme: ThemePresets.MODERN_BLUE,
});

// Each slide is added to the deck automatically: no manual .build() or .push() needed
pptx
	.addSlide('Title Slide')
	.addText('Q4 Sales Report', { fontSize: 44, bold: true, x: 100, y: 200, width: 800, height: 80 });

pptx
	.addSlide('Blank')
	.addText('Revenue by Region', { fontSize: 28, x: 50, y: 30, width: 600, height: 50 })
	.addBuilderElement(
		ChartBuilder.create('bar')
			.categories(['North', 'South', 'East', 'West'])
			.addSeries('2026', [210, 150, 180, 120], '#2563EB')
			.title('Revenue ($M)')
			.bounds(50, 100, 860, 420),
	);

pptx.replaceText('2026', 'FY2026'); // find/replace, merge, and templates all chain the same way

const bytes = await pptx.save();
```

The builder API comes in three levels, from highest to lowest:

1. **`Presentation`**: the whole deck at once (slides, text operations, sections, templates, merging, saving).
2. **Element builders**: one per element type, for fine-grained control: `TextBuilder`, `ShapeBuilder`, `ChartBuilder`, `TableBuilder`, `ImageBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder`.
3. **`PptxXmlBuilder`**: raw XML, for the rare cases the higher levels do not cover.

It also ships unit helpers (`inches`, `cm`, `mm`, `pt`), common slide sizes (`SlideSizes`), and 8 ready-made themes (`ThemePresets`). The [full docs](https://christophervr.github.io/pptx-viewer/) cover every builder.

### Turn a deck into Markdown

```typescript
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter(
	'./output', // output directory for the .md file and extracted media
	{
		sourceName: 'presentation.pptx',
		includeMetadata: true,
		includeSpeakerNotes: true,
		mediaFolderName: 'media',
		semanticMode: true, // clean headings/lists instead of positioned HTML
	},
	fileSystemAdapter,
);

const markdown = await converter.convert(data); // => the Markdown text
```

To write files to disk, pass a `FileSystemAdapter` (an object with `writeFile`, `writeBinaryFile`, and `createFolder` methods); this keeps the converter free of any assumptions about where it runs. By default it keeps each element where it sat on the slide (absolutely positioned HTML); set `semanticMode: true` to get clean headings, paragraphs, and lists instead.

---

## `PptxHandler` API

`PptxHandler` is the one class you use to open, change, and save files. Its main methods:

| Method                     | Signature                                               | What it does                                           |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `load`                     | `(data, options?) => Promise<PptxData>`                 | Open a `.pptx` and return the structured data          |
| `save`                     | `(slides, options?) => Promise<Uint8Array>`             | Write slides back to `.pptx` bytes                     |
| `exportSlides`             | `(slides, options) => Promise<Map<number, Uint8Array>>` | Save chosen slides as standalone files                 |
| `getImageData`             | `(path) => Promise<string \| undefined>`                | Get an embedded image as a base64 data URL             |
| `getMediaArrayBuffer`      | `(path) => Promise<ArrayBuffer \| undefined>`           | Get the raw bytes of an embedded media file            |
| `getLayoutOptions`         | `() => PptxLayoutOption[]`                              | List the slide layouts available                       |
| `getCompatibilityWarnings` | `() => PptxCompatibilityWarning[]`                      | List features in the file that are not fully supported |
| `applyTheme`               | `(colors, fonts, name?) => Promise<void>`               | Apply a complete theme                                 |
| `setPresentationTheme`     | `(path, applyToAll?) => Promise<void>`                  | Load a `.thmx` theme file                              |

The `PptxData` you get from `load()` exposes `slides`, `canvasSize`, `theme`, `slideMasters`, `slideLayouts`, `sections`, `coreProperties`, `embeddedFonts`, and more. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete `PptxHandler`, chart/SmartArt, and theme APIs.

## What's supported

| Category          | Details                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Element types** | 16: text, shape, connector, image, picture, table, chart, smartArt, ole, media, group, ink, contentPart, zoom, model3d, unknown                     |
| **Preset shapes** | 187+ PowerPoint shapes, including ones with adjustable handles                                                                                      |
| **Chart types**   | 23, including waterfall, funnel, treemap, sunburst, box-whisker, region-map, and combo charts; with trendlines, error bars, and embedded Excel data |
| **Transitions**   | 46 types (including morph, vortex, ripple, and shred)                                                                                               |
| **Animations**    | 40+ presets, including colour animation, motion paths, and text that builds in by word, letter, or paragraph                                        |
| **SmartArt**      | 14 layout families, broken into editable shapes with a live reflow engine for structural edits                                                      |
| **Fills**         | Solid, gradient (linear, radial, path), image, and 56 patterns                                                                                      |
| **Themes**        | 8 built-in presets, switchable at runtime, with layout and placeholder remapping                                                                    |
| **Security**      | AES-128/256 encryption and decryption, modify-password (SHA), and detection of digital signatures                                                   |
| **Preserved**     | VBA macros, custom XML, comment authors, and strict-format files are kept intact through a save                                                     |

## How it works

You only ever work with one class, `PptxHandler`, and one data object, `PptxData`. The engine takes care of the rest: when you call `load()` it unzips the file, reads the XML, resolves the theme, masters, and layouts, and hands you a clean object. `save()` runs those same steps in reverse.

A few things worth knowing as you use it:

- **Every element has a `type` field** (`text`, `shape`, `image`, `chart`, `table`, and so on). Check it before reading element-specific properties, for example `if (element.type === 'image')`. TypeScript then knows exactly which fields exist.
- **Shapes are drawn from a built-in catalogue** of 187+ PowerPoint shapes, so curves, arrows, and callouts come out with the right outlines.
- **Colours follow PowerPoint's theme rules**, so a colour defined as "accent 1, but 20% lighter" resolves to the correct final value for the active theme.

Under the hood the engine is split into many small, focused modules. If you want the full load and save pipeline, the complete type system, and a module-by-module map, see the [full documentation](https://christophervr.github.io/pptx-viewer/).

## Limitations

- **OLE objects** (embedded Word docs, spreadsheets, and similar) cannot be edited in place: you get their preview image and can extract/download the embedded payload, but not edit its contents.
- **SmartArt** is broken into editable shapes. It uses PowerPoint's own pre-computed shape geometry when present; after structural edits (add/remove/reorder/promote/demote nodes) a live reflow engine rebuilds the shapes, with an algorithmic fallback covering 14 layout families for diagrams PowerPoint never rendered.
- **Chart editing** covers data, categories, and chart type, plus legend, axes (scale, format, titles, gridlines, log/display units), data labels, trendlines, error bars, and per-series/per-point markers and fills. A handful of rarely-used chart properties remain read-only for display.
- **Strict-format files** (ISO/IEC 29500 Strict) are converted to the more common Transitional form when opened and converted back when saved.

See the [full docs](https://christophervr.github.io/pptx-viewer/) for the details behind each of these.

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
