---
title: Public API
description: The methods exposed on the PowerPointViewerComponent instance for programmatic navigation, undo/redo, zoom, mode, selection, and content serialization.
---

# Public API

Angular has no `forwardRef` imperative handle the way React does. Instead,
`PowerPointViewerComponent`'s programmatic API is just **public methods on the component instance**,
reached through a template reference variable or Angular's `viewChild()` signal query.

```ts
import { Component, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-editor',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<button (click)="save()">Save</button>
		<button (click)="viewer().goNext()">Next Slide</button>
		<button (click)="viewer().undo()">Undo</button>
		<pptx-viewer #viewer [content]="content" [canEdit]="true" />
	`,
})
export class EditorComponent {
	readonly viewer = viewChild.required(PowerPointViewerComponent);

	async save(): Promise<void> {
		const bytes = await this.viewer().getContent();
		// persist `bytes` (a Uint8Array)
	}
}
```

::: tip Template reference vs `viewChild`
`#viewer` in the template plus `@ViewChild(PowerPointViewerComponent) viewer!: PowerPointViewerComponent`
works too (see the package README); `viewChild()` is the modern signal-based equivalent used above.
Either way you get the same component instance and the same methods.
:::

## Contract shared across bindings

The methods below implement the same `PowerPointViewerAPI` contract (defined in
`pptx-viewer-shared`) that React's `PowerPointViewerHandle` and Vue's `defineExpose` surface also
implement - all three framework bindings expose an equivalent API surface, just through each
framework's own idiom (React `forwardRef` handle, Vue `defineExpose`, Angular public methods).

```ts
import type { PowerPointViewerAPI, ViewerMode } from 'pptx-angular-viewer';
```

## Methods

### Serialization

| Method       | Signature                   | Description                                                                                                                   |
| ------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | Serialises the current document to `.pptx` bytes on demand. When editing, serialises the edited deck (templates merged back). |

### Navigation

| Method   | Signature                 | Description                                                         |
| -------- | ------------------------- | ------------------------------------------------------------------- |
| `goTo`   | `(index: number) => void` | Navigate to a specific slide (zero-based). No-op when out of range. |
| `goPrev` | `() => void`              | Navigate to the previous slide.                                     |
| `goNext` | `() => void`              | Navigate to the next slide.                                         |

### Undo / Redo

| Method    | Signature       | Description                                               |
| --------- | --------------- | --------------------------------------------------------- |
| `undo`    | `() => void`    | Undo the last editing action. No-op when nothing to undo. |
| `redo`    | `() => void`    | Redo the last undone action.                              |
| `canUndo` | `() => boolean` | Whether an undo action is available.                      |
| `canRedo` | `() => boolean` | Whether a redo action is available.                       |

### Zoom

| Method      | Signature                 | Description                                |
| ----------- | ------------------------- | ------------------------------------------ |
| `getZoom`   | `() => number`            | Get the current zoom level (1 = 100%).     |
| `setZoom`   | `(level: number) => void` | Set the zoom level (clamped to 0.2 - 3.0). |
| `zoomIn`    | `() => void`              | Zoom in by one step.                       |
| `zoomOut`   | `() => void`              | Zoom out by one step.                      |
| `zoomReset` | `() => void`              | Reset zoom to 100%.                        |

### Mode

