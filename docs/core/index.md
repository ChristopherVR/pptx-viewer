---
title: Core Engine Overview
description: pptx-viewer-core is a framework-agnostic TypeScript engine for parsing, creating, editing, serializing, and converting PowerPoint (.pptx) files entirely in memory.
---

# Core Engine Overview

`pptx-viewer-core` is a **framework-agnostic** TypeScript engine for working with PowerPoint (`.pptx`) files. It parses, creates, edits, serializes, and converts presentations entirely in memory on the OpenXML ZIP archive - no native dependencies, no browser DOM required.

A `.pptx` file is a ZIP archive of XML documents conforming to the [Office Open XML (OOXML)](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/) specification. This package gives you a complete, typed SDK over that format. It has four runtime dependencies: **jszip** (ZIP handling), **fast-xml-parser** (XML parse/build), and the extracted **emf-converter** and **mtx-decompressor** binary-format packages.

::: tip Where this fits
The viewer bindings (`pptx-react-viewer`, `pptx-vue-viewer`, `pptx-angular-viewer`) render the data model this engine produces. The MCP tools package wraps it for AI agents. See [/react/](/react/) and [/packages/mcp](/packages/mcp).
:::

## Install

```bash
bun add pptx-viewer-core
# or: npm install pptx-viewer-core
```

## Capability map

| Capability          | Entry point                                      | Description                                                                                                                                                    |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parse**           | `handler.load(buffer, options?)`                 | Unzip, parse XML, and extract slides, elements, themes, masters, layouts, media, charts, SmartArt, comments, animations, transitions, and document properties. |
| **Create**          | `PptxHandler.create()` / `Presentation`          | Build presentations from scratch with a fluent builder API ([/core/builder](/core/builder)).                                                                   |
| **Edit**            | mutate `data.slides` / `PptxXmlBuilder`          | Add/remove/reorder slides, insert elements, modify text, change styles, update themes ([/core/editing](/core/editing)).                                        |
| **Save**            | `handler.save(slides, options?)`                 | Serialize the data model back into a valid `.pptx` (or `.ppsx` / `.pptm`) ZIP archive with full round-trip fidelity ([/core/saving](/core/saving)).            |
| **Convert**         | `PptxMarkdownConverter`                          | Transform parsed PPTX into Markdown with media extraction, notes, and metadata ([/core/converter](/core/converter)).                                           |
| **Export**          | `SvgExporter`                                    | Headless SVG rendering of slides, one `<svg>` string per slide, no browser needed ([/core/svg-export](/core/svg-export)).                                      |
| **Encrypt/Decrypt** | `load({ password })` / `handler.saveEncrypted()` | Read password-protected PPTX (standard and agile schemes) and write agile AES-128/AES-256 output ([/core/encryption](/core/encryption)).                       |
| **Theme ops**       | `handler.switchTheme()` / `switchThemePreset()`  | Swap colour/font schemes live; 8 built-in presets in `THEME_PRESETS`.                                                                                          |
| **Text ops**        | `findText` / `replaceText` / `mergePresentation` | Deck-wide search, replace, and slide merging (also exposed via the [CLI](/core/cli)).                                                                          |
| **Validate**        | signature and conformance utilities              | Digital-signature detection, OOXML Strict handling, accessibility and validator helpers.                                                                       |

## Runtime support

The engine builds XML and SVG by string/object manipulation, so it has no DOM dependency anywhere in the load/edit/save path.

| Runtime                         | Parse / Edit / Save | SVG export | Markdown convert     | Encryption               | CLI |
| ------------------------------- | ------------------- | ---------- | -------------------- | ------------------------ | --- |
| **Browser**                     | Yes                 | Yes        | Yes (in-memory)      | Yes (`crypto.subtle`)    | No  |
| **Node 18+**                    | Yes                 | Yes        | Yes (+ disk adapter) | Yes (19+, or flag on 18) | Yes |
| **Bun**                         | Yes                 | Yes        | Yes (+ disk adapter) | Yes                      | Yes |
| **Deno / Workers / serverless** | Yes                 | Yes        | Yes (custom adapter) | Yes                      | No  |

