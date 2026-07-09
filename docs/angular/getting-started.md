---
title: Getting Started
description: Load a .pptx ArrayBuffer into pptx-viewer, render it read-only, then enable editing with dirty/content outputs.
---

# Getting Started

This page walks from a read-only viewer to an editable one, wiring a file `<input>` and the
`contentChange` / `dirtyChange` outputs.

::: tip Prerequisites
Install the package and its peer deps first - see [Overview › Installation](/angular/#installation).
:::

## 1. Read-only viewer

`PowerPointViewerComponent` is a **standalone component** with the `pptx-viewer` selector. It takes
its slide data through the `content` input as a `Uint8Array` or `ArrayBuffer` of raw `.pptx` bytes.
The component fills its parent, so give the parent an explicit height.

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

// Base chrome styles (toolbar, thumbnails, layout). Import once, e.g. in styles.css or main.ts.
import 'pptx-angular-viewer/styles';

@Component({
	selector: 'app-viewer-only',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="height: 100vh">
			@if (content(); as bytes) {
				<pptx-viewer [content]="bytes" />
			} @else {
				<div>Loading…</div>
			}
		</div>
	`,
})
export class ViewerOnlyComponent {
	readonly content = signal<ArrayBuffer | null>(null);

	constructor() {
		fetch('/presentation.pptx')
			.then((r) => r.arrayBuffer())
			.then((buf) => this.content.set(buf));
	}
}
```

::: tip `content` accepts either type
Unlike React's `Uint8Array`-only prop, Angular's `content` input accepts `Uint8Array | ArrayBuffer |
null`, so a raw `fetch(...).arrayBuffer()` result can be passed straight through.
:::

## 2. Loading from a file `<input>`

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-file-picker-viewer',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="display: flex; flex-direction: column; height: 100vh">
			<input type="file" accept=".pptx" (change)="onFile($event)" />
			<div style="flex: 1; min-height: 0">
				@if (content(); as bytes) {
					<pptx-viewer [content]="bytes" />
				}
			</div>
		</div>
	`,
})
export class FilePickerViewerComponent {
	readonly content = signal<ArrayBuffer | null>(null);

	async onFile(event: Event): Promise<void> {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		this.content.set(await file.arrayBuffer());
	}
}
```

## 3. Enabling editing

Set `canEdit` to turn on the editing ribbon and inspector. Track changes with the outputs:

- `dirtyChange` - fires when the unsaved-changes flag flips.
- `contentChange` - fires with the **re-serialized `Uint8Array`** when the document changes.
- `activeSlideChange` - fires when the active slide changes.

```ts
import { Component, input, signal, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-editor',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="height: 100vh">
			<button (click)="save()" [disabled]="!dirty()">Save{{ dirty() ? ' *' : '' }}</button>
			<pptx-viewer
				[content]="initial()"
				[canEdit]="true"
				(dirtyChange)="dirty.set($event)"
				(contentChange)="onContentChange($event)"
				(activeSlideChange)="onSlideChange($event)"
			/>
		</div>
	`,
})
export class EditorComponent {
	readonly initial = input.required<Uint8Array>();
	readonly viewer = viewChild.required(PowerPointViewerComponent);
	readonly dirty = signal(false);

	async save(): Promise<void> {
		const bytes = await this.viewer().getContent(); // Uint8Array
		// POST to your server, write to disk, trigger a download, …
	}

	onContentChange(bytes: Uint8Array): void {
		// `bytes` is the latest serialized document
	}

	onSlideChange(index: number): void {
		console.log('slide', index);
	}
}
```

::: info Saving
The most reliable way to retrieve the current document is [`getContent()`](/angular/api) on the
component instance, which serializes on demand. `contentChange` also delivers the latest bytes as
edits happen.
:::

## Styling / required CSS

Import the bundled stylesheet once at your app's entry point (or in your global `styles.css`):

```ts
import 'pptx-angular-viewer/styles'; // or 'pptx-angular-viewer/styles.css'
```

See [Theming](/angular/theming) for how to customise colours on top of the base stylesheet.

## Next steps

- [Component Inputs & Outputs](/angular/props) - every input/output in detail.
- [Public API](/angular/api) - the methods exposed on the component instance.
- [Export](/angular/export) - turning slides into PNG/PDF/GIF/video.
