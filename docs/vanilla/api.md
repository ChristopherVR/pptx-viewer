---
title: Viewer Instance API
description: The PptxViewerInstance returned by createPptxViewer - loading, navigation, zoom, modes, editing, saving, export and print, the slide/element data API, collaboration, autosave, the renderer registry, the core-handler escape hatch, and destroy.
---

# Viewer Instance API

`createPptxViewer` returns a `PptxViewerInstance`, the imperative equivalent of the other bindings'
template refs / handles. All toolbar operations are also available as instance methods, so you can
hide the chrome (`showToolbar: false`, `showThumbnails: false`) and drive the viewer from your
own UI. The interface extends the shared `PowerPointViewerAPI` implemented by every binding, so the
`getContent` / `goTo` / `getSlides`-style methods below match the React, Vue, and Angular handles.

```ts
import { createPptxViewer, type PptxViewerInstance } from 'pptx-vanilla-viewer';

const viewer: PptxViewerInstance = createPptxViewer(host, { source });
```

## Loading {#loading}

| Method     | Signature                                                    | Description                                                               |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `loadFile` | `(file: Blob \| ArrayBuffer \| Uint8Array) => Promise<void>` | Load a presentation from bytes or a Blob/File (replaces the current one). |
| `loadUrl`  | `(url: string) => Promise<void>`                             | Fetch and load a presentation from a URL.                                 |

Both resolve once the presentation is rendered; failures surface through the `onError` callback.

## Navigation

| Method                                       | Signature                 | Description                                                |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| `next` / `goNext`                            | `() => void`              | Go to the next slide (no-op on the last slide).            |
| `prev` / `goPrev`                            | `() => void`              | Go to the previous slide (no-op on the first slide).       |
| `goToSlide` / `goTo` / `setActiveSlideIndex` | `(index: number) => void` | Jump to a zero-based slide index (clamped).                |
| `getSlideCount`                              | `() => number`            | Number of slides in the loaded presentation (0 when none). |
| `getCurrentSlide` / `getActiveSlideIndex`    | `() => number`            | Zero-based index of the visible slide.                     |

The aliases (`goTo`, `goPrev`, `goNext`, `getActiveSlideIndex`, `setActiveSlideIndex`) come from the
shared `PowerPointViewerAPI` and behave identically to the vanilla-native names.

## Zoom

| Method      | Signature                | Description                                            |
| ----------- | ------------------------ | ------------------------------------------------------ |
| `getZoom`   | `() => number`           | Effective zoom scale (1 = 100%), after fit resolution. |
| `setZoom`   | `(zoom: number) => void` | Set an explicit zoom scale.                            |
| `zoomIn`    | `() => void`             | Zoom in by one step.                                   |
| `zoomOut`   | `() => void`             | Zoom out by one step.                                  |
| `zoomToFit` | `() => void`             | Fit the slide to the viewport.                         |
| `zoomReset` | `() => void`             | Reset zoom to 100%.                                    |

## Viewer mode

| Method    | Signature                    | Description                           |
| --------- | ---------------------------- | ------------------------------------- |
| `getMode` | `() => ViewerMode`           | The current mode, derived from state. |
| `setMode` | `(mode: ViewerMode) => void` | Switch mode; see the mapping below.   |

```ts
type ViewerMode = 'preview' | 'edit' | 'present' | 'master';
```

`setMode('present')` enters presentation mode; `'edit'` enables editing; `'master'` enables editing
and switches to the master view; `'preview'` leaves presentation/master mode and disables editing.

## Theming & localization {#theming--localization}

| Method      | Signature                                   | Description                                                                                        |
| ----------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `setTheme`  | `(theme: ViewerTheme \| undefined) => void` | Apply a new viewer theme (pass `undefined` to reset to defaults). See [Theming](/vanilla/theming). |
| `setLocale` | `(locale: string) => void`                  | Switch the UI locale (rebuilds the chrome labels).                                                 |

## Presentation mode

| Method              | Signature             | Description                                    |
| ------------------- | --------------------- | ---------------------------------------------- |
| `enterPresentation` | `() => Promise<void>` | Enter presentation mode (real Fullscreen API). |
| `exitPresentation`  | `() => Promise<void>` | Exit presentation mode (Esc also exits).       |

