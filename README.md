# pptx-viewer

A comprehensive TypeScript monorepo for parsing, editing, rendering, and converting Microsoft PowerPoint (`.pptx`) files in the browser and Node.js.

## Table of Contents

- [Overview](#overview)
- [Packages](#packages)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Core Package (`pptx-viewer-core`)](#core-package-pptx-viewer-core)
- [React Package (`pptx-viewer`)](#react-package-pptx-viewer)
- [EMF Converter Package (`emf-converter`)](#emf-converter-package-emf-converter)
- [Data Flow](#data-flow)
- [Key Concepts](#key-concepts)
- [API Reference](#api-reference)
- [Development](#development)
- [License](#license)

---

## Overview

`pptx-viewer` is a monorepo containing three packages that together provide a full-featured PowerPoint SDK:

1. **Parse** `.pptx` files from raw `ArrayBuffer` into a structured `PptxData` model
2. **Render** slides as interactive React components with full visual fidelity
3. **Edit** presentations programmatically or via the built-in WYSIWYG editor
4. **Save** changes back to a valid `.pptx` file (round-trip safe)
5. **Convert** presentations to Markdown with optional media extraction
6. **Export** slides as images (PNG/JPEG), PDF, GIF, or video

The codebase handles the full OpenXML specification including shapes, text, tables, charts, SmartArt, connectors, animations, transitions, themes, slide masters, embedded media, EMF/WMF metafiles, digital signatures, and more.

## Packages

```
packages/
  core/           pptx-viewer-core    – Parse, edit, serialize PPTX files (framework-agnostic)
  react/          pptx-viewer         – React-based viewer/editor component
  emf-converter/  emf-converter       – EMF/WMF metafile to PNG converter
```

| Package | Description | Dependencies |
|---------|-------------|--------------|
| `pptx-viewer-core` | Core PPTX engine — parse, edit, serialize, and convert PowerPoint files | `jszip`, `fast-xml-parser` (peers) |
| `pptx-viewer` | React-based PowerPoint viewer, editor, and canvas export | `pptx-viewer-core`, `react`, `framer-motion`, `lucide-react`, etc. (peers) |
| `emf-converter` | Convert EMF/WMF metafile binaries to PNG data URLs using Canvas | None |

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

# Build all packages
bun run build

# Run tests
bun run test

# Type-check
bun run typecheck
```

### Using as a Library

#### Core Package (Headless / Node.js)

```typescript
import { PptxHandler } from "pptx-viewer-core";

// Load a .pptx file
const handler = new PptxHandler();
const buffer = await fs.readFile("presentation.pptx");
const data = await handler.load(buffer.buffer);

console.log(`Loaded ${data.slides.length} slides`);
console.log(`Theme: ${data.theme?.name}`);
console.log(`Slide size: ${data.slideWidth}x${data.slideHeight}`);

// Access slide content
for (const slide of data.slides) {
  for (const element of slide.elements) {
    if (element.type === "text") {
      console.log(`Text: ${element.text}`);
    }
  }
}

// Modify and save
data.slides[0].elements[0].text = "Updated Title";
const output = await handler.save(data.slides);
await fs.writeFile("output.pptx", Buffer.from(output));
```

#### PPTX to Markdown Conversion

```typescript
import { PptxHandler, PptxMarkdownConverter } from "pptx-viewer-core";

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter("./output", {
  sourceName: "presentation.pptx",
  includeSpeakerNotes: true,
  mediaFolderName: "media",
  includeMetadata: true,
  semanticMode: true, // Clean markdown vs positioned HTML
});

const markdown = await converter.convert(data);
console.log(markdown);
```

#### React Viewer Component

```tsx
import { PowerPointViewer } from "pptx-viewer/viewer";

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

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Package (pptx-viewer)                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ PowerPoint   │  │  SlideCanvas │  │   Inspector/Toolbar   │  │
│  │   Viewer     │──│  + Elements  │  │   + Dialogs           │  │
│  │ (orchestrator│  │  Rendering   │  │   (editing UI)        │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────────┘  │
│         │                                                       │
│  ┌──────┴───────────────────────────────────────────────────┐   │
│  │              Hooks Layer                                  │   │
│  │  useViewerState, useEditorOperations, useLoadContent,     │   │
│  │  usePresentationMode, useExportHandlers, ...              │   │
│  └──────┬────────────────────────────────────────────────────┘   │
│         │                                                       │
│  ┌──────┴───────────────────────────────────────────────────┐   │
│  │              Utils Layer                                  │   │
│  │  Shape rendering, text layout, chart SVG, animation,      │   │
│  │  color resolution, export (PDF/GIF/video), connectors     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ imports
┌─────────────────────────┴───────────────────────────────────────┐
│                   Core Package (pptx-viewer-core)               │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ PptxHandler  │  │   Converter    │  │    Services          │  │
│  │ (public API) │  │ (PPTX → MD)   │  │ (animation, loader,  │  │
│  └──────┬───────┘  └────────────────┘  │  transitions, etc.)  │  │
│         │                              └─────────────────────┘  │
│  ┌──────┴──────────────────────────────────────────────────┐    │
│  │              Runtime Layer                               │    │
│  │  PptxHandlerRuntime — 50+ mixin modules for parsing,     │    │
│  │  serializing, theme resolution, element processing        │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                       │
│  ┌──────┴──────────────────────────────────────────────────┐    │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │    │
│  │  │  Types  │  │ Geometry │  │  Color   │  │ Builders │  │    │
│  │  │ System  │  │  Engine  │  │  Engine  │  │ (XML)    │  │    │
│  │  └─────────┘  └──────────┘  └─────────┘  └──────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ imports
┌─────────────────────────┴───────────────────────────────────────┐
│               EMF Converter Package (emf-converter)             │
│                                                                 │
│  Binary EMF/WMF parsing → GDI record replay → Canvas → PNG     │
└─────────────────────────────────────────────────────────────────┘
```

### Package Dependency Graph

```
pptx-viewer (React)
  └── pptx-viewer-core
        └── emf-converter
```

## Core Package (`pptx-viewer-core`)

The core package is framework-agnostic and handles all PPTX file operations.

### Module Structure

```
packages/core/src/
├── index.ts                    # Main entry — re-exports core + converter
├── core/
│   ├── PptxHandler.ts          # Public facade (extends PptxHandlerCore)
│   ├── PptxHandlerCore.ts      # Thin facade over the runtime
│   ├── types/                  # Complete PPTX type system (~20 modules)
│   │   ├── common.ts           # Shared enums and value types
│   │   ├── text.ts             # Text styles, segments, paragraphs
│   │   ├── elements.ts         # Element discriminated union (11 variants)
│   │   ├── element-base.ts     # Base properties for all elements
│   │   ├── shape-style.ts      # Fill, stroke, shadow, 3D effects
│   │   ├── table.ts            # Table data and cell styles
│   │   ├── chart.ts            # Chart data structures
│   │   ├── smart-art.ts        # SmartArt diagram nodes
│   │   ├── animation.ts        # Animation presets and native OOXML timing
│   │   ├── transition.ts       # Slide transitions
│   │   ├── media.ts            # Audio/video media types
│   │   ├── theme.ts            # Theme color/font schemes
│   │   ├── masters.ts          # Slide masters, layouts, notes/handout masters
│   │   ├── presentation.ts     # PptxSlide and PptxData root type
│   │   └── type-guards.ts      # Runtime type narrowing helpers
│   ├── core/                   # Runtime implementation
│   │   ├── PptxHandlerRuntime.ts       # Main runtime class (composed from mixins)
│   │   ├── PptxHandlerRuntimeFactory.ts # Factory for runtime creation
│   │   ├── runtime/            # 50+ mixin modules organized by concern
│   │   │   ├── *LoadPipeline.ts        # PPTX ZIP → PptxData orchestration
│   │   │   ├── *SavePipeline.ts        # PptxData → PPTX ZIP orchestration
│   │   │   ├── *SlideParsing.ts        # Slide XML → PptxSlide
│   │   │   ├── *ShapeParsing.ts        # Shape XML → PptxElement
│   │   │   ├── *ThemeProcessing.ts     # Theme color/font resolution
│   │   │   ├── *TextEditing.ts         # Text mutation helpers
│   │   │   ├── *SaveElementWriter.ts   # Element → XML serialization
│   │   │   ├── *SaveTextWriter.ts      # Text/paragraph → XML
│   │   │   └── ... (40+ more modules)
│   │   ├── builders/           # XML codec and builder classes
│   │   │   ├── PptxColorStyleCodec.ts  # Color XML ↔ model codec
│   │   │   ├── PptxShapeStyleExtractor.ts # Shape style parsing
│   │   │   ├── PptxEffectDagExtractor.ts  # Effect DAG extraction
│   │   │   └── PptxTableDataParser.ts  # Table structure parsing
│   │   └── factories/          # Dependency injection factories
│   ├── geometry/               # Shape geometry engine
│   │   ├── shape-geometry.ts   # Clip paths and mask styles
│   │   ├── connector-geometry.ts # Connector routing and path calculation
│   │   ├── guide-formula.ts    # OpenXML geometry guide evaluation engine
│   │   ├── preset-shape-*.ts   # 200+ preset shape definitions and clip paths
│   │   └── transform-utils.ts  # Rotation, flip, and offset transforms
│   ├── color/                  # Color parsing and transformation
│   │   ├── color-utils.ts      # Hex/RGB/HSL conversion, theme color resolution
│   │   ├── color-primitives.ts # Base color operations
│   │   └── color-transforms.ts # OpenXML transforms (tint, shade, satMod, etc.)
│   ├── builders/               # XML construction utilities
│   │   ├── PptxElementXmlBuilder.ts    # Element → XML serialization
│   │   ├── fluent/PptxXmlBuilder.ts    # Chainable XML builder API
│   │   └── factories/          # Element-specific XML factories
│   │       ├── TextShapeXmlFactory.ts
│   │       ├── PictureXmlFactory.ts
│   │       ├── ConnectorXmlFactory.ts
│   │       └── MediaGraphicFrameXmlFactory.ts
│   ├── services/               # Domain services
│   │   ├── PptxSlideLoaderService.ts   # Slide loading with theme/master resolution
│   │   ├── PptxEditorAnimationService.ts # High-level animation editing
│   │   ├── PptxNativeAnimationService.ts # OOXML p:timing parsing
│   │   ├── PptxSlideTransitionService.ts # Transition parsing/serialization
│   │   ├── PptxAnimationWriteService.ts  # Animation → p:timing XML
│   │   ├── PptxCompatibilityService.ts   # Feature compatibility detection
│   │   └── PptxXmlLookupService.ts     # XML part lookups in the ZIP archive
│   ├── utils/                  # Utility functions
│   │   ├── clone-utils.ts      # Deep clone for slides, elements, styles
│   │   ├── element-utils.ts    # Element helper functions (labels, text, actions)
│   │   ├── encryption-detection.ts # OLE compound file / encrypted .pptx detection
│   │   ├── signature-detection.ts  # Digital signature detection and stripping
│   │   ├── font-deobfuscation.ts   # OOXML embedded font deobfuscation
│   │   ├── smartart-*.ts       # SmartArt decomposition, editing, layout switching
│   │   ├── chart-*.ts          # Chart data parsing (axes, series, trendlines)
│   │   ├── stroke-utils.ts     # Dash patterns for borders and connectors
│   │   └── theme-override-utils.ts # Theme color map override helpers
│   ├── constants.ts            # EMU conversion factors, max dimensions
│   └── constants-colors.ts     # Standard color names and theme color maps
└── converter/                  # PPTX → Markdown converter
    ├── PptxMarkdownConverter.ts # Main converter — orchestrates slide processing
    ├── SlideProcessor.ts        # Slide → Markdown processing with element dispatch
    ├── base.ts                  # Abstract DocumentConverter base class
    ├── media-context.ts         # Media file extraction and naming
    ├── types.ts                 # FileSystemAdapter, ConversionOptions interfaces
    ├── TextSegmentRenderer.ts   # Rich text segments → Markdown inline formatting
    ├── ShapeTextRenderer.ts     # Shape text content rendering
    ├── ShapeImageRenderer.ts    # Shape-as-image fallback rendering
    └── elements/                # Per-element-type Markdown processors
        ├── ElementProcessor.ts  # Registry pattern — dispatches by element type
        ├── TextElementProcessor.ts
        ├── ImageElementProcessor.ts
        ├── TableElementProcessor.ts
        ├── ChartElementProcessor.ts
        ├── SmartArtElementProcessor.ts
        ├── GroupElementProcessor.ts
        ├── MediaElementProcessor.ts
        ├── OleElementProcessor.ts
        ├── InkElementProcessor.ts
        └── FallbackElementProcessor.ts
```

### Type System

The core type system models the entire PPTX document structure as TypeScript interfaces:

- **`PptxData`** — Root type returned by `handler.load()`. Contains slides, theme, masters, layouts, sections, document properties, view properties, and more.
- **`PptxSlide`** — A single slide with its element tree, background, notes, comments, animations, transitions, and layout reference.
- **`PptxElement`** — Discriminated union of 11 element types: `text`, `shape`, `image`, `table`, `chart`, `connector`, `group`, `smartArt`, `media`, `ink`, `ole`.
- **`TextStyle`** / **`ShapeStyle`** — Rich styling for text formatting (font, size, color, effects) and shape appearance (fill, stroke, shadow, reflection, glow, 3D).
- **`PptxTheme`** — Theme definition with color schemes (12 semantic colors), font schemes (major/minor), and format schemes.

### Runtime Architecture

The runtime (`PptxHandlerRuntime`) is the heart of the core package. It uses a **mixin composition pattern** where 50+ focused modules each add specific capabilities to the runtime class:

- **Load Pipeline** (`*LoadPipeline.ts`, `*LoadSession.ts`): Decompresses the ZIP via JSZip, parses XML with fast-xml-parser, resolves themes/masters/layouts, and builds the `PptxData` tree.
- **Save Pipeline** (`*SavePipeline.ts`, `*SaveSlideWriter.ts`): Walks the `PptxSlide[]` array, serializes each element back to OpenXML, rebuilds `[Content_Types].xml` and `.rels` files, and compresses back to a valid `.pptx`.
- **Parsing Modules**: Each element type (shapes, pictures, tables, charts, SmartArt, connectors, media, ink) has dedicated parser modules.
- **Theme Resolution** (`*ThemeProcessing.ts`, `*PlaceholderStyles.ts`): Resolves style inheritance through the element → placeholder → layout → master → theme chain.
- **State Management** (`*State.ts`): Maintains the in-memory ZIP archive, parsed XML cache, relationship maps, and media data.

## React Package (`pptx-viewer`)

The React package provides a full-featured PowerPoint viewer and editor component.

### Component Hierarchy

```
PowerPointViewer (orchestrator — forwardRef)
├── ViewerToolbarSection
│   ├── Toolbar (mode-aware primary toolbar)
│   │   ├── TextSection — font, size, bold/italic/underline, alignment
│   │   ├── InsertSection — shapes, images, tables, charts, media
│   │   ├── DrawSection — freeform drawing tools
│   │   ├── ArrangeSection — z-order, alignment, grouping
│   │   ├── DesignTransitionsReviewSection — themes, transitions, review
│   │   ├── ViewSection — zoom, grid, rulers, guides
│   │   └── PresentDropdown — start presentation, rehearse timings
│   └── PresentationSubtitleBar
├── ViewerMainContent
│   ├── SlidesPaneSidebar — left panel with slide thumbnails
│   │   ├── SlideItem — individual thumbnail with drag reorder
│   │   ├── SectionHeader — collapsible section groups
│   │   └── SlideContextMenu / SectionContextMenu
│   ├── ViewerCanvasArea — central slide editing area
│   │   ├── SlideCanvas — main rendering surface (CSS-scaled)
│   │   │   ├── ElementRenderer — per-element dispatch
│   │   │   │   ├── ElementBody — shape visual (fill, stroke, clip path) + text
│   │   │   │   ├── ImageRenderer — image elements with effects
│   │   │   │   ├── ConnectorElementRenderer — SVG connector paths
│   │   │   │   ├── SmartArtRenderer — SmartArt diagram rendering
│   │   │   │   ├── InlineTextEditor — WYSIWYG text editing
│   │   │   │   └── ResizeHandles — drag handles for resizing
│   │   │   └── CanvasOverlays
│   │   │       ├── GridOverlay / RulerStrips — visual guides
│   │   │       ├── ConnectorOverlay — interactive connector creation
│   │   │       ├── DrawingOverlaySvg — freeform drawing surface
│   │   │       └── CommentMarkersOverlay — comment pin indicators
│   │   └── ViewerInspector — right panel with property editors
│   │       └── InspectorPane
│   │           ├── ElementProperties — position, size, rotation
│   │           ├── FillStrokeProperties — fill type, stroke, effects
│   │           ├── TextProperties — font, paragraph, text effects
│   │           ├── AnimationPanel — animation timeline editor
│   │           ├── SlideProperties — background, layout, transition
│   │           ├── TablePropertiesPanel — table formatting
│   │           ├── ChartDataPanel — chart data editor
│   │           ├── ImagePropertiesPanel — crop, adjustments, effects
│   │           └── CommentsTab — comment thread management
│   └── ViewerSidePanels — togglable side panels
│       ├── FindReplacePanel, SelectionPane
│       ├── AccessibilityPanel, VersionHistoryPanel
│       ├── FontEmbeddingPanel, HandoutMasterPanel
│       └── MasterViewSidebar — slide master editing
├── ViewerBottomPanels
│   └── SlideNotesPanel — speaker notes editor with rich text
├── ViewerOverlays
│   ├── SlideSorterOverlay — grid view for slide reordering
│   └── ContextMenu — right-click context menus
├── ViewerPresentationLayer — fullscreen slideshow mode
│   ├── PresentationTransitionOverlay — slide transition animations
│   ├── PresentationAnnotationOverlay — laser pointer / pen tools
│   └── PresenterView — dual-screen presenter view
└── ViewerDialogGroup — modal dialogs
    ├── PrintDialog — print layout and preview
    ├── ExportProgressModal — export progress indicator
    ├── DocumentPropertiesDialog — metadata editing
    ├── EquationEditorDialog — LaTeX equation insertion
    ├── InsertSmartArtDialog — SmartArt layout picker
    ├── SetUpSlideShowDialog — slideshow configuration
    ├── EncryptedFileDialog — password prompt
    ├── DigitalSignaturesDialog — signature management
    ├── HyperlinkEditDialog — hyperlink editing
    └── ... (more dialogs)
```

### Hooks System

The viewer delegates all logic to custom React hooks, keeping components purely presentational:

| Hook | Purpose |
|------|---------|
| **State Management** | |
| `useViewerState` | Central state atom — slides, selection, mode, canvas size, all refs |
| `useViewerCoreState` | Core state slice (loading, error, slides, active index) |
| `useViewerUIState` | UI state slice (panels, dialogs, overlays) |
| `useViewerDialogs` | Dialog open/close state for all modal dialogs |
| `useDerivedSlideState` | Computed values: visible slides, section groups, grid spacing |
| `useDerivedElementState` | Computed element properties derived from selection |
| **Editing** | |
| `useEditorHistory` | Undo/redo stack with snapshot-based state management |
| `useEditorOperations` | High-level editing operations (wires hooks together) |
| `useElementManipulation` | Element CRUD, property updates, transform changes |
| `useElementOperations` | Batch element operations (multi-select, group) |
| `useInsertElements` | Shape, image, table, chart, media insertion |
| `useTableOperations` | Table cell editing, merge/split, row/column add/remove |
| `usePropertyHandlers` | Property panel change handlers |
| `useGroupAlignLayerHandlers` | Group/ungroup, alignment, z-order operations |
| `useClipboardHandlers` | Copy/cut/paste with element serialization |
| **Loading & Saving** | |
| `useLoadContent` | PPTX file loading lifecycle (ArrayBuffer → PptxData → state) |
| `useContentLifecycle` | Content change detection and dirty state tracking |
| `useSerialize` | State → PPTX serialization via PptxHandler.save() |
| `useAutosave` | Periodic auto-save with configurable interval |
| **Interaction** | |
| `usePointerHandlers` | Mouse/touch event routing to interaction handlers |
| `useCanvasInteractions` | Shape drag, resize, marquee selection, rotation |
| `useZoomViewport` | Pan/zoom with scroll wheel and keyboard shortcuts |
| `useKeyboardShortcuts` | Global keyboard shortcut registration and dispatch |
| **Presentation** | |
| `usePresentationMode` | Slideshow playback with animation sequencing |
| `usePresentationSetup` | Presentation mode initialization and cleanup |
| `usePresentationAnnotations` | Laser pointer, pen, highlighter overlays |
| **Export** | |
| `useExportHandlers` | Export to PNG, JPEG, PDF, GIF, video, PPTX |
| `useExportSaveAs` | Save-as dialog with format selection |
| `usePrintHandlers` | Print dialog and layout generation |
| **Other** | |
| `useComments` | Comment CRUD, threading, author management |
| `useFindReplace` | Find and replace text across all slides |
| `useThemeHandlers` | Theme color/font editing and preset application |
| `useFontInjection` | Embedded font loading and injection into DOM |
| `useSlideManagement` | Slide add, delete, duplicate, reorder, sections |
| `useSectionOperations` | Section CRUD and slide assignment |
| `useRecoveryDetection` | Auto-recovery from saved state |

### Rendering Pipeline

Slides are rendered using a **CSS-based approach** (not Canvas) for the main editor view:

1. **SlideCanvas** wraps all elements in a scaled container using CSS `transform: scale()` to fit the viewport while maintaining the slide's native coordinate system.
2. **ElementRenderer** dispatches each `PptxElement` to the appropriate sub-renderer based on its `type` discriminant.
3. **Shape rendering** (`shape-visual.tsx`, `shape.tsx`) uses CSS for fills (solid, gradient, pattern, image), borders, shadows, reflections, glow, and SVG `clip-path` for geometry (200+ preset shapes).
4. **Text rendering** (`text.tsx`, `text-render.tsx`, `text-layout.tsx`) preserves OpenXML paragraph and run formatting using CSS — font families, sizes, colors, spacing, text effects (shadow, outline, glow, warp), and multi-column layout.
5. **Charts** (`chart.tsx` and family) are rendered as inline SVG with full support for bar, line, area, pie, scatter, radar, stock, waterfall, sunburst, treemap, funnel, and combo charts.
6. **Tables** (`table.tsx`, `table-render.tsx`) are rendered as HTML `<table>` elements with cell-level formatting, merge spans, diagonal borders, and banded styles.
7. **Connectors** (`connector-path.tsx`) are rendered as SVG `<path>` elements with A* routing for bent connectors.
8. **SmartArt** (`smartart.tsx` and family) decomposes diagram data into positioned shapes with layout-specific renderers (list, process, cycle, hierarchy, matrix, gear, etc.).
9. **Animations** (`animation.tsx`, `animation-timeline.ts`) use CSS keyframes and the Web Animations API for entrance, emphasis, exit, and motion path effects.

### Export System

The viewer supports multiple export formats:

| Format | Implementation |
|--------|---------------|
| **PNG/JPEG** | `html2canvas` rasterization with oklch color space workaround (`canvas-export.ts`) |
| **PDF** | `jsPDF` multi-page assembly from rasterized slides |
| **GIF** | Animated GIF from slide sequence using custom GIF encoder (`export-gif.ts`) |
| **Video** | MP4/WebM via `MediaRecorder` API with frame-by-frame rendering |
| **PPTX** | Round-trip save via `PptxHandler.save()` — preserves all formatting |
| **Individual Slides** | Each slide exported as standalone `.pptx` via `PptxHandler.exportSlides()` |

## EMF Converter Package (`emf-converter`)

Converts Windows Enhanced Metafile (EMF) and Windows Metafile (WMF) binary data to PNG data URLs. These legacy image formats are commonly embedded in PowerPoint files for clipart and diagrams.

### Pipeline

```
Binary EMF/WMF Buffer
    ↓
Header Parsing — bounds, DPI, version, record count
    ↓
GDI Record Replay — replays drawing commands onto Canvas 2D
    ├── EMF Records (Enhanced Metafile)
    │   ├── Drawing: LineTo, Rectangle, Ellipse, Polygon, PolyBezier, ArcTo
    │   ├── Path: BeginPath, EndPath, StrokePath, FillPath, StrokeAndFillPath
    │   ├── State: SaveDC, RestoreDC, SetWorldTransform, ModifyWorldTransform
    │   ├── Clipping: SelectClipPath, IntersectClipRect, ExcludeClipRect
    │   ├── Objects: CreatePen, CreateBrush, CreateFont, SelectObject, DeleteObject
    │   ├── Text: ExtTextOutW with font rendering
    │   └── Bitmap: StretchDIBits, BitBlt, StretchBlt
    ├── EMF+ Records (GDI+ extensions)
    │   ├── Anti-aliased drawing with alpha compositing
    │   ├── Matrix transforms and gradient brushes
    │   ├── Complex path objects with bezier curves
    │   └── Image and text rendering with quality hints
    └── WMF Records (legacy 16-bit Windows Metafile)
        ├── Basic drawing primitives
        ├── Object management (pens, brushes, fonts)
        └── Bitmap operations
    ↓
Canvas 2D API Rendering
    ↓
PNG Data URL Export (canvas.toDataURL / OffscreenCanvas)
```

### Key Modules

| Module | Description |
|--------|-------------|
| `emf-converter.ts` | Public API — `convertEmfToDataUrl()`, `convertWmfToDataUrl()` |
| `emf-header-parser.ts` | EMF/WMF file header parsing and bounds calculation |
| `emf-record-replay.ts` | Main EMF record dispatcher (300+ record types) |
| `emf-gdi-draw-*.ts` | GDI drawing command implementations |
| `emf-gdi-object-handlers.ts` | GDI object creation/selection/deletion |
| `emf-gdi-state-handlers.ts` | DC state save/restore, clipping, mapping modes |
| `emf-gdi-transform-handlers.ts` | World transform matrix operations |
| `emf-plus-replay.ts` | EMF+ record dispatcher |
| `emf-plus-draw-handlers.ts` | GDI+ drawing operations |
| `emf-plus-object-parser.ts` | GDI+ object deserialization |
| `emf-dib-decoder.ts` | Device-Independent Bitmap (DIB) decoding |
| `emf-dib-rle-decoder.ts` | RLE-compressed bitmap decoding |
| `wmf-replay.ts` | WMF record dispatcher |
| `emf-types.ts` | Shared type definitions (GDI state, objects, records) |

### Usage

```typescript
import { convertEmfToDataUrl, convertWmfToDataUrl } from "emf-converter";

// Convert EMF binary to PNG data URL
const emfBuffer: ArrayBuffer = /* read from PPTX media part */;
const pngDataUrl = await convertEmfToDataUrl(emfBuffer);
// => "data:image/png;base64,iVBORw0K..."

// Convert WMF binary to PNG data URL
const wmfBuffer: ArrayBuffer = /* read from PPTX media part */;
const wmfPngUrl = await convertWmfToDataUrl(wmfBuffer);
```

## Data Flow

### Loading a PPTX File

```
ArrayBuffer (.pptx ZIP archive)
    ↓
detectFileFormat() — check for OLE compound file (encrypted / legacy .ppt)
    ↓
JSZip.loadAsync() — decompress the ZIP, build in-memory file map
    ↓
Parse [Content_Types].xml — discover part MIME types and overrides
    ↓
Parse _rels/.rels — find the main presentation part
    ↓
Parse ppt/presentation.xml — slide list, slide size, default text styles
    ↓
Parse ppt/theme/theme1.xml — color scheme, font scheme, format scheme
    ↓
Parse ppt/slideMasters/*.xml — master slide elements and backgrounds
    ↓
Parse ppt/slideLayouts/*.xml — layout templates and placeholder mapping
    ↓
For each slide:
    ├── Parse ppt/slides/slideN.xml
    │   ├── p:cSld/p:spTree — the shape tree (root element container)
    │   │   ├── p:sp (shape/text) → TextPptxElement | ShapePptxElement
    │   │   ├── p:pic (picture) → ImagePptxElement
    │   │   ├── p:graphicFrame → TablePptxElement | ChartPptxElement
    │   │   ├── p:grpSp (group) → GroupPptxElement (recursive)
    │   │   ├── p:cxnSp (connector) → ConnectorPptxElement
    │   │   └── mc:AlternateContent → SmartArt | Media | Ink | OLE
    │   ├── p:cSld/p:bg — slide background (solid, gradient, image)
    │   └── p:timing — animation sequences (native OOXML)
    ├── Parse slide relationships (images, charts, media, hyperlinks)
    ├── Parse ppt/notesSlides/notesSlideN.xml — speaker notes
    ├── Parse ppt/comments/commentN.xml — slide comments
    └── Merge placeholder styles from layout → master → theme
    ↓
PptxData {
    slides: PptxSlide[],
    theme: PptxTheme,
    masters: PptxSlideMaster[],
    layouts: PptxLayoutOption[],
    sections: PptxSection[],
    slideWidth, slideHeight,
    coreProperties, appProperties,
    viewProperties, ...
}
```

### Saving a PPTX File

```
PptxData.slides (modified slide array)
    ↓
For each slide:
    ├── Serialize elements → OpenXML sp/pic/graphicFrame/cxnSp nodes
    │   ├── Build p:spTree from element ordering
    │   ├── Write a:xfrm (position, size, rotation, flip)
    │   ├── Write a:prstGeom or a:custGeom (shape geometry)
    │   ├── Write a:solidFill / a:gradFill / a:blipFill (fills)
    │   ├── Write a:ln (stroke/line properties)
    │   ├── Write a:effectLst (shadow, glow, reflection, blur)
    │   ├── Write p:txBody with a:p/a:r (paragraphs and text runs)
    │   └── Write element-specific properties (table cells, chart refs)
    ├── Serialize background, transition, animation timing
    ├── Update slide .rels (new/removed image/media relationships)
    ├── Write notes and comments parts
    └── Embed new media files into the ZIP
    ↓
Update [Content_Types].xml — add/remove content type entries
    ↓
Update ppt/presentation.xml — slide list, section definitions
    ↓
Reconcile slide masters, layouts (pass-through if unchanged)
    ↓
JSZip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
    ↓
Uint8Array (valid .pptx file)
```

## Key Concepts

### EMU (English Metric Units)

PowerPoint internally uses EMU (English Metric Units) for all measurements. The core package provides conversion constants in `constants.ts`:

```typescript
// 1 inch = 914400 EMU
// 1 point = 12700 EMU
// 1 pixel (96 DPI) = 9525 EMU

import {
  EMU_PER_INCH,    // 914400
  EMU_PER_POINT,   // 12700
  EMU_PER_PIXEL,   // 9525
} from "pptx-viewer-core";
```

Slide dimensions in `PptxData` are in pixels (pre-converted from EMU).

### Element Discriminated Union

All slide elements share a common base (`PptxElementBase` — id, x, y, width, height, rotation, etc.) and are discriminated by the `type` field:

```typescript
type PptxElement =
  | TextPptxElement      // type: "text"     — text box
  | ShapePptxElement     // type: "shape"    — auto-shape with optional text
  | ImagePptxElement     // type: "image"    — embedded or linked image
  | TablePptxElement     // type: "table"    — table grid with cells
  | ChartPptxElement     // type: "chart"    — chart (bar, line, pie, etc.)
  | ConnectorPptxElement // type: "connector" — line connecting two shapes
  | GroupPptxElement     // type: "group"    — group of elements (recursive)
  | SmartArtPptxElement  // type: "smartArt" — SmartArt diagram
  | MediaPptxElement     // type: "media"    — audio or video
  | InkPptxElement       // type: "ink"      — digital ink strokes
  | OlePptxElement       // type: "ole"      — embedded OLE object

// Narrow with the type discriminant:
if (element.type === "image") {
  console.log(element.imageData); // TS knows this is ImagePptxElement
}
```

### Theme Resolution Chain

Styles are resolved through a hierarchy mirroring PowerPoint's inheritance model:

```
Element inline style
    ↓ (fallback)
Placeholder defaults (from layout)
    ↓ (fallback)
Slide layout defaults
    ↓ (fallback)
Slide master defaults
    ↓ (fallback)
Theme defaults (defaultTextStyle, etc.)
```

This means a text box with no explicit font size inherits from its placeholder type on the layout, which inherits from the slide master, which inherits from the theme.

### Converter Modes

The Markdown converter supports two output modes:

- **Positioned mode** (default): Emits HTML `<div>` elements with absolute CSS positioning that preserve the exact slide layout. Best for visual fidelity.
- **Semantic mode** (`semanticMode: true`): Emits clean Markdown with headings, paragraphs, and lists based on reading order. Best for LLM consumption, indexing, and text processing.

### XML Builder

The fluent `PptxXmlBuilder` provides a chainable API for programmatic slide construction:

```typescript
const builder = handler.Builder(data);
// Chainable API for constructing and inserting OpenXML nodes
// directly into the runtime's in-memory ZIP archive
```

Element-specific XML factories handle the details of generating valid OpenXML:
- `TextShapeXmlFactory` — Text boxes and auto-shapes
- `PictureXmlFactory` — Image elements
- `ConnectorXmlFactory` — Connector shapes
- `MediaGraphicFrameXmlFactory` — Audio/video graphic frames

## API Reference

### `PptxHandler` / `PptxHandlerCore`

| Method | Returns | Description |
|--------|---------|-------------|
| `load(data, options?)` | `Promise<PptxData>` | Parse `.pptx` from `ArrayBuffer` into structured data |
| `save(slides, options?)` | `Promise<Uint8Array>` | Serialize slides back to `.pptx` bytes |
| `exportSlides(slides, options)` | `Promise<Map<number, Uint8Array>>` | Export individual slides as standalone `.pptx` files |
| `getImageData(path)` | `Promise<string \| undefined>` | Get base64 data URL for an embedded image |
| `getMediaArrayBuffer(path)` | `Promise<ArrayBuffer \| undefined>` | Get raw bytes for embedded media |
| `getChartDataForGraphicFrame(...)` | `Promise<PptxChartData \| undefined>` | Extract chart data from a graphic frame |
| `getSmartArtDataForGraphicFrame(...)` | `Promise<PptxSmartArtData \| undefined>` | Extract SmartArt data from a graphic frame |
| `createXmlBuilder(data)` / `Builder(data)` | `PptxXmlBuilder` | Create a fluent XML builder |
| `getLayoutOptions()` | `PptxLayoutOption[]` | Get available slide layout options |
| `getCompatibilityWarnings()` | `PptxCompatibilityWarning[]` | Get feature compatibility warnings |
| `applyTheme(colors, fonts, name?)` | `Promise<void>` | Apply a complete theme |
| `updateThemeColorScheme(scheme)` | `Promise<void>` | Update theme color scheme |
| `updateThemeFontScheme(scheme)` | `Promise<void>` | Update theme font scheme |
| `updateThemeName(name)` | `Promise<void>` | Rename the theme |
| `setPresentationTheme(path)` | `Promise<void>` | Load theme from `.thmx` file |
| `setTemplateBackground(path, color)` | `void` | Set background color for a layout template |
| `getTemplateBackgroundColor(path)` | `string \| undefined` | Get background color for a layout template |

### `PowerPointViewer` (React Component)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ArrayBuffer \| Uint8Array \| null` | — | PPTX file content to display |
| `filePath` | `string?` | — | File path (display only) |
| `canEdit` | `boolean` | `false` | Enable editing mode |
| `onContentChange` | `(content: Uint8Array) => void` | — | Called when presentation is saved |
| `onDirtyChange` | `(dirty: boolean) => void` | — | Called when dirty state changes |
| `onActiveSlideChange` | `(index: number) => void` | — | Called when active slide changes |

The component also exposes a `PowerPointViewerHandle` via `ref`:
- `getContent(): Promise<string | Uint8Array>` — Get current content for external saving

### `PptxMarkdownConverter`

```typescript
const converter = new PptxMarkdownConverter(outputDir, options, fs?);
```

| Option | Type | Description |
|--------|------|-------------|
| `sourceName` | `string` | Source filename for metadata |
| `includeSpeakerNotes` | `boolean` | Include speaker notes in output |
| `mediaFolderName` | `string` | Subfolder name for extracted media |
| `includeMetadata` | `boolean` | Include YAML frontmatter |
| `semanticMode` | `boolean?` | Clean markdown vs positioned HTML |
| `slideRange` | `{ start?: number, end?: number }?` | Limit to specific slide range |

| Property / Method | Description |
|-------------------|-------------|
| `convert(data)` | Convert `PptxData` → Markdown string |
| `imagesExtracted` | Count of extracted images |
| `mediaDir` | Path to media folder (null if no images) |
| `slidesConverted` | Number of slides converted |
| `presentationSlides` | Total slides in presentation |

### `emf-converter`

| Function | Description |
|----------|-------------|
| `convertEmfToDataUrl(buffer: ArrayBuffer)` | Convert EMF binary → PNG data URL string (or `undefined`) |
| `convertWmfToDataUrl(buffer: ArrayBuffer)` | Convert WMF binary → PNG data URL string (or `undefined`) |

## Development

### Workspace Commands

```bash
# Build all packages (order: emf-converter → core → react)
bun run build

# Build a specific package
cd packages/core && bun run build

# Watch mode for development
cd packages/core && bun run dev

# Run all tests across all packages
bun run test

# Type-check all packages
bun run typecheck

# Pack for npm distribution
bun run pack:emf     # packages/emf-converter
bun run pack:core    # packages/core
bun run pack:react   # packages/react
```

### Build System

| Tool | Purpose |
|------|---------|
| **Bun** | Package manager, workspace management, script runner |
| **tsup** | Bundles each package to ESM (`.mjs`) and CJS (`.js`) with `.d.ts` declarations |
| **vitest** | Test runner with TypeScript support |
| **TypeScript** | Strict mode with project references for monorepo type-checking |

### Adding a New Element Type

1. **Define the interface** in `packages/core/src/core/types/elements.ts` — extend `PptxElementBase` with type-specific properties
2. **Add to the union** — add your type to the `PptxElement` discriminated union
3. **Add a type guard** in `packages/core/src/core/types/type-guards.ts`
4. **Add parsing** in the runtime — create or extend a `PptxHandlerRuntime*Parsing.ts` module
5. **Add serialization** in the save pipeline — handle your type in `*SaveElementWriter.ts`
6. **Add a React renderer** in `packages/react/src/viewer/components/elements/`
7. **Add a converter processor** in `packages/core/src/converter/elements/` for Markdown output

### Project Structure Conventions

- **Mixin pattern**: Runtime capabilities are split into focused files (`PptxHandlerRuntime*.ts`) that are composed into the main runtime class. Each file handles one concern.
- **Index barrels**: Every directory has an `index.ts` that re-exports its public API. Import from the barrel, not from individual files.
- **Type-only modules**: The `types/` directory contains only interfaces and type aliases — no runtime code. This ensures tree-shaking removes them from production builds.
- **Service interfaces**: Services define an `I*` interface (e.g., `IPptxSlideLoaderService`) for testability and dependency injection.

## License

MIT