The only platform-conditional pieces are:

- **Encryption** needs Web Crypto on `globalThis.crypto` (`crypto.subtle` and `crypto.getRandomValues`). That is native in browsers, Bun, Deno, Workers, and Node 19+; on Node 18 launch with `--experimental-global-webcrypto`.
- **Writing files** (extracted media, exported SVGs) is your side of the contract: the engine returns strings/`Uint8Array`s, and the converter accepts a pluggable `FileSystemAdapter`.
- The **CLI** binary uses `node:fs` and runs under Node or Bun.

## Lifecycle

```
                 new PptxHandler()
                        |
        ArrayBuffer --> load(buffer, { password? })
                        |        (detect OLE2 -> decrypt -> unzip -> parse XML
                        |         -> resolve theme/master/layout inheritance)
                        v
                    PptxData  { slides, theme, width, height, ... }
                        |
          mutate slides/elements in place  (or via PptxXmlBuilder)
                        |
        +---------------+----------------------+
        |                                      |
   save(slides, options?)          saveEncrypted(slides, password, options?)
        |                                      |
    Uint8Array (.pptx/.ppsx/.pptm)      Uint8Array (encrypted OLE2)
                        |
                  handler.dispose()   (free Blob URLs, caches, ZIP)
```

The handler instance holds the in-memory ZIP archive of the loaded (or created) file. Everything you do not touch - media, masters, custom XML, VBA - passes through it verbatim on save, which is why you must call `save()` on the **same handler** that produced the data. Call `dispose()` when you are done to release memory immediately.

## Quick example

::: code-group

```ts [Load, edit, save]
import { PptxHandler } from 'pptx-viewer-core';
import { readFile, writeFile } from 'node:fs/promises';

const file = await readFile('deck.pptx');
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

const handler = new PptxHandler();
const data = await handler.load(buffer as ArrayBuffer);

console.log(`${data.slides.length} slides, ${data.width}x${data.height}px`);

// Walk the typed element model (discriminated union, narrow on `type`)
for (const el of data.slides[0].elements) {
	if (el.type === 'text') {
		console.log('text box:', el.text);
	}
}

// Edit in place
const title = data.slides[0].elements.find((el) => el.type === 'text');
if (title && title.type === 'text') {
	title.text = 'Updated title';
}

const bytes = await handler.save(data.slides); // => Uint8Array
await writeFile('out.pptx', bytes);
handler.dispose();
```

```ts [Create from scratch]
import { PptxHandler, inchesToEmu } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Q4 Report',
	creator: 'Sales Team',
	width: inchesToEmu(13.333), // EMU; defaults to 16:9 widescreen
	height: inchesToEmu(7.5),
	initialSlideCount: 0,
	theme: { colors: { accent1: '#FF6B6B' }, fonts: { majorFont: 'Montserrat' } },
});

data.slides.push(createSlide('Title Slide').addText('Hello', { fontSize: 36 }).build());

const bytes = await handler.save(data.slides);
```

:::

`PptxHandler.create(options)` and its alias `PptxHandler.createBlank(options)` both accept a `PresentationOptions` object (`width`/`height` in EMU, `theme`, `title`, `creator`, `initialSlideCount`) and return `{ handler, data, createSlide }`. See [/core/builder](/core/builder) for the fluent API and [/core/loading](/core/loading) for the load pipeline and its options (`password`, `eagerDecodeImages`, `maxUncompressedBytes`, `allowExternalImages`).

::: warning Hardened loading
`load()` enforces a zip-bomb budget (500 MiB uncompressed by default, 65,536 entry cap; violation throws `ZipBombError`) and drops external `http(s)` image references unless you opt in with `allowExternalImages: true`.
:::

## Main public exports

Everything is re-exported from the package root (`pptx-viewer-core`). Import from the barrel, not individual files. There are also subpath exports: `pptx-viewer-core/converter`, `pptx-viewer-core/cli`, and `pptx-viewer-core/signature-node` (Node-only signing/PKI helpers).

