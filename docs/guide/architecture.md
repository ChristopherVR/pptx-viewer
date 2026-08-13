---
title: Architecture
description: How pptx-viewer is structured - the load and save pipelines, the mixin-composed runtime, theme resolution, the geometry engine, and the shared rendering layer that feeds every framework binding.
---

# Architecture

`pptx-viewer` is a layered system. Framework bindings (React, Vue 3, Angular, Svelte, and a plain-DOM vanilla JS binding) handle the UI; a shared rendering layer provides framework-agnostic logic; and the core engine handles everything related to parsing, editing, and saving PowerPoint files. Each layer depends only on the one below it.

## Overview

```
+---------------------------------------------------------------+
|                      Framework bindings                       |
|   React    |   Vue 3   |  Angular  |  Svelte 5  |  Vanilla JS |
| pptx-react | pptx-vue  | pptx-ang. | pptx-svelte| pptx-vanilla|
+------------------------------+--------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|            Shared rendering layer (pptx-viewer-shared)        |
|     geometry, styles, gradients, charts, connectors, text     |
+------------------------------+--------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|                Core engine (pptx-viewer-core)                 |
|  PptxHandler (public API)                                     |
|    -> Runtime (parsing, serialization, theme resolution)      |
|         -> Types, Geometry, Colour, Builders, Converter       |
+---------------------------------------------------------------+
```

## Framework bindings

The binding packages are thin presentation layers. They consume pre-computed rendering data from `pptx-viewer-shared` and translate it into framework-specific templates (JSX, Vue SFCs, Angular components, Svelte 5 runes, or plain DOM calls for the vanilla binding). Slides render as scaled HTML/SVG with CSS transforms, giving sharp text at any zoom, native accessibility, and full DOM interactivity.

Each binding exposes a top-level viewer/editor entry point that orchestrates state, editing, loading, export, and presentation mode through the idiom native to its framework: hooks in React, composables in Vue, services in Angular, runes in Svelte, and a plain factory function plus imperative instance API in vanilla JS. Because they all consume the same shared layer, the rendering output is identical across all five.

## Shared rendering layer (`pptx-viewer-shared`)

Most viewer logic is not framework-specific, and all of it lives in `packages/shared/src/`. The `render/` directory alone holds roughly 250 focused modules, including:

- **Connector routing**: an A* router over an obstacle graph (`connector-router-astar.ts`, `connector-router-graph.ts`) plus path building and rerouting.
- **Chart mathematics**: axis ranges, category positioning, cartesian/polar plot builders, box-whisker statistics, combo/stock composition (the `chart-*` module family).
- **Animation and morph engines**: timeline building and playback (`animation-timeline-*.ts`), plus morph transition matching and geometry interpolation (`morph-matching.ts`, `morph-geometry-interp.ts`, `morph-text.ts`).
- **Text and style resolution**: bullet numbering, fill/gradient styling, image effect filters, kinsoku line-breaking styles.
- **Math**: OMML to MathML and LaTeX to OMML converters (`omml-to-mathml.ts`, `latex-to-omml.ts`).
- **Editor behaviour**: history, clipboard, alignment guides, format painter, find and replace, collaboration sync and presence.

Sibling directories cover `export/`, `i18n/`, `loader/`, `theme/`, and the opt-in `smartart-3d/` renderer.

::: info An internal package
`pptx-viewer-shared` is private and never published to npm. Its source is bundled (or vendored, for Angular) into each binding at build time. This guarantees feature parity across React, Vue, Angular, Svelte, and vanilla JS without duplicating logic, while keeping the public install surface to one package per framework.
:::

## Core engine (`pptx-viewer-core`)

The core package is entirely framework-agnostic. It runs in any JavaScript environment: browser, Node.js, Web Worker, or serverless function. Its public entry point is `PptxHandler`.

### The facade and the mixin-composed runtime

The engine is built as three layers of decreasing surface area:

```
PptxHandler                    static factories (create / createBlank)
  └─ PptxHandlerCore           thin facade: load / save / export / encryption
       └─ IPptxHandlerRuntime  the actual engine, assembled from ~98 mixin modules
```