Entering and leaving fires the `onPresentationChange` callback.

## Editing {#editing}

Pass `editable: true` in the options (or call `setEditable(true)`) to turn on click-to-select,
drag-to-move, resize/rotate handles, and double-click inline text editing directly in the DOM.
These methods are the programmatic entry points around that interaction:

| Method                 | Signature                     | Description                                                            |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `setEditable`          | `(editable: boolean) => void` | Enable or disable editing at runtime (disabling clears the selection). |
| `setEditTemplateMode`  | `(enabled: boolean) => void`  | Target inherited master/layout elements on the current slide.          |
| `undo`                 | `() => void`                  | Undo the last edit (no-op when the undo stack is empty).               |
| `redo`                 | `() => void`                  | Redo the last undone edit (no-op when the redo stack is empty).        |
| `canUndo` / `canRedo`  | `() => boolean`               | Whether `undo()` / `redo()` would do anything.                         |
| `deleteSelected`       | `() => void`                  | Delete the selected element (no-op without a selection).               |
| `getSelectedElementId` | `() => string \| null`        | Id of the selected element, or `null`.                                 |
| `isDirty`              | `() => boolean`               | Whether the document has unsaved changes.                              |

`onChange` fires after any mutation (move, resize, rotate, text edit, delete, undo, redo);
`onDirtyChange` fires when the unsaved-edits flag flips; `onSelectionChange` fires when the
selected element id changes.

Keyboard shortcuts, active whenever an element is selected and editing is enabled: `Ctrl`/`Cmd+Z`
undo, `Ctrl`/`Cmd+Shift+Z` (or `Ctrl+Y`) redo, `Delete`/`Backspace` delete, `Ctrl`/`Cmd+D`
duplicate, arrow keys nudge 1px (`Shift`+arrow for 10px), `Escape` deselect.

## Saving & downloads

| Method              | Signature                                                      | Description                                                                      |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | Serialise the (edited) presentation (default `'pptx'`) and clear the dirty flag. |
| `getContent`        | `() => Promise<Uint8Array>`                                    | Alias of `save()`: the serialized `.pptx` bytes (shared-API name).               |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | Save and trigger a browser download in a supported OpenXML format.               |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | `save()` plus trigger a browser download (default `presentation.pptx`).          |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | Bundle the current presentation and usage notes in a shareable ZIP download.     |

```ts
type PptxSaveFormat = 'pptx' | 'ppsx' | 'pptm';
```

```ts
const viewer = createPptxViewer(host, { source, editable: true });

undoButton.addEventListener('click', () => viewer.undo());
redoButton.addEventListener('click', () => viewer.redo());
saveButton.addEventListener('click', () => void viewer.downloadPptx('edited.pptx'));
```

## Export & print {#export--print}

Raster export renders each slide off-screen at scale 1 and rasterises it with `html2canvas-pro`
(dynamically imported, so the first call pays a one-time load cost). `jspdf` and the GIF encoder are
also lazy-loaded. Only one export runs at a time; a call while one is in flight resolves as a no-op.

| Method             | Signature                                         | Description                                                                                          |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `exportSlidePng`   | `(index?: number) => Promise<void>`               | Export a slide as a PNG download (defaults to the current slide).                                    |
| `copySlideAsImage` | `(index?: number) => Promise<void>`               | Copy a slide to the system clipboard as a PNG image.                                                 |
| `exportPdf`        | `(options?: ExportPdfOptions) => Promise<void>`   | Export every slide as a multi-page PDF download (one slide per page).                                |
| `exportGif`        | `(options?: ExportGifOptions) => Promise<void>`   | Export every slide as an animated GIF download (one frame per slide, shared pure-JS GIF89a encoder). |
| `exportVideo`      | `(options?: ExportVideoOptions) => Promise<void>` | Export every slide as a WebM video download (canvas stream recorded by `MediaRecorder`).             |
| `print`            | `(options?: PrintOptions) => Promise<boolean>`    | Assemble the printable document and open it in a print window; `false` = popup blocked.              |

All option interfaces are exported from the package root:

