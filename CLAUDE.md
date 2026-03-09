# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun install                  # Install all workspace dependencies
bun run build                # Build all packages (emf-converter → core → react)
bun run test                 # Run vitest across all packages
bun run typecheck            # Type-check all packages
bun run demo                 # Start demo dev server (Vite, port 4173)

# Per-package (run from package directory)
bun run build                # Build via tsup
bun run dev                  # Watch mode
bun run test                 # Run vitest
bun run typecheck            # Type-check
```

Build order matters: **emf-converter → mtx-decompressor → core → react**

## Monorepo Structure

```
packages/
  core/             pptx-viewer-core     – Parse, edit, serialize PPTX (framework-agnostic)
  react/            pptx-viewer          – React viewer/editor component
  emf-converter/    emf-converter        – EMF/WMF metafile → PNG converter
  mtx-decompressor/ mtx-decompressor     – MicroType Express font decompressor
demo/               Vite + React demo app
```

Dependency graph: `react → core → emf-converter`. Packages use `workspace:*` protocol. Bun workspaces defined at root.

## Architecture

### Core Package (`packages/core/src/`)

- **`PptxHandler`** → public facade. Wraps `PptxHandlerCore` → `PptxHandlerRuntime`.
- **Runtime uses mixin composition**: 50+ focused modules in `core/core/runtime/` each add specific capabilities (parsing, saving, theme resolution, etc.) to `PptxHandlerRuntime`.
- **Type system** in `core/types/`: Pure interfaces, no runtime code. `PptxElement` is a discriminated union of 11 element types (`text`, `shape`, `image`, `table`, `chart`, `connector`, `group`, `smartArt`, `media`, `ink`, `ole`). Narrow with `element.type`.
- **Load pipeline**: ArrayBuffer → JSZip → parse XML (fast-xml-parser) → resolve themes/masters/layouts → `PptxData`
- **Save pipeline**: `PptxSlide[]` → serialize elements to OpenXML → rebuild rels/content types → JSZip → `Uint8Array`
- **Theme resolution chain**: Element → Placeholder → Layout → Master → Theme
- **Geometry engine** in `core/geometry/`: 200+ preset shapes, clip paths, connector routing, guide formula evaluation.
- **Converter** in `converter/`: PPTX → Markdown with registry pattern dispatch per element type.

### React Package (`packages/react/src/`)

- **`PowerPointViewer`** is the main component (forwardRef orchestrator).
- **Hooks-based architecture**: 67+ custom hooks handle all logic; components are purely presentational. Key hooks: `useViewerState`, `useEditorHistory`, `useEditorOperations`, `useLoadContent`, `useExportHandlers`, `usePresentationMode`.
- **CSS-based rendering** (not Canvas): Slides render as scaled HTML/SVG with CSS transforms. Charts render as inline SVG. Tables render as HTML `<table>`. Connectors and shapes use SVG `clip-path`.
- **Export** uses html2canvas for rasterization (PNG/PDF/GIF/video).

### EMF Converter (`packages/emf-converter/src/`)

Binary EMF/WMF → GDI record replay onto Canvas 2D → PNG data URL. Supports 300+ EMF record types, EMF+, and legacy WMF.

## Key Conventions

- **Mixin pattern**: Runtime modules are in `PptxHandlerRuntime*.ts` files. Each handles one concern. New capabilities are added as new mixins.
- **Barrel exports**: Every directory has `index.ts`. Import from barrels, not individual files.
- **Type narrowing**: Always use the `type` discriminant for `PptxElement` — e.g., `if (element.type === "image")`.
- **EMU units**: PowerPoint uses English Metric Units internally. Conversion constants in `core/constants.ts` (`EMU_PER_INCH = 914400`, `EMU_PER_POINT = 12700`, `EMU_PER_PIXEL = 9525`).
- **Service interfaces**: Services define `I*` interfaces for DI/testability.
- **File naming**: kebab-case for utilities, PascalCase for classes. Tests colocated with source (`.test.ts` suffix).

## Tech Stack

- **TypeScript 5.9** (strict mode), **Bun** (package manager/runtime), **tsup** (bundler → ESM + CJS)
- **React 19**, **Framer Motion**, **Tailwind CSS 4**, **Lucide React**
- **Vitest** (testing), **JSZip** (ZIP), **fast-xml-parser** (XML), **html2canvas** + **jsPDF** (export)
- **Vite** (demo app dev server)

## Adding a New Element Type

1. Define interface in `packages/core/src/core/types/elements.ts` extending `PptxElementBase`
2. Add to `PptxElement` discriminated union
3. Add type guard in `type-guards.ts`
4. Add parsing module in `core/core/runtime/`
5. Add serialization in `*SaveElementWriter.ts`
6. Add React renderer in `packages/react/src/viewer/components/elements/`
7. Add converter processor in `packages/core/src/converter/elements/`