| Export                                                                                                                            | Kind      | Purpose                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `PptxHandler`                                                                                                                     | class     | Load, edit, save, encrypt. The facade.                                                   |
| `Presentation`                                                                                                                    | class     | Highest-level fluent presentation builder.                                               |
| `TextBuilder`, `ShapeBuilder`, `ImageBuilder`, `TableBuilder`, `ChartBuilder`, `ConnectorBuilder`, `MediaBuilder`, `GroupBuilder` | classes   | Tier-2 element builders ([/core/builder](/core/builder)).                                |
| `PptxXmlBuilder`                                                                                                                  | class     | Low-level fluent in-place mutation of `PptxData`.                                        |
| `ThemePresets`, `THEME_PRESETS`, `SlideSizes`                                                                                     | consts    | 8 builder theme presets; 8 switchable viewer presets; 7 standard slide dimensions (EMU). |
| `inches`, `cm`, `mm`, `pt` (to pixels); `inchesToEmu`, `cmToEmu`, `pixelsToEmu` (to EMU)                                          | functions | Unit-conversion helpers.                                                                 |
| `PptxMarkdownConverter`                                                                                                           | class     | PPTX to Markdown converter ([/core/converter](/core/converter)).                         |
| `SvgExporter`                                                                                                                     | class     | Headless SVG export ([/core/svg-export](/core/svg-export)).                              |
| `decryptPptx`, `encryptPptx`, `verifyPassword`, `detectFileFormat`                                                                | functions | Low-level crypto ([/core/encryption](/core/encryption)).                                 |
| `findText`, `replaceText`, `mergePresentation`                                                                                    | functions | Deck-wide text search/replace and merge.                                                 |
| `PptxData`, `PptxSlide`, `PptxElement`, `TextStyle`, `ShapeStyle`, `TableData`, `PptxChartData`, `PptxTheme`, ...                 | types     | The type system - see [/guide/data-model](/guide/data-model).                            |
| `getShapeClipPath`, `evaluateGuides`, `evaluatePresetShape`, `getConnectorPathGeometry`, `getElementTransform`, ...               | functions | Geometry helpers ([/core/geometry](/core/geometry)).                                     |
| `parseDrawingColor` and colour utilities                                                                                          | functions | OOXML colour parsing and transforms.                                                     |

## Architecture at a glance

- **`PptxHandler`** wraps `PptxHandlerCore`, which delegates to an injectable `IPptxHandlerRuntime` (you can pass your own via `new PptxHandler({ runtime })` for testing).
- The **runtime** is assembled from 96 focused mixin modules (theme loading, element parsing, save pipeline, etc.).
- The **type system** centres on `PptxElement`, a discriminated union of 16 variants (`text`, `shape`, `connector`, `image`, `picture`, `table`, `chart`, `smartArt`, `ole`, `media`, `group`, `ink`, `contentPart`, `zoom`, `model3d`, `unknown`) narrowed by `element.type`. See [/guide/data-model](/guide/data-model).
- **EMU** (English Metric Units) is the native OOXML coordinate system: `1 inch = 914,400 EMU`, `1 point = 12,700 EMU`, `1 pixel = 9,525 EMU` at 96 DPI. The parsed model exposes pixel values (`data.width`/`data.height`) alongside raw EMU (`widthEmu`/`heightEmu`).

## Next steps

- [Loading & Parsing](/core/loading) - open a `.pptx` and walk the data model.
- [The Builder API](/core/builder) - create decks fluently.
- [Editing Programmatically](/core/editing) - mutate loaded data.
- [Saving & Round-tripping](/core/saving) - serialize back to `.pptx`.
- [Markdown Converter](/core/converter) and [SVG Export](/core/svg-export).
- [Encryption](/core/encryption) and the [Geometry Engine](/core/geometry).
- [CLI](/core/cli) - the `pptx` command-line tool.