- **`PptxHandler`** (`packages/core/src/core/PptxHandler.ts`) adds the static `create()` / `createBlank()` builder entry points.
- **`PptxHandlerCore`** delegates all heavy parsing, serialization, and XML manipulation to an injected `IPptxHandlerRuntime`. The runtime is replaceable via constructor dependencies (`runtime` or `runtimeFactory`), which is how tests and alternate hosts swap implementations.
- **`PptxHandlerRuntime`** is not one class in one file. It is composed from roughly **98 focused modules** in `packages/core/src/core/core/runtime/`, each named `PptxHandlerRuntime<Concern>.ts` and each handling exactly one concern: `PptxHandlerRuntimeChartParsing.ts`, `PptxHandlerRuntimeThemeLoading.ts`, `PptxHandlerRuntimeSaveElementWriter.ts`, `PptxHandlerRuntimeSmartArtParsing.ts`, and so on.

Each module declares a class that extends the class exported by the previous module, forming a linear inheritance chain that layers capability on capability:

```ts
// PptxHandlerRuntimeLoadPipeline.ts
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLoadSession';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	// adds the load-pipeline capability on top of everything below it
}
```

New engine capabilities (including new element types) are added as new links in this chain rather than by growing existing files. Cross-cutting collaborators (compatibility warnings, XML factories, content-type builders) are defined behind `I*` service interfaces and injected through a dependency factory, keeping each mixin testable in isolation.

### The load pipeline

`handler.load(arrayBuffer)` walks these stages:

```
ArrayBuffer
  │  container sniff: an OLE compound file is either a legacy binary
  │  .ppt (converted to an in-memory .pptx package) or an encrypted
  │  OOXML package (decrypted with the supplied password)
  │  ZIP signature check on whatever comes out
  ▼
JSZip.loadAsync                 in-memory archive
  │  zip-bomb guard: 500 MiB uncompressed budget (configurable),
  │  hard cap of 65,536 entries
  ▼
fast-xml-parser                 XML parts -> JS object trees
  │  Strict OOXML detection: strict namespace URIs are transparently
  │  normalized to Transitional for all subsequent parses
  ▼
Theme / master / layout resolution
  │  colour maps, font schemes, format schemes, placeholder styles
  ▼
Per-slide shape-tree (spTree) parsing
  │  each <p:sp>, <p:pic>, <p:graphicFrame>, ... becomes a typed PptxElement
  ▼
PptxLoadDataBuilder             assembles the final model
  ▼
PptxData
```

1. **Container checks first.** An OLE compound file is not necessarily an error: it is how both a legacy binary `.ppt` and an encrypted OOXML package arrive. A PowerPoint 97-2003 presentation (recognised by its `PowerPoint Document` stream) is converted to an equivalent in-memory `.pptx` package by `core/ppt/` and loaded from there, so the rest of the pipeline never learns the deck was binary. Otherwise the container is treated as encrypted and raises `EncryptedFileError` unless a password is supplied for decryption; a password-protected `.ppt` raises `EncryptedPptError`, because legacy RC4 encryption is not decrypted. Input that is neither a ZIP nor an OLE compound file is rejected with a clear error. Oversized archives throw `ZipBombError` before any parsing happens.
2. **XML parsing** uses `fast-xml-parser`; every part becomes a plain object tree (the `XmlObject` type) with `@_`-prefixed attributes.
3. **Theme resolution** loads each master's theme, colour map (`p:clrMap`), font scheme, and format scheme so that slide parsing can resolve scheme colours and style references (see below).
4. **Element parsing** turns each slide's shape tree into the [`PptxElement` discriminated union](/guide/data-model#the-pptxelement-union), converting EMU coordinates to pixels and preserving raw XML for constructs the typed model does not cover.
5. **`PptxLoadDataBuilder`** assembles everything else: sections, custom shows, embedded fonts, notes and handout masters, tags, comment authors, document properties, the thumbnail, and compatibility warnings.

### The save pipeline

`handler.save(slides, options?)` reverses the process (`PptxHandlerRuntimeSavePipeline.ts`):

```
PptxSlide[]
  │  resolve conformance class ('preserve' | 'strict' | 'transitional')
  ▼
Reconcile presentation slide list      order, additions, deletions, rels
  ▼
Serialize each slide to OpenXML        elements -> <p:spTree>, embed new media
  ▼
Rebuild [Content_Types].xml            slide overrides + media defaults
  ▼
Comments, masters, layouts             typed mutations applied; untouched
  │                                    parts pass through verbatim
  ▼
Optional Strict conversion             remap namespaces if target is strict
  ▼
JSZip -> Uint8Array                    a valid .pptx / .ppsx / .pptm
```

Two properties of this pipeline matter for fidelity:

- **Passthrough by default.** Parts you did not edit (masters, layouts, notes, unknown extensions, vendor markup) are carried through from the original archive byte-for-byte or re-emitted from their preserved parse trees. Saving is a targeted rewrite, not a full regeneration.
- **Conformance-aware output.** The saved package matches the loaded file's OOXML conformance class by default, and can be forced to Strict or Transitional. See [OpenXML conformance](/architecture/openxml-conformance) for exactly what gets remapped.

