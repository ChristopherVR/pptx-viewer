---
title: Core Engine Overview
description: pptx-viewer-core is a framework-agnostic TypeScript engine for parsing, creating, editing, serializing, and converting PowerPoint (.pptx) files entirely in memory.
---

# Core Engine Overview

`pptx-viewer-core` is a **framework-agnostic** TypeScript engine for working with PowerPoint (`.pptx`) files. It parses, creates, edits, serializes, and converts presentations entirely in memory on the OpenXML ZIP archive - no native dependencies, no browser DOM required.

A `.pptx` file is a ZIP archive of XML documents conforming to the [Office Open XML (OOXML)](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/) specification. This package gives you a complete, typed SDK over that format. It has only two runtime dependencies: **jszip** (ZIP handling) and **fast-xml-parser** (XML parse/build).

::: tip Where this fits
The React package (`pptx-viewer`) renders the data model this engine produces. The MCP tools package wraps it for AI agents. See [/react/](/react/) and [/packages/mcp](/packages/mcp).
:::

## Install

```bash
bun add pptx-viewer-core
# or: npm install pptx-viewer-core
```

## Capabilities

| Capability          | Description                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parse**           | Unzip, parse XML, and extract slides, elements, themes, masters, layouts, media, charts, SmartArt, comments, animations, transitions, and document properties. |
| **Create**          | Build presentations from scratch with a fluent builder API ([/core/builder](/core/builder)).                                                                   |
| **Edit**            | Mutate the in-memory data model - add/remove/reorder slides, insert elements, modify text, change styles, update themes ([/core/editing](/core/editing)).      |
| **Save**            | Serialize the data model back into a valid `.pptx` ZIP archive with full round-trip fidelity ([/core/saving](/core/saving)).                                   |
| **Convert**         | Transform parsed PPTX into Markdown, optionally extracting media ([/core/converter](/core/converter)).                                                         |
| **Export**          | Headless SVG export of slides without a browser ([/core/svg-export](/core/svg-export)); export individual slides as standalone `.pptx` files.                  |
| **Encrypt/Decrypt** | Read and write password-protected PPTX using AES-128/256 agile encryption ([/core/encryption](/core/encryption)).                                              |

## The `PptxHandler` facade

`PptxHandler` is the primary entry point. It wraps the runtime engine behind a small, stable surface. The lifecycle is straightforward:

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();

// 1. Load - parse a .pptx buffer into the structured PptxData model
const data = await handler.load(arrayBuffer);

// 2. Edit - mutate data.slides in place
data.slides[0].elements[0].text = 'Updated title';

// 3. Save - serialize the slides back to .pptx bytes
const bytes = await handler.save(data.slides); // => Uint8Array
```

To build a deck from nothing instead of loading one, use the static factories:

```ts
const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Q4 Report',
	initialSlideCount: 0,
});

data.slides.push(createSlide('Title Slide').addText('Hello', { fontSize: 36 }).build());
const bytes = await handler.save(data.slides);
```

`PptxHandler.create(options)` and its alias `PptxHandler.createBlank(options)` return `{ handler, data, createSlide }`. See [/core/builder](/core/builder) for the full fluent API, and [/core/loading](/core/loading) for the load pipeline.

::: info Lifecycle
`new PptxHandler()` → `load()` → mutate `data` → `save()` / `saveEncrypted()` / `exportSlides()`. The same handler instance holds the in-memory ZIP, so call `save` on the handler that loaded (or created) the data.
:::

## Main public exports

Everything is re-exported from the package root (`pptx-viewer-core`). Import from the barrel, not individual files.

| Export                                                                                                                            | Kind      | Purpose                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| `PptxHandler`                                                                                                                     | class     | Load, edit, save, encrypt, export. The facade.                  |
| `Presentation`                                                                                                                    | class     | Highest-level fluent presentation builder.                      |
| `TextBuilder`, `ShapeBuilder`, `ImageBuilder`, `TableBuilder`, `ChartBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder` | classes   | Tier-2 element builders ([/core/builder](/core/builder)).       |
| `PptxXmlBuilder`                                                                                                                  | class     | Low-level fluent in-place mutation of `PptxData`.               |
| `ThemePresets`, `SlideSizes`                                                                                                      | consts    | 8 built-in themes; standard slide dimensions (EMU).             |
| `inches`, `cm`, `mm`, `pt`, `inchesToEmu`                                                                                         | functions | Unit-conversion helpers.                                        |
| `PptxMarkdownConverter`                                                                                                           | class     | PPTX → Markdown converter ([/core/converter](/core/converter)). |
| `SvgExporter`                                                                                                                     | class     | Headless SVG export ([/core/svg-export](/core/svg-export)).     |
| `PptxData`, `PptxSlide`, `PptxElement`, `TextStyle`, `ShapeStyle`, `TableData`, `PptxChartData`, `PptxTheme`, …                   | types     | The type system - see [/guide/data-model](/guide/data-model).   |
| `getShapeClipPath`, `evaluateGuides`, `getConnectorPathGeometry`, `getElementTransform`, …                                        | functions | Geometry helpers ([/core/geometry](/core/geometry)).            |
| `parseDrawingColor` and colour utilities                                                                                          | functions | OOXML colour parsing and transforms.                            |

## Architecture at a glance

- **`PptxHandler`** → wraps `PptxHandlerCore` → wraps `PptxHandlerRuntime`.
- The **runtime** is assembled from 50+ focused mixin modules (theme loading, element parsing, save pipeline, etc.).
- The **type system** centres on `PptxElement`, a discriminated union of 16 variants narrowed by `element.type`. See [/guide/concepts](/guide/concepts) and [/guide/data-model](/guide/data-model).
- **EMU** (English Metric Units) is the native coordinate system: `1 inch = 914,400 EMU`, `1 point = 12,700 EMU`, `1 pixel = 9,525 EMU` at 96 DPI.

## Next steps

- [Loading & Parsing](/core/loading) - open a `.pptx` and walk the data model.
- [The Builder API](/core/builder) - create decks fluently.
- [Editing Programmatically](/core/editing) - mutate loaded data.
- [Saving & Round-tripping](/core/saving) - serialize back to `.pptx`.
- [Markdown Converter](/core/converter) and [SVG Export](/core/svg-export).
- [Encryption](/core/encryption) and the [Geometry Engine](/core/geometry).
- [CLI](/core/cli) - the `pptx` command-line tool.
