---
title: Viewer Instance API
description: The PptxViewerInstance returned by createPptxViewer - loading, navigation, zoom, theming, presentation mode, the renderer registry, the core-handler escape hatch, and destroy.
---

# Viewer Instance API

`createPptxViewer` returns a `PptxViewerInstance`, the imperative equivalent of the other bindings'
template refs / handles. Everything the built-in toolbar does is available here, so you can hide
the chrome (`showToolbar: false`, `showThumbnails: false`) and drive the viewer entirely from your
own UI.

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

| Method            | Signature                 | Description                                                |
| ----------------- | ------------------------- | ---------------------------------------------------------- |
| `next`            | `() => void`              | Go to the next slide (no-op on the last slide).            |
| `prev`            | `() => void`              | Go to the previous slide (no-op on the first slide).       |
| `goToSlide`       | `(index: number) => void` | Jump to a zero-based slide index (clamped).                |
| `getSlideCount`   | `() => number`            | Number of slides in the loaded presentation (0 when none). |
| `getCurrentSlide` | `() => number`            | Zero-based index of the visible slide.                     |

## Zoom

| Method      | Signature                   | Description                                                 |
| ----------- | --------------------------- | ----------------------------------------------------------- |
| `getZoom`   | `() => number`              | Effective zoom scale (1 = 100%), after fit resolution.      |
| `setZoom`   | `(zoom: ZoomLevel) => void` | Set an explicit zoom scale, or `'fit'` for fit-to-viewport. |
| `zoomIn`    | `() => void`                | Zoom in by one step.                                        |
| `zoomOut`   | `() => void`                | Zoom out by one step.                                       |
| `zoomToFit` | `() => void`                | Fit the slide to the viewport.                              |

```ts
type ZoomLevel = number | 'fit';
```

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

| Method                 | Signature                              | Description                                                                    |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `setEditable`          | `(editable: boolean) => void`          | Enable or disable editing at runtime (disabling clears the selection).         |
| `undo`                 | `() => void`                           | Undo the last edit (no-op when the undo stack is empty).                       |
| `redo`                 | `() => void`                           | Redo the last undone edit (no-op when the redo stack is empty).                |
| `canUndo`              | `() => boolean`                        | Whether `undo()` would do anything.                                            |
| `canRedo`              | `() => boolean`                        | Whether `redo()` would do anything.                                            |
| `deleteSelected`       | `() => void`                           | Delete the selected element (no-op without a selection).                       |
| `getSelectedElementId` | `() => string \| null`                 | Id of the selected element, or `null`.                                         |
| `save`                 | `() => Promise<Uint8Array>`            | Serialise the (edited) presentation to `.pptx` bytes and clear the dirty flag. |
| `downloadPptx`         | `(fileName?: string) => Promise<void>` | `save()` plus trigger a browser download (default `presentation.pptx`).        |

`onChange` fires after any mutation (move, resize, rotate, text edit, delete, undo, redo);
`onDirtyChange` fires when the unsaved-edits flag flips; `onSelectionChange` fires when the
selected element id changes.

Keyboard shortcuts, active whenever an element is selected and editing is enabled: `Ctrl`/`Cmd+Z`
undo, `Ctrl`/`Cmd+Shift+Z` (or `Ctrl+Y`) redo, `Delete`/`Backspace` delete, `Ctrl`/`Cmd+D`
duplicate, arrow keys nudge 1px (`Shift`+arrow for 10px), `Escape` deselect.

```ts
const viewer = createPptxViewer(host, { source, editable: true });

undoButton.addEventListener('click', () => viewer.undo());
redoButton.addEventListener('click', () => viewer.redo());
saveButton.addEventListener('click', () => void viewer.downloadPptx('edited.pptx'));
```

There is currently no property/inspector panel, add-new-element affordance, z-order/group
operation, template (master/layout) editing, or collaboration - see
[PORTING.md](https://github.com/ChristopherVR/pptx-viewer/blob/main/PORTING.md) for the tracked
gap.

## Extension & escape hatches

| Method        | Signature                       | Description                                                                                             |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `getRegistry` | `() => ElementRendererRegistry` | The element-renderer registry in effect (extension point). See [Element Renderers](/vanilla/renderers). |
| `getHandler`  | `() => PptxHandler \| null`     | The live `pptx-viewer-core` handler for the loaded file (or `null`).                                    |

### Core escape hatch {#core-escape-hatch}

`getHandler()` exposes the full [`pptx-viewer-core`](/core/) `PptxHandler` behind the viewer, which
unlocks operations the viewer itself does not surface: save the document, convert it to Markdown,
or read parts of the underlying archive.

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
```
