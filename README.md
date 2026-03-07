# pptx-viewer

Standalone PowerPoint (.pptx) viewer, editor, and converter. Parse, render, edit, and serialize PPTX files entirely in the browser.

## Features

- **Core engine** — Parse and save PPTX files (OpenXML format) with full support for shapes, text, images, charts, tables, SmartArt, animations, transitions, themes, comments, and more
- **React viewer** — Full-featured PowerPoint viewer/editor component with toolbar, inspector, slide sorter, presenter mode, find & replace, and keyboard shortcuts
- **Markdown converter** — Convert PPTX presentations to Markdown with image extraction
- **Geometry engine** — 200+ preset shapes, custom geometry paths, connectors, and guide formulas
- **Animation system** — Entrance, emphasis, exit, and motion path animations with timeline support
- **EMF/WMF support** — Render embedded metafile images

## Installation

```bash
bun add pptx-viewer
```

### Peer dependencies

```bash
bun add jszip fast-xml-parser react react-dom react-i18next i18next framer-motion lucide-react react-icons html2canvas jspdf
```

## Usage

### React Viewer

```tsx
import { PowerPointViewer } from 'pptx-viewer';

function App({ pptxBytes }: { pptxBytes: Uint8Array }) {
  return (
    <PowerPointViewer
      content={pptxBytes}
      canEdit={true}
      onDirtyChange={(dirty) => console.log('Dirty:', dirty)}
    />
  );
}
```

### Core Engine (headless)

```ts
import { PptxHandler } from 'pptx-viewer/core';

// Parse a PPTX file
const data = await PptxHandler.load(pptxBytes);
console.log(`Slides: ${data.slides.length}`);
console.log(`Theme: ${data.theme?.name}`);

// Modify and save
data.slides[0].elements[0].text = 'Updated title';
const savedBytes = await PptxHandler.save(data);
```

### Markdown Converter

```ts
import { PptxHandler } from 'pptx-viewer/core';
import { PptxMarkdownConverter } from 'pptx-viewer/converter';
import type { FileSystemAdapter } from 'pptx-viewer/converter';

const data = await PptxHandler.load(pptxBytes);

// In-memory conversion (no file system needed)
const converter = new PptxMarkdownConverter('.', {
  sourceName: 'presentation.pptx',
  mediaFolderName: 'media',
  includeMetadata: true,
  includeSpeakerNotes: true,
});
const markdown = await converter.convert(data);

// With file output (provide a FileSystemAdapter)
const fs: FileSystemAdapter = {
  writeFile: async (path, content) => { /* write to disk */ },
  writeBinaryFile: async (path, data) => { /* write binary to disk */ },
  createFolder: async (path) => { /* mkdir -p */ },
};
const converter2 = new PptxMarkdownConverter('/output', {
  sourceName: 'deck.pptx',
  mediaFolderName: 'media',
  includeMetadata: true,
  includeSpeakerNotes: true,
  outputPath: '/output/deck.md',
}, fs);
const md = await converter2.convert(data);
```

## Package Exports

| Import path | Contents |
|---|---|
| `pptx-viewer` | Everything (core + viewer + converter) |
| `pptx-viewer/core` | PPTX parsing/saving engine, types, geometry |
| `pptx-viewer/viewer` | React PowerPointViewer component |
| `pptx-viewer/converter` | PPTX-to-Markdown converter |

## Demo

```bash
cd packages/pptx-viewer
bun run demo
```

Opens a browser at `http://localhost:4173` where you can drop a `.pptx` file to view it.

## Building

```bash
bun run build      # Build dist/
bun run typecheck   # Type-check without emitting
bun run test        # Run tests
bun run pack        # Build + create .tgz
```

## Architecture

```
src/
  core/          # PPTX parse/save engine (framework-agnostic)
    types/       # Element, style, animation, chart, table types
    geometry/    # Preset shapes, custom paths, guide formulas
    services/    # Animations, transitions, compatibility
    builders/    # XML construction (fluent builder pattern)
    core/        # Runtime load/save pipelines
    color/       # Color transforms and utilities
    utils/       # Charts, SmartArt, EMF/WMF, fonts
  viewer/        # React PowerPoint viewer/editor
    components/  # UI components (toolbar, inspector, canvas, etc.)
    hooks/       # State management, interactions, presentation mode
    utils/       # Rendering helpers, animations, charts
  converter/     # PPTX to Markdown conversion
    elements/    # Per-element-type processors
  lib/
    canvas-export.ts  # html2canvas oklch color space wrapper
```

## License

MIT