| Method    | Signature                | Description                                                                                                                                     |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMode` | `() => string`           | Get the current viewer mode: `'preview'`, `'edit'`, `'present'`, or `'master'`.                                                                 |
| `setMode` | `(mode: string) => void` | Switch mode programmatically. `'present'` enters slideshow, `'master'` enters template-edit mode, anything else returns to normal preview/edit. |

### Read-only state

| Method                | Signature                 | Description                               |
| --------------------- | ------------------------- | ----------------------------------------- |
| `getActiveSlideIndex` | `() => number`            | Get the zero-based active slide index.    |
| `setActiveSlideIndex` | `(index: number) => void` | Set the active slide (alias of `goTo`).   |
| `getSlideCount`       | `() => number`            | Get the total number of slides.           |
| `isDirty`             | `() => boolean`           | Whether the document has unsaved changes. |

### Slide access

Slide methods return full `PptxSlide` objects from `pptx-viewer-core` with complete type information
(elements, notes, transitions, animations, etc.).

| Method           | Signature                                   | Description                      |
| ---------------- | ------------------------------------------- | -------------------------------- |
| `getSlides`      | `() => readonly PptxSlide[]`                | Get all slides in the deck.      |
| `getSlide`       | `(index: number) => PptxSlide \| undefined` | Get a slide by zero-based index. |
| `getActiveSlide` | `() => PptxSlide \| undefined`              | Get the currently active slide.  |

### Slide manipulation

| Method             | Signature                            | Description                                  |
| ------------------ | ------------------------------------ | -------------------------------------------- |
| `addSlide`         | `(afterIndex?: number) => void`      | Add a blank slide (after active by default). |
| `deleteSlides`     | `(indexes: number[]) => void`        | Delete slides at indexes.                    |
| `duplicateSlides`  | `(indexes: number[]) => void`        | Duplicate slides at indexes.                 |
| `moveSlide`        | `(from: number, to: number) => void` | Move a slide from one position to another.   |
| `toggleHideSlides` | `(indexes: number[]) => void`        | Toggle the hidden flag on slides.            |

### Element access

Element methods return full `PptxElement` objects (discriminated union of text, shape, image, table,
chart, connector, group, etc.) with complete type-specific properties.

| Method           | Signature                                                              | Description                             |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| `getElements`    | `(slideIndex?: number) => readonly PptxElement[]`                      | Get elements (active slide by default). |
| `getElementById` | `(elementId: string, slideIndex?: number) => PptxElement \| undefined` | Get element by ID.                      |

### Element manipulation

| Method             | Signature                                                    | Description                        |
| ------------------ | ------------------------------------------------------------ | ---------------------------------- |
| `updateElement`    | `(elementId: string, updates: Partial<PptxElement>) => void` | Patch element properties.          |
| `deleteElements`   | `(elementIds: string[]) => void`                             | Delete elements by ID.             |
| `duplicateElement` | `(elementId: string) => string \| undefined`                 | Duplicate; returns new element ID. |

### Selection

| Method                  | Signature                 | Description                             |
| ----------------------- | ------------------------- | --------------------------------------- |
| `getSelectedElementIds` | `() => string[]`          | Get IDs of currently selected elements. |
| `selectElements`        | `(ids: string[]) => void` | Programmatically select elements by ID. |
| `clearSelection`        | `() => void`              | Clear the current selection.            |

## Example: external controls

```ts
@Component({
	template: `
		<button (click)="viewer().goPrev()">Prev</button>
		<button (click)="viewer().goNext()">Next</button>
		<span>Slide {{ viewer().getActiveSlideIndex() + 1 }}</span>
		<span>{{ viewer().getActiveSlide()?.elements?.length }} elements</span>
		<button (click)="viewer().zoomIn()">Zoom In</button>
		<button (click)="viewer().zoomOut()">Zoom Out</button>
		<button (click)="viewer().undo()" [disabled]="!viewer().canUndo()">Undo</button>
		<button (click)="viewer().addSlide()">Add Slide</button>
		<pptx-viewer #ref [content]="content" [canEdit]="true" />
	`,
})
export class ToolbarComponent {
	readonly viewer = viewChild.required(PowerPointViewerComponent, {
		read: PowerPointViewerComponent,
	});
}
```

::: tip getContent vs contentChange
`getContent()` is a pull API: serialise on demand, e.g. when a Save button is clicked.
`contentChange` is a push event that fires with fresh bytes as the document changes. Use whichever
fits your save model; they return equivalent `Uint8Array` content.
:::
