---
title: What is pptx-viewer?
description: A high-level overview of the pptx-viewer TypeScript monorepo for parsing, editing, rendering, and converting PowerPoint files across React, Vue 3, Angular, Svelte 5, and vanilla JavaScript.
---

# What is pptx-viewer?

`pptx-viewer` is a comprehensive TypeScript monorepo for **parsing, editing, rendering, and converting** Microsoft PowerPoint (`.pptx`) files - in the browser and in Node.js. It works entirely in-memory on the OpenXML ZIP archive with no native dependencies.

Where most PowerPoint libraries do one thing - generate slides _or_ render them _or_ extract text - `pptx-viewer` covers the full round-trip: load an existing deck, mutate its structured data model, render it with full visual fidelity, and save it back to a valid `.pptx` file. The same core engine powers drop-in components for **React**, **Vue 3**, **Angular**, and **Svelte 5**, plus a **vanilla JavaScript** build for projects with no framework at all.

## What it does

The SDK provides nine core capabilities:

1. **Parse** `.pptx` files from a raw `ArrayBuffer` into a structured [`PptxData`](/guide/data-model) model.
2. **Create** presentations from scratch with a fluent builder API.
3. **Render** slides as interactive React, Vue, Angular, Svelte, or vanilla JS components with full visual fidelity.
4. **Edit** presentations programmatically or via the built-in WYSIWYG editor.
5. **Save** changes back to a valid `.pptx` file (round-trip safe).
6. **Convert** presentations to Markdown with optional media extraction.
7. **Export** slides as images (PNG/JPEG), SVG, PDF, GIF, or video.
8. **Collaborate** in real time via Yjs CRDT with presence tracking.
9. **Encrypt/Decrypt** password-protected PPTX files (AES-128/256).

The engine handles the full OpenXML specification including 16 element types, 187+ preset shapes, 23 chart types, SmartArt, 3D models, animations, transitions (including morph), themes, slide masters, embedded media, EMF/WMF metafiles, OLE objects, digital ink, digital signatures, encryption, VBA macro preservation, and OOXML Strict conformance.

## Who is it for

- **Product teams embedding a document viewer**: show user-uploaded decks inside a web app without shipping files to a conversion service.
- **Teams building an editor**: the bindings include a full WYSIWYG editing surface (ribbon, inspector, undo/redo, collaboration) you can enable per feature.
- **Backend and automation work**: the core package is framework-agnostic and runs in Node.js, so you can generate, inspect, diff, or convert decks in scripts, servers, and CI.
- **AI and agent pipelines**: `pptx-viewer-mcp` exposes the engine as MCP tool calls, and the Markdown converter turns decks into LLM-friendly text.

## What makes the rendering different

Most PPTX renderers rasterize slides - either server-side (convert to images or PDF first) or client-side onto a `<canvas>`. `pptx-viewer` does neither. Slides render as **real HTML, CSS, and SVG in the DOM**:

- Text is real HTML text: selectable, searchable, translatable, and readable by screen readers.
- Shapes and connectors are SVG with computed clip paths from the geometry engine.
- Tables are HTML `<table>` elements; charts are inline SVG built from the parsed chart data.
- Zooming is a CSS transform, so slides stay sharp at any scale on any display density.
- Because every element is a DOM node, the editor gets selection, drag handles, inline text editing, and accessibility for free.

Rasterization only happens when you ask for it: raster export (PNG/JPEG/PDF/GIF/video) draws the DOM through `html2canvas`.

::: tip Tradeoffs
CSS cannot express every PowerPoint effect pixel-perfectly (for example some blend modes and 3D rotations are approximated). See [Limitations](/guide/limitations) for the honest list.
:::

## The packages

The monorepo ships eight published packages.

| Package                          | npm name                     | Purpose                                                                                                    |
| -------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [**Core**](/core/)               | `pptx-viewer-core`           | Parse, create, edit, serialize, and convert PPTX files. Framework-agnostic.                                |
| [**React**](/react/)             | `pptx-react-viewer`          | React viewer, editor, and presenter with toolbar, inspector, collaboration, and export.                    |
| [**Vue 3**](/vue/)               | `pptx-vue-viewer`            | Vue 3 viewer/editor built on the same engine, with the same feature set.                                   |
| [**Angular**](/angular/)         | `pptx-angular-viewer`        | Angular viewer/editor built on the same engine, with the same feature set.                                 |
| [**Vanilla JS**](/vanilla/)      | `pptx-vanilla-viewer`        | Zero-framework binding built on the same engine: plain DOM, one factory function, no framework dependency. |
| [**Svelte**](/svelte/)           | `pptx-svelte-viewer`         | Svelte 5 component built on the same engine, with the same feature set.                                    |
| [**Tools / MCP**](/packages/mcp) | `pptx-viewer-mcp`            | 50+ PPTX tool functions, an MCP server for AI agents, and the Y.Doc collaboration codec.                   |
| **Installer**                    | `@christophervr/pptx-viewer` | Interactive CLI that scaffolds the right viewer package into your project.                                 |

### How the pieces fit

All five UI binding packages build on a shared rendering layer, which in turn builds on Core:

```
pptx-react-viewer   ┐
pptx-vue-viewer     │
pptx-angular-viewer ├── pptx-viewer-shared ── pptx-viewer-core
pptx-vanilla-viewer │                               ├── emf-converter
pptx-svelte-viewer  ┘                               └── mtx-decompressor
```

- **`pptx-viewer-core`** owns everything about the file format: the load and save pipelines, the typed data model, theme resolution, the geometry engine, encryption, and the Markdown/SVG converters. It has no UI and runs anywhere JavaScript runs.
- **`pptx-viewer-shared`** holds the framework-agnostic viewer logic: style and gradient resolution, chart and axis maths, connector routing, animation and morph engines, export preparation. It is an **internal** package: private, never published to npm, and bundled into each binding at build time. You never install it directly.
- **The bindings** are thin view layers. Each translates the same shared render data into its framework's idiom (JSX, SFC templates, Angular templates, Svelte runes, or plain DOM), which is why the five bindings render identically and stay at feature parity.
- **`emf-converter`** (EMF/WMF metafile to PNG) and **`mtx-decompressor`** (MicroType Express embedded fonts) are standalone npm dependencies of Core.
- **`pptx-viewer-mcp`** builds on `pptx-viewer-core` to expose tool-call and collaboration surfaces for AI agents.

## A quick taste

::: code-group

```ts [Load, edit, save]
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(arrayBuffer);

// data.slides is a typed, mutable model
data.slides[0].elements.filter((el) => el.type === 'text').forEach((el) => console.log(el.text));

const bytes = await handler.save(data.slides); // => Uint8Array (.pptx)
```

```ts [Create from scratch]
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Q4 Report',
	theme: { colors: { accent1: '#FF6B6B' } },
});

data.slides.push(createSlide('Blank').addText('Hello', { fontSize: 36 }).build());

const bytes = await handler.save(data.slides);
```

:::

## Next steps

- [Installation](/guide/installation) - install the packages and set up local development.
- [Quick Start](/guide/quick-start) - end-to-end flows to get productive fast.
- [Architecture](/guide/architecture) - how the load/save pipelines and the layered design work.
- [The PptxData Model](/guide/data-model) - the typed model you edit.
- [Core package overview](/core/) - the parsing, editing, and serialization engine.
- [React package overview](/react/) - the viewer/editor component.
- [Limitations](/guide/limitations) - important caveats to read before adopting.