```ts
type ExportProgress = (current: number, total: number) => void;

interface ExportPdfOptions {
	onProgress?: ExportProgress; // capture-phase progress: (currentSlide, totalSlides)
	signal?: AbortSignal; // abort early; checked between slides
}

interface ExportGifOptions {
	slideDurationMs?: number; // per-frame duration, default 2000
	slideTimingsMs?: number[]; // per-slide overrides (e.g. rehearsed timings)
	maxDimension?: number; // cap on the longer frame side, default 1920
	onProgress?: ExportProgress;
	signal?: AbortSignal;
}

interface ExportVideoOptions {
	slideDurationMs?: number; // per-slide hold, default 3000
	slideTimingsMs?: number[]; // per-slide overrides
	fps?: number; // recording frame rate, default 30
	videoBitsPerSecond?: number; // MediaRecorder bitrate, default 5,000,000
	onProgress?: ExportProgress; // capture phase
	onRecordProgress?: ExportProgress; // recording phase
	signal?: AbortSignal;
}
```

Downloads are named `presentation-slide-<n>.png`, `presentation.pdf`, `presentation.gif`, and
`presentation.webm`. Aborting via `signal` rejects with an `AbortError` `DOMException`.

### Print

`print()` covers slides, notes pages, handouts, and an outline view, assembled from the shared
print module. `PrintOptions` is any subset of the shared `PrintSettings` (unspecified fields fall
back to the defaults: all slides, landscape, full colour) plus progress/abort and a window
override:

```ts
interface PrintOptions extends Partial<PrintSettings> {
	onProgress?: ExportProgress;
	signal?: AbortSignal;
	openPrintWindow?: (htmlDocument: string) => boolean; // OpenPrintWindow
}

interface PrintSettings {
	printWhat: 'slides' | 'handouts' | 'notes' | 'outline'; // default 'slides'
	orientation: 'portrait' | 'landscape'; // default 'landscape'
	colorMode: 'color' | 'grayscale' | 'blackAndWhite'; // default 'color'
	frameSlides: boolean; // default false
	slidesPerPage: 1 | 2 | 3 | 4 | 6 | 9; // handouts only, default 6
	slideRange: 'all' | 'current' | 'custom'; // default 'all'
	customRangeFrom: number; // 1-based, default 1
	customRangeTo: number; // 1-based, default 1
}
```

::: warning Popup blockers
The default opener uses `window.open`, which browsers typically only allow inside a user gesture:
call `print()` from a click handler, or pass a custom `openPrintWindow` that writes into an iframe
you own. When the popup is blocked the promise resolves `false`.
:::

### SVG export (standalone functions)

Vector export does not need the viewer instance; two pure functions work on the parsed core data
(reach it via `getHandler()` or `getSlides()`):

```ts
import { exportSlideToSvg, exportAllSlidesToSvg } from 'pptx-vanilla-viewer';

exportSlideToSvg(slide, width, height, options?): string; // one slide as SVG markup
exportAllSlidesToSvg(data, options?): string[]; // PptxData in, one SVG string per slide

interface SvgExportOptions {
	includeHidden?: boolean; // include hidden slides when exporting all, default false
	slideIndices?: number[]; // 0-based subset; omitted = all slides
	defaultFontFamily?: string;
	defaultFontSize?: number; // points
}
```

## Slides & elements (data API)

The shared data surface for hosts that build their own UI. Slide getters return the actual typed
`PptxSlide[]` / `PptxElement[]` model as read-only snapshots; mutations only flow back through the
manipulation methods (which participate in undo/redo and fire `onChange`).

