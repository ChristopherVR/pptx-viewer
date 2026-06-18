# pptx-viewer-core

[![npm version](https://img.shields.io/npm/v/pptx-viewer-core.svg)](https://www.npmjs.com/package/pptx-viewer-core)
[![license](https://img.shields.io/npm/l/pptx-viewer-core.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/pptx-viewer-core.svg)](https://www.npmjs.com/package/pptx-viewer-core)

> The framework-agnostic TypeScript engine to **parse, create, edit, serialise, and convert** PowerPoint (`.pptx`) files — runs in the browser and Node.js with no native dependencies.

This is the headless core SDK. Point it at a `.pptx` `ArrayBuffer` and get back a fully typed `PptxData` model you can read, mutate, and write straight back to a valid `.pptx`. It also builds presentations from scratch with a fluent API and converts decks to Markdown. It powers the [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer), `pptx-vue-viewer`, and `pptx-angular-viewer` UI components.

<samp>**[📦 npm](https://www.npmjs.com/package/pptx-viewer-core)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[▶️ Live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[⚛️ React UI](https://www.npmjs.com/package/pptx-react-viewer)**</samp>

---

## Install

```bash
npm install pptx-viewer-core
# required peers:
npm install jszip fast-xml-parser
```

> Only two required peers: **jszip** (ZIP handling) and **fast-xml-parser** (XML parse/build). Encryption and digital-signature features pull in optional peers (`node-forge`, `xml-crypto`, `@xmldom/xmldom`) only if you use them.

## What it does

| Capability          | Description                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parse**           | Unzip and extract slides, elements, themes, masters, layouts, media, charts, SmartArt, comments, animations, transitions, and document properties |
| **Edit**            | Mutate the in-memory data model — add/remove/reorder slides, insert elements, modify text, change styles, update themes                           |
| **Save**            | Serialise the modified model back into a valid .pptx ZIP with round-trip fidelity                                                                 |
| **Convert**         | Transform parsed PPTX into Markdown with optional media extraction                                                                                |
| **Export**          | Export individual slides as standalone .pptx files                                                                                                |
| **Encrypt/Decrypt** | Read and write password-protected PPTX files using AES-128/256 Agile encryption                                                                   |

The core type system uses **EMU (English Metric Units)** natively (`1 inch = 914,400 EMU`, `1 pt = 12,700 EMU`, `1 px = 9,525 EMU @ 96 DPI`).

---

## Quick start

```typescript
import { PptxHandler } from 'pptx-viewer-core';

// 1. Parse a PPTX file
const handler = new PptxHandler();
const buffer = await fetch('presentation.pptx').then((r) => r.arrayBuffer());
const data = await handler.load(buffer);

console.log(
	`${data.slides.length} slides, canvas ${data.canvasSize.width}×${data.canvasSize.height}`,
);

// 2. Modify slides
data.slides[0].elements[0].text = 'Updated title';

// 3. Save back to .pptx
const outputBytes = await handler.save(data.slides); // => Uint8Array

// 4. Export individual slides
const exports = await handler.exportSlides(data.slides, { slideIndexes: [0, 2] }); // => Map<number, Uint8Array>
```

### Create from scratch (fluent API)

```typescript
import { Presentation, ThemePresets, ChartBuilder } from 'pptx-viewer-core';

const pptx = await Presentation.create({
	title: 'Sales Report',
	theme: ThemePresets.MODERN_BLUE,
});

// Slides are auto-tracked — no manual .build() or .push() needed
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

pptx.replaceText('2026', 'FY2026'); // find/replace, merge, template — all fluent

const bytes = await pptx.save();
```

The fluent SDK has three tiers: the high-level `Presentation` (slides, text ops, sections, templates, merge, save), element builders (`TextBuilder`, `ShapeBuilder`, `ChartBuilder`, `TableBuilder`, `ImageBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder`), and low-level XML builders (`PptxXmlBuilder`). It ships unit helpers (`inches`, `cm`, `mm`, `pt`), `SlideSizes`, and 8 `ThemePresets`. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete builder API.

### PPTX → Markdown conversion

```typescript
import { PptxMarkdownConverter } from 'pptx-viewer-core';

const converter = new PptxMarkdownConverter({ includeMetadata: true, imageHandling: 'extract' });
const result = await converter.convert(
	buffer,
	{ outputPath: 'output.md', mediaFolderName: 'media' },
	fileSystemAdapter,
);
// => ConversionResult with markdown string + extracted media stats
```

Supply a `FileSystemAdapter` (`writeFile`, `writeBinaryFile`, `createFolder`) for disk output. Positioned mode (default) emits absolutely-positioned HTML; `semanticMode: true` emits clean headings/paragraphs/lists.

---

## `PptxHandler` API

The primary facade for loading, editing, and saving PPTX files.

| Method                     | Signature                                               | Description                                 |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `load`                     | `(data, options?) => Promise<PptxData>`                 | Parse a .pptx buffer into structured data   |
| `save`                     | `(slides, options?) => Promise<Uint8Array>`             | Serialise slides back to .pptx bytes        |
| `exportSlides`             | `(slides, options) => Promise<Map<number, Uint8Array>>` | Export selected slides as standalone files  |
| `getImageData`             | `(path) => Promise<string \| undefined>`                | Get a base64 data URL for an embedded image |
| `getMediaArrayBuffer`      | `(path) => Promise<ArrayBuffer \| undefined>`           | Get raw bytes for an embedded media file    |
| `getLayoutOptions`         | `() => PptxLayoutOption[]`                              | Available slide layout options              |
| `getCompatibilityWarnings` | `() => PptxCompatibilityWarning[]`                      | Warnings about unsupported features         |
| `applyTheme`               | `(colors, fonts, name?) => Promise<void>`               | Apply a complete theme                      |
| `setPresentationTheme`     | `(path, applyToAll?) => Promise<void>`                  | Load a .thmx theme file                     |

`PptxData` exposes `slides`, `canvasSize`, `theme`, `slideMasters`, `slideLayouts`, `sections`, `coreProperties`, `embeddedFonts`, and more. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete `PptxHandler`, chart/SmartArt extraction, and theme APIs.

## Capabilities at a glance

| Category          | Details                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Element types** | 16: text, shape, connector, image, picture, table, chart, smartArt, ole, media, group, ink, contentPart, zoom, model3d, unknown              |
| **Preset shapes** | 187+ with guide-formula evaluation and adjustment handles                                                                                    |
| **Chart types**   | 23, including waterfall, funnel, treemap, sunburst, box-whisker, region-map, and combo; with trendlines, error bars, and embedded Excel data |
| **Transitions**   | 42 types (morph, vortex, ripple, shred, p14 extensions)                                                                                      |
| **Animations**    | 40+ presets with colour animation, motion-path auto-rotation, text build (word/letter/paragraph)                                             |
| **SmartArt**      | 13 layout types decomposed into editable shapes                                                                                              |
| **Fills**         | Solid, gradient (linear/radial/path), image, 48 pattern presets                                                                              |
| **Themes**        | 8 built-in presets, runtime switching, layout/placeholder remapping                                                                          |
| **Security**      | AES-128/256 encryption/decryption, modify password (SHA), digital-signature detection                                                        |
| **Preservation**  | VBA macros, custom XML parts, comment authors, OOXML Strict namespaces                                                                       |

## Architecture & internals

`PptxHandler` (public facade) wraps `PptxHandlerCore` → `PptxHandlerRuntime`, a runtime assembled from 50+ focused mixin modules. A discriminated-union type system, a 200+ preset geometry engine with an OOXML guide-formula evaluator, a colour-transform pipeline, and a registry-based Markdown converter round out the package. For the load/save pipelines, mixin composition, theme-resolution chain, and full module maps, see the [full documentation](https://christophervr.github.io/pptx-viewer/).

## Limitations

Embedded OLE objects are read-only (preview images only). SmartArt is decomposed into editable shapes using PowerPoint's pre-computed drawing data, but there is no live reflow engine. Chart editing is data-level (series, data points, categories, type) — structural properties are parsed for display but not exposed for editing. ISO/IEC 29500 Strict files are normalised to Transitional on load (46+ namespace pairs) and converted back on save. See the [full docs](https://christophervr.github.io/pptx-viewer/) for details.

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
