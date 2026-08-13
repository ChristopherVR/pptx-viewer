---
title: Imperative Handle
description: The PowerPointViewerHandle ref API provides programmatic access to navigation, undo/redo, zoom, mode, selection, and content serialization.
---

# Imperative Handle

`PowerPointViewer` is a `forwardRef` component. Attach a ref typed as `PowerPointViewerHandle` to
call its imperative API.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';
import { useRef } from 'react';

function Editor({ content }: { content: Uint8Array }) {
	const ref = useRef<PowerPointViewerHandle>(null);

	async function save() {
		const bytes = await ref.current?.getContent();
		if (bytes) {
			// persist `bytes` (a Uint8Array)
		}
	}

	return (
		<>
			<button onClick={save}>Save</button>
			<button onClick={() => ref.current?.goNext()}>Next Slide</button>
			<button onClick={() => ref.current?.undo()}>Undo</button>
			<PowerPointViewer ref={ref} content={content} canEdit />
		</>
	);
}
```

## Interface

`PowerPointViewerHandle` extends `FileViewerHandle` and implements the shared
`PowerPointViewerAPI` contract (defined in `pptx-viewer-shared`). All three framework
bindings (React, Vue, Angular) expose the same API surface.

```ts
import type { ViewerMode, PowerPointViewerAPI } from 'pptx-react-viewer';
```

## Methods

### Serialization

| Method       | Signature                   | Description                                                 |
| ------------ | --------------------------- | ----------------------------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | Serializes the current document to `.pptx` bytes on demand. |

### Navigation

| Method   | Signature                      | Description                                |
| -------- | ------------------------------ | ------------------------------------------ |
| `goTo`   | `(slideIndex: number) => void` | Navigate to a specific slide (zero-based). |
| `goPrev` | `() => void`                   | Navigate to the previous slide.            |
| `goNext` | `() => void`                   | Navigate to the next slide.                |

### Undo / Redo

| Method    | Signature       | Description                          |
| --------- | --------------- | ------------------------------------ |
| `undo`    | `() => void`    | Undo the last editing action.        |
| `redo`    | `() => void`    | Redo the last undone action.         |
| `canUndo` | `() => boolean` | Whether an undo action is available. |
| `canRedo` | `() => boolean` | Whether a redo action is available.  |

### Zoom

| Method      | Signature                 | Description                                |
| ----------- | ------------------------- | ------------------------------------------ |
| `getZoom`   | `() => number`            | Get the current zoom level (1 = 100%).     |
| `setZoom`   | `(level: number) => void` | Set the zoom level (clamped to 0.2 - 5.0). |
| `zoomIn`    | `() => void`              | Zoom in by one step (10%).                 |
| `zoomOut`   | `() => void`              | Zoom out by one step (10%).                |
| `zoomReset` | `() => void`              | Reset zoom to 100%.                        |

### Mode

| Method    | Signature                    | Description                                                   |
| --------- | ---------------------------- | ------------------------------------------------------------- |
| `getMode` | `() => ViewerMode`           | Get the current viewer mode.                                  |
| `setMode` | `(mode: ViewerMode) => void` | Switch mode (`'preview'`, `'edit'`, `'present'`, `'master'`). |

### Read-only State

| Method                | Signature                 | Description                               |
| --------------------- | ------------------------- | ----------------------------------------- |
| `getActiveSlideIndex` | `() => number`            | Get the zero-based active slide index.    |
| `setActiveSlideIndex` | `(index: number) => void` | Set the active slide (alias of `goTo`).   |
| `getSlideCount`       | `() => number`            | Get the total number of slides.           |
| `isDirty`             | `() => boolean`           | Whether the document has unsaved changes. |

### Slide Access

All slide methods return full `PptxSlide` objects from `pptx-viewer-core` with complete type
information (elements, notes, transitions, animations, etc.).

| Method           | Signature                                   | Description                      |
| ---------------- | ------------------------------------------- | -------------------------------- |
| `getSlides`      | `() => readonly PptxSlide[]`                | Get all slides in the deck.      |
| `getSlide`       | `(index: number) => PptxSlide \| undefined` | Get a slide by zero-based index. |
| `getActiveSlide` | `() => PptxSlide \| undefined`              | Get the currently active slide.  |

### Slide Manipulation

| Method             | Signature                            | Description                                    |
| ------------------ | ------------------------------------ | ---------------------------------------------- |
| `addSlide`         | `(afterIndex?: number) => void`      | Add a blank slide (after active by default).   |
| `deleteSlides`     | `(indexes: number[]) => void`        | Delete slides at indexes (keeps at least one). |
| `duplicateSlides`  | `(indexes: number[]) => void`        | Duplicate slides at indexes.                   |
| `moveSlide`        | `(from: number, to: number) => void` | Move a slide from one position to another.     |
| `toggleHideSlides` | `(indexes: number[]) => void`        | Toggle the hidden flag on slides.              |

### Element Access

All element methods return full `PptxElement` objects (discriminated union of text, shape, image,
table, chart, connector, group, etc.) with complete type-specific properties.

| Method           | Signature                                                       | Description                             |
| ---------------- | --------------------------------------------------------------- | --------------------------------------- |
| `getElements`    | `(slideIndex?: number) => readonly PptxElement[]`               | Get elements (active slide by default). |
| `getElementById` | `(id: string, slideIndex?: number) => PptxElement \| undefined` | Get element by ID.                      |

### Element Manipulation

| Method             | Signature                                             | Description                        |
| ------------------ | ----------------------------------------------------- | ---------------------------------- |
| `updateElement`    | `(id: string, updates: Partial<PptxElement>) => void` | Patch element properties.          |
| `deleteElements`   | `(ids: string[]) => void`                             | Delete elements by ID.             |
| `duplicateElement` | `(id: string) => string \| undefined`                 | Duplicate; returns new element ID. |

### Selection

| Method                  | Signature                 | Description                             |
| ----------------------- | ------------------------- | --------------------------------------- |
| `getSelectedElementIds` | `() => string[]`          | Get IDs of currently selected elements. |
| `selectElements`        | `(ids: string[]) => void` | Programmatically select elements by ID. |
| `clearSelection`        | `() => void`              | Clear the current selection.            |

## Example: external controls

```tsx
function Toolbar({ viewerRef }: { viewerRef: React.RefObject<PowerPointViewerHandle> }) {
	const slide = viewerRef.current?.getActiveSlide();

	return (
		<div>
			<button onClick={() => viewerRef.current?.goPrev()}>Prev</button>
			<button onClick={() => viewerRef.current?.goNext()}>Next</button>
			<span>Slide {(viewerRef.current?.getActiveSlideIndex() ?? 0) + 1}</span>
			<span>{slide?.elements.length} elements</span>
			<button onClick={() => viewerRef.current?.zoomIn()}>Zoom In</button>
			<button onClick={() => viewerRef.current?.zoomOut()}>Zoom Out</button>
			<button onClick={() => viewerRef.current?.undo()} disabled={!viewerRef.current?.canUndo()}>
				Undo
			</button>
			<button onClick={() => viewerRef.current?.addSlide()}>Add Slide</button>
		</div>
	);
}
```

## Example: reading slide data

```tsx
function SlideInspector({ viewerRef }: { viewerRef: React.RefObject<PowerPointViewerHandle> }) {
	const slides = viewerRef.current?.getSlides() ?? [];

	return (
		<ul>
			{slides.map((slide, i) => (
				<li key={slide.id}>
					Slide {i + 1}: {slide.elements.length} elements
					{slide.hidden && ' (hidden)'}
				</li>
			))}
		</ul>
	);
}
```

::: tip getContent vs onContentChange
`getContent()` is a pull API: serialize on demand, e.g. when a Save button is clicked.
`onContentChange` is a push callback that fires with fresh bytes as the document changes. Use
whichever fits your save model; they return equivalent `Uint8Array` content.
:::

## Openable file kinds {#openable-file-kinds}

The package root re-exports the shared answer to "can the viewer open this file?", so a host's
drop target and its `<input accept>` cannot disagree with the loader. Hand-rolled `endsWith`
chains drift: every demo in this repo once shipped `.pptx,.ppt,.json`, which refused on drop a
`.pptm` that **File > Open** inside the viewer accepted without complaint.

```ts
import {
	PPTX_OPEN_ACCEPT,
	PRESENTATION_OPEN_EXTENSIONS,
	isSupportedPresentationFile,
	isLegacyBinaryPresentation,
	presentationBaseName,
	savedPresentationFileName,
	type SavedPresentationFormat,
} from 'pptx-react-viewer';
```

| Export                         | Type                                                                  | Description                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `PPTX_OPEN_ACCEPT`             | `string`                                                              | Ready-made `<input type="file" accept>` value: `.pptx,.ppsx,.pptm,.potx,.ppt,.json`.                                  |
| `PRESENTATION_OPEN_EXTENSIONS` | `readonly string[]`                                                   | The same list unjoined, for a drop target that wants to test extensions itself.                                       |
| `isSupportedPresentationFile`  | `(name?: string \| null) => boolean`                                  | Cheap pre-filter for a picked or dropped file name. Extension-only; the real answer is the loader's sniff.            |
| `isLegacyBinaryPresentation`   | `(name?: string \| null) => boolean`                                  | True for the binary PowerPoint 97-2003 family (`.ppt` / `.pps` / `.pot`), which the viewer reads but never writes.    |
| `presentationBaseName`         | `(name?: string \| null, fallback?: string) => string`                | The file-name stem, directories and any loadable extension removed (a path like `decks/report.ppt` becomes `report`). |
| `savedPresentationFileName`    | `(name?: string \| null, format?: SavedPresentationFormat) => string` | The name a saved copy should be offered under: `report.ppt` becomes `report.pptx`.                                    |
| `SavedPresentationFormat`      | `'pptx' \| 'ppsx' \| 'pptm'`                                          | The formats the save path can produce. Binary `.ppt` is deliberately absent: output is always OpenXML.                |

`savedPresentationFileName` is the one that matters on Save As. Output is always an OpenXML
package, so keeping a legacy source extension would hand the user a `.ppt` whose bytes are a ZIP,
which PowerPoint refuses to open.