| Method                  | Signature                                                              | Description                                                      |
| ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `getSlides`             | `() => readonly PptxSlide[]`                                           | The full slide array.                                            |
| `getSlide`              | `(index: number) => PptxSlide \| undefined`                            | One slide by zero-based index.                                   |
| `getActiveSlide`        | `() => PptxSlide \| undefined`                                         | The currently active slide.                                      |
| `addSlide`              | `(afterIndex?: number) => void`                                        | Add a blank slide after the given index (default: at the end).   |
| `deleteSlides`          | `(indexes: number[]) => void`                                          | Delete slides at the given indexes (at least one slide is kept). |
| `duplicateSlides`       | `(indexes: number[]) => void`                                          | Duplicate slides at the given indexes.                           |
| `moveSlide`             | `(fromIndex: number, toIndex: number) => void`                         | Move a slide to a new position.                                  |
| `toggleHideSlides`      | `(indexes: number[]) => void`                                          | Toggle the hidden flag on slides.                                |
| `getElements`           | `(slideIndex?: number) => readonly PptxElement[]`                      | Elements on a slide (default: active slide).                     |
| `getElementById`        | `(elementId: string, slideIndex?: number) => PptxElement \| undefined` | One element by id.                                               |
| `updateElement`         | `(elementId: string, updates: Partial<PptxElement>) => void`           | Patch element properties (e.g. `{ x: 100, width: 300 }`).        |
| `deleteElements`        | `(elementIds: string[]) => void`                                       | Delete elements by id from the active slide.                     |
| `duplicateElement`      | `(elementId: string) => string \| undefined`                           | Duplicate an element; returns the new element's id.              |
| `getSelectedElementIds` | `() => string[]`                                                       | Ids of the currently selected elements.                          |
| `selectElements`        | `(ids: string[]) => void`                                              | Programmatically select elements.                                |
| `clearSelection`        | `() => void`                                                           | Clear the selection.                                             |

## Collaboration {#collaboration}

| Method                   | Signature                                        | Description                                                                                                                 |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `startCollaboration`     | `(config: CollaborationConfig) => Promise<void>` | Start (or restart) a real-time session; resolves once the transport is created. Status arrives via `onCollaborationStatus`. |
| `stopCollaboration`      | `() => void`                                     | Stop the active session (no-op when none is running).                                                                       |
| `getCollaborationStatus` | `() => ConnectionStatus`                         | Current status: `'disconnected' \| 'connecting' \| 'connected' \| 'error'` (`'disconnected'` when inactive).                |

See [Options](/vanilla/options#collaboration) for `CollaborationConfig` and the wire-format caveat.

## Autosave {#autosave}

| Method               | Signature                    | Description                                                    |
| -------------------- | ---------------------------- | -------------------------------------------------------------- |
| `autosaveNow`        | `() => Promise<void>`        | Force an immediate snapshot (no-op when autosave is disabled). |
| `setAutosaveEnabled` | `(enabled: boolean) => void` | Enable or disable recovery autosave without rebuilding.        |
| `isAutosaveEnabled`  | `() => boolean`              | Whether recovery autosave is currently enabled.                |

## Extension & escape hatches

| Method        | Signature                       | Description                                                                                             |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `getRegistry` | `() => ElementRendererRegistry` | The element-renderer registry in effect (extension point). See [Element Renderers](/vanilla/renderers). |
| `getHandler`  | `() => PptxHandler \| null`     | The live `pptx-viewer-core` handler for the loaded file (or `null`).                                    |

### Core escape hatch {#core-escape-hatch}

`getHandler()` exposes the full [`pptx-viewer-core`](/core/) `PptxHandler` behind the viewer, which
allows operations the viewer itself does not surface: convert the deck to Markdown or read parts
of the underlying archive. (For plain serialisation prefer the instance's own `save()` /
`getContent()`, which also clear the dirty flag.)

```ts
const handler = viewer.getHandler();
if (handler) {
	const bytes = await handler.save(handler.pptxData!.slides); // Uint8Array
}
```

## Teardown

| Method    | Signature    | Description                                                |
| --------- | ------------ | ---------------------------------------------------------- |
| `destroy` | `() => void` | Tear down DOM, listeners, Blob URLs, and the core handler. |

## Example: external controls

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/deck.pptx',
	showToolbar: false,
	showThumbnails: false,
	onSlideChange: (i) => {
		counter.textContent = `Slide ${i + 1} of ${viewer.getSlideCount()}`;
	},
});

prevButton.addEventListener('click', () => viewer.prev());
nextButton.addEventListener('click', () => viewer.next());
fitButton.addEventListener('click', () => viewer.zoomToFit());
presentButton.addEventListener('click', () => void viewer.enterPresentation());
pdfButton.addEventListener('click', () => void viewer.exportPdf());
```
