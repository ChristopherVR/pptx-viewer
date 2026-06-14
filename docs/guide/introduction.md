---
title: What is pptx-viewer?
description: A high-level overview of the pptx-viewer TypeScript monorepo for parsing, editing, rendering, and converting PowerPoint files.
---

# What is pptx-viewer?

`pptx-viewer` is a comprehensive TypeScript monorepo for **parsing, editing, rendering, and converting** Microsoft PowerPoint (`.pptx`) files — in the browser and in Node.js. It works entirely in-memory on the OpenXML ZIP archive with no native dependencies.

Where most PowerPoint libraries do one thing — generate slides _or_ render them _or_ extract text — `pptx-viewer` covers the full round-trip: load an existing deck, mutate its structured data model, render it with full visual fidelity, and save it back to a valid `.pptx` file.

## What it does

The SDK provides nine core capabilities:

1. **Parse** `.pptx` files from a raw `ArrayBuffer` into a structured [`PptxData`](/guide/data-model) model.
2. **Create** presentations from scratch with a fluent builder API.
3. **Render** slides as interactive React components with full visual fidelity.
4. **Edit** presentations programmatically or via the built-in WYSIWYG editor.
5. **Save** changes back to a valid `.pptx` file (round-trip safe).
6. **Convert** presentations to Markdown with optional media extraction.
7. **Export** slides as images (PNG/JPEG), SVG, PDF, GIF, or video.
8. **Collaborate** in real time via Yjs CRDT with presence tracking.
9. **Encrypt/Decrypt** password-protected PPTX files (AES-128/256).

The engine handles the full OpenXML specification including 16 element types, 187+ preset shapes, 23 chart types, SmartArt, 3D models, animations, transitions (including morph), themes, slide masters, embedded media, EMF/WMF metafiles, OLE objects, digital ink, digital signatures, encryption, VBA macro preservation, and OOXML Strict conformance.

## The packages

The monorepo ships five published packages, each with a single responsibility.

| Package              | npm name           | Purpose                                                                                       |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| **Core**             | `pptx-viewer-core` | Parse, create, edit, serialize, and convert PPTX files. Framework-agnostic.                   |
| **React**            | `pptx-viewer`      | React-based viewer, editor, and presenter with toolbar, inspector, collaboration, and export. |
| **EMF converter**    | `emf-converter`    | Convert EMF/WMF metafile binaries to PNG data URLs using Canvas 2D.                           |
| **MTX decompressor** | `mtx-decompressor` | Decompress MicroType Express (MTX) fonts from EOT containers into TrueType.                   |
| **Tools / MCP**      | `pptx-viewer-mcp`  | PPTX manipulation tools, an MCP server for AI agents, and the collaboration codec.            |

### Dependency graph

The React package builds on Core, which in turn delegates binary-format work to the two low-level converters:

```
pptx-viewer (React)
  └── pptx-viewer-core
        ├── emf-converter
        └── mtx-decompressor
```

`pptx-viewer-mcp` builds on `pptx-viewer-core` to expose tool-call and collaboration surfaces for AI agents.

## Who it's for

- **Developers embedding or automating PowerPoint** — reach for [`pptx-viewer-core`](/core/). It has no UI and no framework dependency, so it runs the same in a browser tab, a serverless function, or a build script. Parse decks, transform their data, generate new ones, or convert them to Markdown.
- **Developers building viewer/editor UIs** — reach for [`pptx-viewer`](/react/). It wraps the core engine in a React component (`PowerPointViewer`) that renders, edits, presents, and exports slides out of the box.
- **End users of an embedding app** — interact with the rendered viewer chrome (toolbar, inspector, presenter mode). See the [User Guide](/user/).

## Next steps

- [Installation](/guide/installation) — install the packages and set up local development.
- [Quick Start](/guide/quick-start) — four end-to-end flows to get productive fast.
- [Core package overview](/core/) — the parsing, editing, and serialization engine.
- [React package overview](/react/) — the viewer/editor component.
