# pptx-viewer

A comprehensive TypeScript monorepo for parsing, editing, rendering, and converting Microsoft PowerPoint (`.pptx`) files in the browser and Node.js.

**Note: I'm developing this with Claude Code using Opus 4.6**

## Table of Contents

- [Overview](#overview)
- [Packages](#packages)
- [Limitations](#limitations)
- [Getting Started](#getting-started)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development](#development)
- [License](#license)

---

## Overview

`pptx-viewer` is a monorepo containing four packages that together provide a full-featured PowerPoint SDK:

1. **Parse** `.pptx` files from raw `ArrayBuffer` into a structured `PptxData` model
2. **Create** presentations from scratch with a fluent builder API
3. **Render** slides as interactive React components with full visual fidelity
4. **Edit** presentations programmatically or via the built-in WYSIWYG editor
5. **Save** changes back to a valid `.pptx` file (round-trip safe)
6. **Convert** presentations to Markdown with optional media extraction
7. **Export** slides as images (PNG/JPEG), SVG, PDF, GIF, or video
8. **Collaborate** in real-time via Yjs CRDT with presence tracking
9. **Encrypt/Decrypt** password-protected PPTX files (AES-128/256)

The codebase handles the full OpenXML specification including 16 element types, 187+ preset shapes, 23 chart types, SmartArt (13 layouts), 3D models, animations (40+ presets), transitions (42 types including morph), themes, slide masters, embedded media, EMF/WMF metafiles, OLE objects, digital ink with pressure sensitivity, digital signatures, PPTX encryption, VBA macro preservation, OOXML Strict conformance, and more.

**Test coverage:** 11,900+ passing tests across 419 test files.

## Packages

```
packages/
  core/              pptx-viewer-core     – Parse, create, edit, serialize PPTX files (framework-agnostic)
  react/             pptx-viewer          – React-based viewer/editor component
  emf-converter/     emf-converter        – EMF/WMF metafile to PNG converter
  mtx-decompressor/  mtx-decompressor     – MicroType Express font decompressor
```

| Package                                            | Description                                                                                              | README                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **[pptx-viewer-core](packages/core/)**             | Core PPTX engine -- parse, create, edit, serialize, and convert PowerPoint files. Framework-agnostic.    | [Documentation](packages/core/README.md)             |
| **[pptx-viewer](packages/react/)**                 | React-based PowerPoint viewer, editor, and presenter with toolbar, inspector, collaboration, and export. | [Documentation](packages/react/README.md)            |
| **[emf-converter](packages/emf-converter/)**       | Convert EMF/WMF metafile binaries to PNG data URLs using Canvas 2D. Handles EMF, EMF+, and WMF formats.  | [Documentation](packages/emf-converter/README.md)    |
| **[mtx-decompressor](packages/mtx-decompressor/)** | Decompress MicroType Express (MTX) compressed fonts from EOT containers into TrueType.                   | [Documentation](packages/mtx-decompressor/README.md) |

### Dependency Graph

```
pptx-viewer (React)
  └── pptx-viewer-core
        ├── emf-converter
        └── mtx-decompressor
```

---

## Limitations

> **Important:** Read this section before adopting the library to understand what is and isn't supported.

### Core Engine (`pptx-viewer-core`)

- **Embedded OLE objects are read-only** -- OLE objects (embedded Excel, Word, etc.) are recognised and their preview images are displayed, but their internal content cannot be edited. OLE2 is an opaque binary container format -- deserialising and re-serialising the internal object structure (e.g. an embedded Excel workbook) would require embedding the full application runtime.
- **SmartArt uses static shape decomposition** -- SmartArt diagrams are decomposed into individual positioned shapes using PowerPoint's own pre-computed drawing data (13 layout types). The shapes are fully editable, but there is no live SmartArt reflow engine -- moving or reordering shapes won't automatically recalculate the layout the way PowerPoint's built-in SmartArt engine does.
- **Chart editing is data-level only** -- You can add/remove series, edit data points, add/remove categories, and change chart type. However, structural chart properties (axis formatting, legend placement, data labels, trendlines, error bars) are parsed for display but not exposed for programmatic editing.
- **Strict OOXML conformance is normalised** -- Office 365 can save files in ISO/IEC 29500 Strict mode, which uses different namespace URIs than the more common Transitional (ECMA-376) format. The engine maps 46+ namespace URI pairs on load (Strict -> Transitional) and converts back on save. Features that rely on strict-only extensions outside these mapped namespaces may not round-trip.

### React Viewer (`pptx-viewer`)

- **CSS-based rendering** -- Slides are rendered as HTML/CSS rather than Canvas, which gives sharp text at any zoom, native accessibility, and DOM interactivity. The tradeoff is that some visual effects are approximated: `backdrop-filter` is replaced with semi-transparent backgrounds, `mix-blend-mode` is mapped to opacity fallbacks, and CSS 3D transforms (rotateX/Y) are flattened to 2D. Path gradients are approximated as elliptical radials.
- **Font availability** -- Text renders using fonts available in the browser. Missing fonts fall back to system defaults, which may affect text metrics and layout fidelity. Embedded fonts in the PPTX are deobfuscated and injected into the DOM when available.
- **Embedded media** -- Audio/video playback depends on browser codec support (e.g. browsers may not support WMV or legacy codecs). DRM-protected media will not play.
- **Animation triggers** -- 40+ animation presets are supported with `onClick`, `withPrevious`, `afterPrevious`, `afterDelay`, `onHover`, and `onShapeClick` triggers. Advanced OOXML timing tree conditions (compound triggers, multiple simultaneous conditions) are parsed but simplified for playback.
- **Morph transitions** -- Morph matches elements across slides using three strategies: explicit `!!` naming convention, element ID matching, and proximity matching (within 300px). Position, size, opacity, rotation, and colour are interpolated. Shape geometry morphing (interpolating between different shape types) and intelligent text token morphing are not implemented -- unmatched elements crossfade.
- **Chart interactivity** -- Charts are rendered as static SVG with hover tooltips. They are not directly editable via the chart surface -- use the inspector panel's chart data editor instead.
- **Print and export fidelity** -- Raster exports (PNG/JPEG/PDF) go through `html2canvas`, which does not support `backdrop-filter`, CSS custom properties (`var()`), or CSS 3D transforms. The library preprocesses CSS to approximate these, but some fidelity is lost. An SVG export path is available as a vector alternative.
- **Maximum export resolution** -- Canvas-based exports are constrained by the browser's maximum canvas size (typically 16384x16384 or 32768x32768 pixels depending on browser and GPU).
- **Mobile support** -- Touch interactions (drag, pinch-zoom) are supported but the toolbar, inspector panels, and dialogs are designed for desktop viewport sizes.
- **3D models** -- Rendering GLB/GLTF 3D models requires optional peer dependencies (`three`, `@react-three/fiber`, `@react-three/drei`). Without them, the element falls back to its poster image.

### EMF Converter (`emf-converter`)

- **Gradient brushes are simplified** -- GDI+ `LinearGradient` and `PathGradient` brush types extract only the primary colour rather than rendering full multi-stop gradient fills. The Canvas 2D API does not have a direct equivalent for GDI+ path gradients.
- **No raster operations (ROP)** -- `SetROP2` is acknowledged but GDI raster operation blending modes (XOR, NOT, AND, etc.) have no direct Canvas 2D equivalent and are not applied.
- **Limited clipping** -- `IntersectClipRect` and `SelectClipPath` are supported. Complex GDI region clipping (combining multiple regions with union/intersect/exclude operations) is not, as Canvas 2D only supports a single clip path.
- **Maximum canvas size** -- Output is clamped to 4096x4096 pixels to prevent excessive memory usage from malformed or very large metafiles.
- **Font rendering** -- Text is rendered using the browser's font engine with CSS font matching, so glyph metrics and kerning may differ from the original Windows GDI text rendering.
- **Canvas API required** -- The library needs either `OffscreenCanvas` (for Web Worker support) or `HTMLCanvasElement` to be available in the runtime environment. Pure Node.js without a canvas polyfill is not supported.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- Node.js 18+ (for TypeScript compilation)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd pptx-viewer

# Install dependencies
bun install

# Build all packages (order: emf-converter -> mtx-decompressor -> core -> react)
bun run build

# Run tests
bun run test

# Type-check
bun run typecheck
```

---

## Quick Start

### Create a Presentation from Scratch

```typescript
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'My Presentation',
	creator: 'Author Name',
	theme: {
		name: 'Custom Theme',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

// Build a slide with the fluent API
const slide = createSlide()
	.addText('Hello World', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.addImage('https://example.com/photo.jpg', { x: 450, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

// Save to .pptx
const output = await handler.save(data.slides);
await fs.writeFile('presentation.pptx', Buffer.from(output));
```

### Parse and Edit an Existing Presentation

```typescript
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const buffer = await fs.readFile('presentation.pptx');
const data = await handler.load(buffer.buffer);

console.log(`Loaded ${data.slides.length} slides`);
console.log(`Theme: ${data.theme?.name}`);

// Access slide content
for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Text: ${element.text}`);
		}
	}
}

// Modify and save
data.slides[0].elements[0].text = 'Updated Title';
const output = await handler.save(data.slides);
await fs.writeFile('output.pptx', Buffer.from(output));
```

### Convert to Markdown

```typescript
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('./output', {
	sourceName: 'presentation.pptx',
	includeSpeakerNotes: true,
	mediaFolderName: 'media',
	includeMetadata: true,
	semanticMode: true, // Clean markdown vs positioned HTML
});

const markdown = await converter.convert(data);
console.log(markdown);
```

### React Viewer Component

```tsx
import { PowerPointViewer } from 'pptx-viewer/viewer';

function App() {
	const [content, setContent] = useState<ArrayBuffer | null>(null);

	return (
		<PowerPointViewer
			content={content}
			canEdit={true}
			onContentChange={(newContent) => {
				// Called when the presentation is modified
			}}
			onDirtyChange={(isDirty) => {
				// Called when dirty state changes
			}}
		/>
	);
}
```

### EMF/WMF Conversion

```typescript
import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';

const emfBuffer: ArrayBuffer = /* read from PPTX media part */;
const pngDataUrl = await convertEmfToDataUrl(emfBuffer);
// => "data:image/png;base64,iVBORw0K..."
```

> For full API references, architecture deep dives, and advanced usage, see each package's README linked in the [Packages](#packages) table above.

---

## Architecture

### High-Level Architecture

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
|  |  State, editing, loading, interaction, presentation,          |  |
|  |  export, collaboration, comments, find/replace, ...           |  |
|  +--------------------------------------------------------------+  |
+---------------------------+----------------------------------------+
                            | imports
+---------------------------+----------------------------------------+
|                   Core Package (pptx-viewer-core)                  |
|                                                                    |
|  +----------------+  +------------------+  +--------------------+  |
|  | PptxHandler    |  |   Converter      |  |    Services         |  |
|  | (public API)   |  | (PPTX -> MD)     |  | (animation, loader, |  |
|  +-------+--------+  +------------------+  |  transitions,       |  |
|          |                                  |  crypto, etc.)      |  |
|  +-------+-------------------------------+ +--------------------+  |
|  |              Runtime Layer             |                        |
|  |  PptxHandlerRuntime -- 50+ mixin       |                        |
|  |  modules for parsing, serializing,     |                        |
|  |  theme resolution, element processing  |                        |
|  +-------+-------------------------------+                         |
|          |                                                         |
|  +-------+-----------------------------------------------------+  |
|  |  +---------+  +----------+  +---------+  +----------+        |  |
|  |  |  Types  |  | Geometry |  |  Color   |  | Builders |       |  |
|  |  | System  |  |  Engine  |  |  Engine  |  | (SDK)    |       |  |
|  |  +---------+  +----------+  +---------+  +----------+        |  |
|  +--------------------------------------------------------------+  |
+---------------------------+----------------------------------------+
                            | imports
+---------------------------+----------------------------------------+
|          EMF Converter Package (emf-converter)                     |
|  Binary EMF/WMF parsing -> GDI record replay -> Canvas -> PNG      |
+--------------------------------------------------------------------+
+--------------------------------------------------------------------+
|       MTX Decompressor Package (mtx-decompressor)                  |
|  EOT/MTX compressed fonts -> LZ decompression -> CTF -> TrueType   |
+--------------------------------------------------------------------+
```

### Key Design Decisions

| Decision                             | Rationale                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **CSS-based rendering** (not Canvas) | Sharp text at any zoom, native accessibility, DOM interactivity, and standard CSS styling                    |
| **Mixin composition** for runtime    | 50+ focused modules keep each concern isolated and testable; new capabilities added as new mixins            |
| **Discriminated union** for elements | TypeScript narrows to the correct element type via the `type` field -- no casting needed                     |
| **EMU units** internally             | PowerPoint uses English Metric Units (1 inch = 914,400 EMU). Conversion constants in `constants.ts`          |
| **Theme resolution chain**           | Element -> Placeholder -> Layout -> Master -> Theme mirrors PowerPoint's own style inheritance               |
| **Deferred image processing**        | EMF/WMF record replay is synchronous for performance; bitmap draws are collected and resolved asynchronously |

---

## Development

### Workspace Commands

```bash
bun install                  # Install all workspace dependencies
bun run build                # Build all packages (emf-converter -> mtx-decompressor -> core -> react)
bun run test                 # Run vitest across all packages
bun run typecheck            # Type-check all packages
bun run fmt                  # Format all files with oxfmt
bun run fmt:check            # Check formatting (CI-safe, no writes)
bun run lint                 # Lint with oxlint
bun run lint:fix             # Auto-fix lint issues
bun run demo                 # Start demo dev server (Vite, port 4173)
```

Build order matters: **emf-converter -> mtx-decompressor -> core -> react**

### Per-Package Commands

```bash
cd packages/core && bun run build     # Build a specific package
cd packages/core && bun run dev       # Watch mode
cd packages/core && bun run test      # Run package tests
cd packages/core && bun run typecheck # Type-check package
```

### Pack for npm Distribution

```bash
bun run pack:emf     # packages/emf-converter
bun run pack:mtx     # packages/mtx-decompressor
bun run pack:core    # packages/core
bun run pack:react   # packages/react
```

### Tech Stack

| Category          | Technologies                                                         |
| ----------------- | -------------------------------------------------------------------- |
| **Language**      | TypeScript 5.9 (strict mode)                                         |
| **Runtime**       | Bun (package manager), Node.js 18+                                   |
| **UI**            | React 19, Framer Motion, Tailwind CSS 4, Lucide React                |
| **Parsing**       | JSZip (ZIP), fast-xml-parser (XML)                                   |
| **Export**        | html2canvas + jsPDF (PDF), custom GIF encoder, MediaRecorder (video) |
| **3D**            | Three.js, @react-three/fiber, @react-three/drei (optional)           |
| **Collaboration** | Yjs (CRDT), y-websocket (optional)                                   |
| **Crypto**        | Web Crypto API (AES-128/256 for PPTX encryption)                     |
| **Testing**       | Vitest (11,900+ tests across 419 files)                              |
| **Formatting**    | oxfmt (from the [oxc](https://oxc.rs) toolchain)                     |
| **Linting**       | oxlint (from the [oxc](https://oxc.rs) toolchain)                    |
| **Bundler**       | tsup (ESM + CJS with .d.ts declarations)                             |

### Adding a New Element Type

1. **Define the interface** in `packages/core/src/core/types/elements.ts` -- extend `PptxElementBase`
2. **Add to the union** -- add your type to the `PptxElement` discriminated union
3. **Add a type guard** in `packages/core/src/core/types/type-guards.ts`
4. **Add parsing** -- create or extend a `PptxHandlerRuntime*Parsing.ts` module in the core runtime
5. **Add serialization** -- handle your type in `*SaveElementWriter.ts`
6. **Add a React renderer** in `packages/react/src/viewer/components/elements/`
7. **Add a converter processor** in `packages/core/src/converter/elements/` for Markdown output

## License

MIT
