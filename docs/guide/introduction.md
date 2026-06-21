---
title: What is pptx-viewer?
description: A high-level overview of the pptx-viewer TypeScript monorepo for parsing, editing, rendering, and converting PowerPoint files across React, Vue 3, and Angular.
---

# What is pptx-viewer?

`pptx-viewer` is a comprehensive TypeScript monorepo for **parsing, editing, rendering, and converting** Microsoft PowerPoint (`.pptx`) files - in the browser and in Node.js. It works entirely in-memory on the OpenXML ZIP archive with no native dependencies.

Where most PowerPoint libraries do one thing - generate slides _or_ render them _or_ extract text - `pptx-viewer` covers the full round-trip: load an existing deck, mutate its structured data model, render it with full visual fidelity, and save it back to a valid `.pptx` file. The same core engine powers drop-in viewer components for **React**, **Vue 3**, and **Angular**.

## What it does

The SDK provides nine core capabilities:

1. **Parse** `.pptx` files from a raw `ArrayBuffer` into a structured [`PptxData`](/guide/data-model) model.
2. **Create** presentations from scratch with a fluent builder API.
3. **Render** slides as interactive React, Vue, or Angular components with full visual fidelity.
4. **Edit** presentations programmatically or via the built-in WYSIWYG editor.
5. **Save** changes back to a valid `.pptx` file (round-trip safe).
6. **Convert** presentations to Markdown with optional media extraction.
7. **Export** slides as images (PNG/JPEG), SVG, PDF, GIF, or video.
8. **Collaborate** in real time via Yjs CRDT with presence tracking.
9. **Encrypt/Decrypt** password-protected PPTX files (AES-128/256).

The engine handles the full OpenXML specification including 16 element types, 187+ preset shapes, 23 chart types, SmartArt, 3D models, animations, transitions (including morph), themes, slide masters, embedded media, EMF/WMF metafiles, OLE objects, digital ink, digital signatures, encryption, VBA macro preservation, and OOXML Strict conformance.

## The packages

The monorepo ships five published packages.

| Package         | npm name              | Purpose                                                                                       |
| --------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| **Core**        | `pptx-viewer-core`    | Parse, create, edit, serialize, and convert PPTX files. Framework-agnostic.                   |
| **React**       | `pptx-react-viewer`   | React-based viewer, editor, and presenter with toolbar, inspector, collaboration, and export. |
| **Vue 3**       | `pptx-vue-viewer`     | Vue 3 viewer component (viewer-first; editor features being ported).                          |
| **Angular**     | `pptx-angular-viewer` | Angular viewer component (viewer-first; editor features being ported).                        |
| **Tools / MCP** | `pptx-viewer-mcp`     | 24 PPTX tool functions, an MCP server for AI agents, and the Y.Doc collaboration codec.       |

### Dependency graph

All three UI framework packages build on the shared layer, which in turn builds on Core:

```
pptx-react-viewer   ┐
pptx-vue-viewer     ├── pptx-viewer-shared ── pptx-viewer-core
pptx-angular-viewer ┘                               ├── emf-converter
                                                    └── mtx-decompressor
```

`pptx-viewer-mcp` builds on `pptx-viewer-core` to expose tool-call and collaboration surfaces for AI agents.

## Who it's for

- **React developers building viewer/editor UIs** - use [`pptx-react-viewer`](/react/). It wraps the core engine in a `PowerPointViewer` component that renders, edits, presents, and exports slides out of the box. This is the most complete binding.
- **Vue 3 developers** - use `pptx-vue-viewer`. The viewer component shares the same rendering engine as the React package. Editor and presenter features are being ported.
- **Angular developers** - use `pptx-angular-viewer`. Same story: same engine, viewer-first, editor features incoming.
- **Developers automating or embedding PowerPoint headlessly** - use [`pptx-viewer-core`](/core/). No UI, no framework dependency. Runs identically in a browser tab, a serverless function, a Node.js build script, or a Web Worker.
- **AI / LLM workflows** - use [`pptx-viewer-mcp`](/packages/mcp). The MCP server exposes all 24 tool functions to any MCP-compatible client (Claude Desktop, Cursor, VS Code Copilot). Or call the tool functions directly in your own pipeline.
- **End users of an embedding app** - interact with the rendered viewer chrome (toolbar, inspector, presenter mode). See the [User Guide](/user/).

## Feature parity across frameworks

| Feature                    | React | Vue 3 | Angular |
| -------------------------- | :---: | :---: | :-----: |
| Slide rendering            |  Yes  |  Yes  |   Yes   |
| Animations & transitions   |  Yes  |  Yes  |   Yes   |
| Text / shape editing       |  Yes  |       |         |
| Presenter mode             |  Yes  |       |         |
| Export (PNG/PDF/GIF/video) |  Yes  |       |         |
| Real-time collaboration    |  Yes  |       |         |
| Inspector panel            |  Yes  |       |         |
| Find & replace             |  Yes  |       |         |

Vue and Angular editor features are being ported incrementally. See each package's README for the current status.

## Next steps

- [Installation](/guide/installation) - install the packages and set up local development.
- [Quick Start](/guide/quick-start) - end-to-end flows to get productive fast.
- [Core package overview](/core/) - the parsing, editing, and serialization engine.
- [React package overview](/react/) - the viewer/editor component.
- [Limitations](/guide/limitations) - important caveats to read before adopting.
