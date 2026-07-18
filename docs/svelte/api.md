---
title: Svelte Viewer Instance API
description: The PowerPointViewerApi surface exposed on the component instance via bind:this - navigation, zoom, modes, slide and element manipulation, selection, editing, save, and export.
---

# Instance API

The component instance obtained through `bind:this` implements `PowerPointViewerApi`: the
shared cross-binding viewer contract (the same one behind React's ref handle and Vue's
`defineExpose`) plus the Svelte binding's editing and export methods. All toolbar operations are
also available as instance methods, so you can hide the chrome (`showToolbar={false}`,
`showThumbnails={false}`) and drive the viewer from your own UI.

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
</script>

<PowerPointViewer source={bytes} bind:this={viewer} />
```

::: info Snapshots, not stores
The getter methods (`canUndo()`, `getZoom()`, `getSelectedElementIds()`, ...) return plain
snapshots; they are not reactive stores. To react to changes, use the callback props
(`onzoomchange`, `onselectionchange`, `ondirtychange`, ...) from
[Component Props](/svelte/props#event-callbacks).
:::

## Serialisation

| Method       | Signature                   | Description                                                              |
| ------------ | --------------------------- | ------------------------------------------------------------------------ |
| `getContent` | `() => Promise<Uint8Array>` | Serialise the current presentation to `.pptx` bytes (alias of `save()`). |

## Navigation

| Method                | Signature                 | Description                                  |
| --------------------- | ------------------------- | -------------------------------------------- |
| `goTo`                | `(index: number) => void` | Jump to a zero-based slide index (clamped).  |
| `goPrev`              | `() => void`              | Go to the previous slide.                    |
| `goNext`              | `() => void`              | Go to the next slide.                        |
| `getActiveSlideIndex` | `() => number`            | Zero-based index of the visible slide.       |
| `setActiveSlideIndex` | `(index: number) => void` | Alias of `goTo`.                             |
| `getSlideCount`       | `() => number`            | Number of slides in the loaded presentation. |

## Zoom

| Method      | Signature                 | Description                           |
| ----------- | ------------------------- | ------------------------------------- |
| `getZoom`   | `() => number`            | Effective zoom scale (1 = 100%).      |
| `setZoom`   | `(level: number) => void` | Set an explicit zoom scale (clamped). |
| `zoomIn`    | `() => void`              | Zoom in by one step.                  |
| `zoomOut`   | `() => void`              | Zoom out by one step.                 |
| `zoomReset` | `() => void`              | Reset zoom to 100%.                   |

## Mode and presentation

| Method    | Signature                    | Description                                                                                                                                    |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMode` | `() => ViewerMode`           | Current mode: `'preview' \| 'edit' \| 'present' \| 'master'`.                                                                                  |
| `setMode` | `(mode: ViewerMode) => void` | Switch mode. `'present'` enters fullscreen presentation (real Fullscreen API); any other mode exits it. `'edit'` and `'master'` imply editing. |

```ts
viewer?.setMode('present'); // start presenting; Esc exits
```

## Slide access and manipulation

| Method             | Signature                                      | Description                                                 |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `getSlides`        | `() => readonly PptxSlide[]`                   | The full slide array (snapshot with full type information). |
| `getSlide`         | `(index: number) => PptxSlide \| undefined`    | A single slide by zero-based index.                         |
| `getActiveSlide`   | `() => PptxSlide \| undefined`                 | The currently active slide.                                 |
| `addSlide`         | `(afterIndex?: number) => void`                | Add a blank slide after the given index (or at the end).    |
| `deleteSlides`     | `(indexes: number[]) => void`                  | Delete slides by index (at least one slide is kept).        |
| `duplicateSlides`  | `(indexes: number[]) => void`                  | Duplicate slides at the given indexes.                      |
| `moveSlide`        | `(fromIndex: number, toIndex: number) => void` | Move a slide to a new position.                             |
| `toggleHideSlides` | `(indexes: number[]) => void`                  | Toggle the hidden flag on slides.                           |
| `isDirty`          | `() => boolean`                                | Whether the document has unsaved changes.                   |

## Element access and manipulation

