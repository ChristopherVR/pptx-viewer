---
title: Imperative Handle
description: The PowerPointViewerExpose defineExpose API provides programmatic access to navigation, undo/redo, zoom, mode, selection, and content serialization.
---

# Imperative Handle

`PowerPointViewer` exposes an imperative API via Vue's `defineExpose`, retrievable through a
template ref typed as `PowerPointViewerExpose`.

```vue
<script setup lang="ts">
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
import { ref } from 'vue';

const props = defineProps<{ content: Uint8Array }>();
const viewer = ref<PowerPointViewerExpose>();

async function save(): Promise<void> {
	const bytes = await viewer.value?.getContent();
	if (bytes) {
		// persist `bytes` (a Uint8Array)
	}
}
</script>

<template>
	<button @click="save">Save</button>
	<button @click="viewer?.goNext()">Next Slide</button>
	<button @click="viewer?.undo()">Undo</button>
	<PowerPointViewer ref="viewer" :content="props.content" can-edit />
</template>
```

## Interface

`PowerPointViewerExpose` extends the shared `PowerPointViewerAPI` contract (defined in
`pptx-viewer-shared`) plus `getContent`. All three framework bindings (React, Vue, Angular) expose
the same API surface; React reaches it through `forwardRef` + `PowerPointViewerHandle`, Vue through
`defineExpose`, Angular through public component methods.

```ts
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import type { ViewerMode, PowerPointViewerAPI } from 'pptx-viewer-shared';
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
| `setZoom`   | `(level: number) => void` | Set the zoom level (clamped to 0.2 - 3.0). |
| `zoomIn`    | `() => void`              | Zoom in by one step (10%).                 |
| `zoomOut`   | `() => void`              | Zoom out by one step (10%).                |
| `zoomReset` | `() => void`              | Reset zoom to 100%.                        |

::: info Zoom range differs slightly from React
The Vue viewer clamps zoom to `0.2` - `3.0` (300%); the React viewer clamps to `0.2` - `5.0` (500%).
:::

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

```vue
<script setup lang="ts">
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import { computed } from 'vue';

const props = defineProps<{ viewer: PowerPointViewerExpose | undefined }>();
const slide = computed(() => props.viewer?.getActiveSlide());
</script>

<template>
	<div>
		<button @click="viewer?.goPrev()">Prev</button>
		<button @click="viewer?.goNext()">Next</button>
		<span>Slide {{ (viewer?.getActiveSlideIndex() ?? 0) + 1 }}</span>
		<span>{{ slide?.elements.length }} elements</span>
		<button @click="viewer?.zoomIn()">Zoom In</button>
		<button @click="viewer?.zoomOut()">Zoom Out</button>
		<button :disabled="!viewer?.canUndo()" @click="viewer?.undo()">Undo</button>
		<button @click="viewer?.addSlide()">Add Slide</button>
	</div>
</template>
```

::: tip getContent vs @content-change
`getContent()` is a pull API: serialize on demand, e.g. when a Save button is clicked.
`@content-change` is a push event that fires with fresh bytes as the document changes. Use whichever
fits your save model; they return equivalent `Uint8Array` content.
:::