### Theme resolution chain

PowerPoint styles resolve through an inheritance chain, and the engine mirrors it exactly:

```
Element  ->  Placeholder  ->  Layout  ->  Master  ->  Theme
```

- An element's explicit properties always win.
- A placeholder element (a title, body, footer, ...) inherits text and position defaults from the matching placeholder on its **layout**, which in turn inherits from the **master** (`p:txStyles` for title/body/other text defaults).
- Style references (`a:fillRef`, `a:lnRef`, `a:effectRef`, `a:fontRef`) resolve by index into the **theme's** format scheme, with the reference's colour substituted for the theme placeholder colour.
- Scheme colours (`accent1`, `bg1`, `tx1`, ...) resolve through the master's `p:clrMap` (and any layout `p:clrMapOvr`) into the theme's colour scheme.

The chain is implemented by dedicated runtime mixins: `PptxHandlerRuntimeThemeLoading`, `...ThemeProcessing`, `...ThemeFormatScheme`, `...ThemeRefResolution`, `...ThemeOverrides`, and the placeholder trio `...PlaceholderLookup`, `...PlaceholderDefaults`, `...PlaceholderStyles`. Multiple masters are supported, each with its own colour map and format scheme.

### Geometry engine

`packages/core/src/core/geometry/` (42 modules) turns DrawingML geometry into renderable paths:

- **Preset shapes**: definitions for the ECMA-376 preset shape catalogue, grouped by family (`preset-shape-definitions-arrows.ts`, `-flowchart.ts`, `-action-buttons.ts`, `-callouts`, ...), each expressed with the spec's guide formulas.
- **Guide formula evaluation** (`guide-formula-eval.ts` and friends): implements the ECMA-376 formula language (`*/`, `+-`, `pin`, `at2`, `cos`, ...) so shape geometry responds correctly to adjustment values, the yellow diamond handles you can drag in PowerPoint.
- **Custom geometry** (`custom-geometry-parser.ts`, `freeform-builder.ts`): parses `a:custGeom` path commands and builds freeform shapes.
- **Clip paths** (`preset-clip-paths-core.ts`, `-extended.ts`): produce CSS/SVG clip paths so HTML content (images, text) can be clipped to any preset shape.
- **Connector geometry** (`connector-geometry.ts`): bent and curved connector shapes, arrowheads, and flip handling. (Live connector **routing** around obstacles lives in the shared layer's A* router.)

### Converter

`packages/core/src/converter/` implements PPTX to Markdown conversion with a registry pattern: each element type has a processor (`shape-element-processor`, `table-element-processor`, `ole-element-processor`, ...) registered against its `type` discriminant, and `PptxMarkdownConverter` dispatches per element. The same directory houses the SVG exporter and the OMML to LaTeX converter used for equations.

## Key design decisions

| Decision                             | Rationale                                                                                                                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSS-based rendering** (not Canvas) | Sharp text at any zoom, native accessibility, DOM interactivity, and standard CSS styling.                                                                                                                                          |
| **Mixin-composed engine**            | ~98 small, single-concern runtime modules keep each capability isolated and testable. New capabilities (including new element types) are added as new mixins, not bigger files.                                                     |
| **Discriminated union for elements** | TypeScript narrows to the correct element type via the `type` field, giving full type safety with no casting.                                                                                                                       |
| **Theme resolution chain**           | Element, Placeholder, Layout, Master, Theme mirrors PowerPoint's own style inheritance.                                                                                                                                             |
| **EMU units internally**             | PowerPoint uses English Metric Units (914,400 EMU per inch; 9,525 EMU per pixel at 96 DPI). Parsed elements expose pixel values for convenient layout math; exact EMU values are preserved where round-trip fidelity requires them. |
| **Passthrough saving**               | Only edited parts are rewritten; everything else round-trips verbatim, so unknown markup and vendor extensions survive.                                                                                                             |
| **Shared logic, thin bindings**      | All framework-agnostic viewer logic lives once in `pptx-viewer-shared`; bindings are view layers only, which keeps the five frameworks at parity.                                                                                   |

## Related reading

- [The PptxData Model](/guide/data-model) - the full shape of a parsed presentation, element types, and units.
- [OpenXML conformance](/architecture/openxml-conformance) - Strict vs Transitional handling and the conformance contract.
- [Core package overview](/core/) - the public API reference.
