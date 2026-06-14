---
title: Architecture
description: The layered architecture of pptx-viewer — React package, core engine, low-level converters, the mixin-composition runtime, and the load/save pipelines.
---

# Architecture

`pptx-viewer` is organized as a layered stack. The React package renders and edits; the core engine parses, mutates, and serializes; and two low-level packages handle binary metafile and font formats. Each layer depends only on the layer below it.

## High-level architecture

```
+-------------------------------------------------------------------+
|                     React Package (pptx-viewer)                    |
|                                                                    |
|  +----------------+  +--------------+  +------------------------+  |
|  | PowerPoint     |  | SlideCanvas  |  |   Inspector/Toolbar    |  |
|  |   Viewer       |--|  + Elements  |  |   + Dialogs            |  |
|  | (orchestrator) |  |  Rendering   |  |   (editing UI)         |  |
|  +-------+--------+  +--------------+  +------------------------+  |
|          |                                                         |
|  +-------+-----------------------------------------------------+  |
|  |              Hooks Layer (67+ custom hooks)                  |  |
|  |  State, editing, loading, interaction, presentation,        |  |
|  |  export, collaboration, comments, find/replace, ...         |  |
|  +-------------------------------------------------------------+  |
+---------------------------+---------------------------------------+
                            | imports
+---------------------------+---------------------------------------+
|                   Core Package (pptx-viewer-core)                 |
|                                                                   |
|  +----------------+  +------------------+  +-------------------+  |
|  | PptxHandler    |  |   Converter      |  |    Services       |  |
|  | (public API)   |  | (PPTX -> MD)     |  | (animation,       |  |
|  +-------+--------+  +------------------+  |  loader, crypto)  |  |
|          |                                 +-------------------+  |
|  +-------+-------------------------------+                        |
|  |              Runtime Layer            |                        |
|  |  PptxHandlerRuntime -- 50+ mixin      |                        |
|  |  modules for parsing, serializing,    |                        |
|  |  theme resolution, element processing |                        |
|  +-------+-------------------------------+                        |
|          |                                                        |
|  +-------+----------------------------------------------------+  |
|  |  +---------+  +----------+  +---------+  +----------+       |  |
|  |  |  Types  |  | Geometry |  |  Color  |  | Builders |       |  |
|  |  | System  |  |  Engine  |  |  Engine |  | (SDK)    |       |  |
|  |  +---------+  +----------+  +---------+  +----------+       |  |
|  +------------------------------------------------------------+  |
+---------------------------+---------------------------------------+
                            | imports
+---------------------------+---------------------------------------+
|          EMF Converter Package (emf-converter)                    |
|  Binary EMF/WMF parsing -> GDI record replay -> Canvas -> PNG     |
+------------------------------------------------------------------+
+------------------------------------------------------------------+
|       MTX Decompressor Package (mtx-decompressor)                |
|  EOT/MTX compressed fonts -> LZ decompression -> CTF -> TrueType |
+------------------------------------------------------------------+
```

- **React package** — purely presentational components driven by 67+ custom hooks. `PowerPointViewer` is the forwardRef orchestrator. Slides render as scaled HTML/SVG using CSS transforms rather than Canvas.
- **Core package** — the framework-agnostic engine. The `PptxHandler` facade is the public entry point; everything else (runtime, converter, services, types, geometry, colour, builders) sits beneath it.
- **emf-converter / mtx-decompressor** — pure binary-format workers invoked by the core engine to rasterize EMF/WMF metafiles and decompress embedded MicroType Express fonts.

## Mixin-composition runtime

The heart of the core engine is `PptxHandlerRuntime`, assembled from **50+ focused mixin modules**. Each module (`PptxHandlerRuntime*.ts`) adds one concern — XML parsing, theme resolution, a specific element type's parsing, serialization, save-pipeline steps, and so on.

The public surface narrows progressively:

```
PptxHandler            (public facade — the class you instantiate)
  └── PptxHandlerCore  (facade over the runtime)
        └── PptxHandlerRuntime
              ↑ composed from 50+ mixins:
              · load pipeline      · save pipeline
              · theme resolution   · per-element parsing
              · per-element saving  · media/chart/SmartArt extraction
              · …
```

This keeps each concern isolated and individually testable. New capabilities — including new element types — are added as new mixins rather than by growing a monolithic class. See [Adding a new element type](/guide/data-model) for the end-to-end checklist.

## Load pipeline

`handler.load(buffer)` turns a raw `ArrayBuffer` into the structured [`PptxData`](/guide/data-model) model:

```
ArrayBuffer
   │  detectFileFormat() — and decrypt if password-protected
   ▼
JSZip.loadAsync()                 (ZIP opened in memory)
   │
   ▼
Parse [Content_Types].xml + ppt/presentation.xml
   │
   ▼
fast-xml-parser  (XML → JS object trees)
   │
   ▼
Resolve themes → slide masters → layouts
   │
   ▼
Parse each slide's elements (text, shapes, images, tables, charts, …)
   │
   ▼
PptxData  { slides, theme, masters, metadata, … }
```

Strict (ISO/IEC 29500) files are normalized to Transitional (ECMA-376) namespaces on load and converted back on save, so most files round-trip losslessly.

## Save pipeline

`handler.save(slides)` reverses the process, producing a valid `.pptx` archive:

```
PptxSlide[]
   │  serialize each element to OpenXML (per-type save writers)
   ▼
Rebuild relationships (.rels) + [Content_Types].xml
   │
   ▼
JSZip.generateAsync()
   ▼
Uint8Array  (a valid .pptx file)
```

## Key design decisions

| Decision                              | Rationale                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **CSS-based rendering** (not Canvas)  | Sharp text at any zoom, native accessibility, DOM interactivity, and standard CSS styling.                    |
| **Mixin composition** for the runtime | 50+ focused modules keep each concern isolated and testable; new capabilities are added as new mixins.        |
| **Discriminated union** for elements  | TypeScript narrows to the correct element type via the `type` field — no casting needed.                      |
| **EMU units** internally              | PowerPoint uses English Metric Units (1 inch = 914,400 EMU). Conversion constants live in `constants.ts`.     |
| **Theme resolution chain**            | Element → Placeholder → Layout → Master → Theme mirrors PowerPoint's own style inheritance.                   |
| **Deferred image processing**         | EMF/WMF record replay is synchronous for performance; bitmap draws are collected and resolved asynchronously. |

## Related reading

- [Core Concepts](/guide/concepts) — EMU units, the element model, and theme resolution in depth.
- [The PptxData Model](/guide/data-model) — the full shape of a parsed presentation.
- [Core package overview](/core/) — the public API reference.
