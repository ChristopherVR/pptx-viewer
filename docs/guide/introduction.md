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
| [**Tools / MCP**](/packages/mcp) | `pptx-viewer-mcp`            | 25 PPTX tool functions, an MCP server for AI agents, and the Y.Doc collaboration codec.                    |
| **Installer**                    | `@christophervr/pptx-viewer` | Interactive CLI that scaffolds the right viewer package into your project.                                 |

### Dependency graph

All five UI binding packages build on the shared layer, which in turn builds on Core:

```
pptx-react-viewer   ┐
pptx-vue-viewer     │
pptx-angular-viewer ├── pptx-viewer-shared ── pptx-viewer-core
pptx-vanilla-viewer │                               ├── emf-converter
pptx-svelte-viewer  ┘                               └── mtx-decompressor
```

`pptx-viewer-mcp` builds on `pptx-viewer-core` to expose tool-call and collaboration surfaces for AI agents.

## Next steps

- [Installation](/guide/installation) - install the packages and set up local development.
- [Quick Start](/guide/quick-start) - end-to-end flows to get productive fast.
- [Core package overview](/core/) - the parsing, editing, and serialization engine.
- [React package overview](/react/) - the viewer/editor component.
- [Limitations](/guide/limitations) - important caveats to read before adopting.