| Method             | Signature                                                       | Description                                              |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------- |
| `getElements`      | `(slideIndex?: number) => readonly PptxElement[]`               | Elements on a slide (defaults to the active slide).      |
| `getElementById`   | `(id: string, slideIndex?: number) => PptxElement \| undefined` | A single element by id.                                  |
| `updateElement`    | `(id: string, updates: Partial<PptxElement>) => void`           | Patch element properties, e.g. `{ x: 100, width: 300 }`. |
| `deleteElements`   | `(ids: string[]) => void`                                       | Delete elements by id from the active slide.             |
| `duplicateElement` | `(id: string) => string \| undefined`                           | Duplicate an element; returns the new element's id.      |

## Selection

| Method                  | Signature                 | Description                                 |
| ----------------------- | ------------------------- | ------------------------------------------- |
| `getSelectedElementIds` | `() => string[]`          | Ids of the currently selected elements.     |
| `selectElements`        | `(ids: string[]) => void` | Programmatically select elements.           |
| `clearSelection`        | `() => void`              | Clear the selection.                        |
| `getSelectedElementId`  | `() => string \| null`    | The selected top-level element id, or null. |

## Editing {#editing}

Active when `editable` is set (see [Getting Started > Editing](/svelte/getting-started#editing)).

| Method              | Signature                                                      | Description                                                          |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `undo`              | `() => void`                                                   | Undo the last committed edit.                                        |
| `redo`              | `() => void`                                                   | Redo the last undone edit.                                           |
| `canUndo`           | `() => boolean`                                                | Whether an undo step is available (snapshot; not reactive).          |
| `canRedo`           | `() => boolean`                                                | Whether a redo step is available.                                    |
| `deleteSelected`    | `() => void`                                                   | Delete the selected element (no-op when nothing is selected).        |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | Serialise the edited slides to bytes (`'pptx' \| 'ppsx' \| 'pptm'`). |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | Save + trigger a browser download in the given format.               |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | Save + download as `.pptx` (default name).                           |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | Assemble and download the sharing package.                           |

Keyboard shortcuts, active whenever editing is enabled: `Ctrl`/`Cmd+Z` undo,
`Ctrl`/`Cmd+Shift+Z` redo, `Delete`/`Backspace` delete, `Ctrl`/`Cmd+D` duplicate, arrow keys
nudge (with `Shift` for larger steps), `Escape` deselect.

## Export and print

| Method             | Signature                                         | Description                                                          |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------- |
| `exportSlidePng`   | `(index?: number) => Promise<void>`               | Export a slide as a PNG download (defaults to the current slide).    |
| `copySlideAsImage` | `(index?: number) => Promise<void>`               | Copy a slide to the system clipboard as a PNG image.                 |
| `exportPdf`        | `(options?: ExportPdfOptions) => Promise<void>`   | Multi-page PDF download, one slide per page.                         |
| `exportGif`        | `(options?: ExportGifOptions) => Promise<void>`   | Animated GIF download.                                               |
| `exportVideo`      | `(options?: ExportVideoOptions) => Promise<void>` | WebM video download.                                                 |
| `print`            | `(options?: PrintOptions) => Promise<boolean>`    | Open the browser print dialog (slides / handouts / notes / outline). |

See [Export & Print](/svelte/export) for the option shapes, pipelines, and the standalone SVG
export functions.

## Example: external controls

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
	let current = $state(0);
	let count = $state(0);
</script>

<PowerPointViewer
	source={bytes}
	showToolbar={false}
	showThumbnails={false}
	bind:this={viewer}
	onload={({ slideCount }) => (count = slideCount)}
	onslidechange={(index) => (current = index)}
/>

<div>
	<button onclick={() => viewer?.goPrev()}>Prev</button>
	<span>Slide {current + 1} of {count}</span>
	<button onclick={() => viewer?.goNext()}>Next</button>
	<button onclick={() => viewer?.setMode('present')}>Present</button>
</div>
```

## Lower-level building blocks

The `pptx-svelte-viewer/viewer` entry point additionally exports the viewer's internal
framework-free state helpers (`ViewerState`, `PresentationLoader`, `clampSlideIndex`,
`fitScale`, `resolveNavigationKey`, `zoomInPercent`, `zoomOutPercent`) for hosts building
custom chrome on the same primitives. These are lower-level than the component API and not
needed for typical embedding.
