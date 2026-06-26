# pptx-angular-viewer

[![npm version](https://img.shields.io/npm/v/pptx-angular-viewer.svg)](https://www.npmjs.com/package/pptx-angular-viewer)
[![license](https://img.shields.io/npm/l/pptx-angular-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show, edit, and present Microsoft PowerPoint (`.pptx`) files directly in an
Angular app: no server, no conversion step, no PowerPoint install required. Drop
in a `<pptx-viewer>` component, hand it the file's bytes, and it renders slides
as real HTML and CSS with full editing and export support.

![PowerPoint editor UI rendered in the browser](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

The rendering is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine (also published as [`@christophervr/pptx-viewer`](https://www.npmjs.com/package/@christophervr/pptx-viewer) -- the two names are identical releases), which turns a `.pptx` file into a structured slide model. This package is the Angular layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)** · **[📦 npm](https://www.npmjs.com/package/pptx-angular-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)**: open a `.pptx` and render it in your browser, no install required.

## Features

- **Standalone component**: `<pptx-viewer>`, no NgModule needed.
- **Modern Angular**: built on signals and `OnPush`, and works without Zone.js.
- **Real HTML rendering**: slides are drawn as ordinary HTML and SVG, not as a
  picture, so text stays sharp at any zoom and is selectable and accessible.
- **Editing**: select, drag, resize, rotate; inline text and table-cell editing;
  format painter; shape adjustment handles; align, distribute, group, flip, and
  z-order; undo/redo; snap-to-grid, snap-to-shape, H/V guides, and rulers.
- **Full Office-style ribbon**: all tabs wired (Home, Insert incl. Table/SmartArt/
  Equation, Draw incl. freehand ink, Design incl. theme gallery, Transitions,
  Animations, Slide Show incl. custom shows, Review, View incl. grid/rulers/guides/
  snap/eyedropper/selection pane) plus a status bar and context menu.
- **Inspector**: element and slide property panels, including chart data editor.
- **Presentation mode**: animation playback, presenter view, slide transitions,
  custom-show playback, rehearse timings, and freehand ink.
- **Export**: PNG, PDF, GIF, and WebM video; print; Save As (pptx/ppsx/pptm).
- **Collaboration**: real-time Yjs-based co-editing with cursor/selection presence.
- **Comments, find/replace, accessibility panel, digital signatures**, and more.
- **Mobile chrome**: touch toolbar, bottom bar with sheets, and touch editing.
- **Slide navigation**: a thumbnail rail, previous/next, and a slide counter.
- **Zoom**: in, out, and reset.
- **Themeable**: change colours through CSS custom properties.
- **Loads from anywhere**: an `ArrayBuffer` or `Uint8Array` from a file input,
  a `fetch`, drag-and-drop, and so on.

## Installation

```bash
npm install pptx-angular-viewer
```

**Peer requirements:** Angular 22+ (`@angular/core`, `@angular/common`) and `rxjs`.

## Usage

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

// Base chrome styles (toolbar, thumbnails, layout). Import once.
import 'pptx-angular-viewer/styles';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<input type="file" accept=".pptx" (change)="onFile($event)" />

		<div style="height: 80vh">
			@if (content()) {
				<pptx-viewer [content]="content()" (activeSlideChange)="onSlide($event)" />
			}
		</div>
	`,
})
export class AppComponent {
	readonly content = signal<ArrayBuffer | null>(null);

	async onFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) this.content.set(await file.arrayBuffer());
	}

	onSlide(index: number) {
		console.log('active slide', index);
	}
}
```

### Theming

Pass a partial theme; unset tokens fall back to the built-in dark palette. Values
accept any CSS color (`hex`, `rgb()`, `hsl()`, `oklch()`, …).

```ts
import type { ViewerTheme } from 'pptx-angular-viewer';

theme: ViewerTheme = {
	colors: { primary: '#6366f1', background: '#0b1020' },
	radius: '0.5rem',
};
```

```html
<pptx-viewer [content]="content()" [theme]="theme" />
```

For app-wide theming you can also provide a theme through DI:

```ts
import { provideViewerTheme } from 'pptx-angular-viewer';

bootstrapApplication(AppComponent, {
	providers: [provideViewerTheme({ colors: { primary: '#6366f1' } })],
});
```

### Reading the current presentation back

`getContent()` turns the current presentation back into `.pptx` bytes. Reach it
via a template reference or `viewChild`:

```ts
@ViewChild(PowerPointViewerComponent) viewer!: PowerPointViewerComponent;

async save() {
  const bytes = await this.viewer.getContent();
  // write `bytes` (Uint8Array) to a Blob / download / upload
}
```

## API

### Inputs

| Input           | Type                                | Default | Description                                                       |
| --------------- | ----------------------------------- | ------- | ----------------------------------------------------------------- |
| `content`       | `Uint8Array \| ArrayBuffer \| null` | `null`  | The `.pptx` bytes to render.                                      |
| `theme`         | `ViewerTheme`                       | n/a     | Color/radius overrides applied as CSS custom properties.          |
| `class`         | `string`                            | `''`    | Class applied to the root element.                                |
| `canEdit`       | `boolean`                           | `false` | Enables the editor toolbar, inspector, and drag-and-drop editing. |
| `collaboration` | `CollaborationConfig`               | n/a     | Yjs real-time collaboration config (server URL, room, role).      |

### Outputs

| Output              | Payload      | Description                                        |
| ------------------- | ------------ | -------------------------------------------------- |
| `activeSlideChange` | `number`     | Emits the active slide index on navigation.        |
| `dirtyChange`       | `boolean`    | Emits `true`/`false` when the dirty state changes. |
| `contentChange`     | `Uint8Array` | Emits updated bytes after any editing change.      |

### Methods

| Method         | Returns               | Description                                    |
| -------------- | --------------------- | ---------------------------------------------- |
| `getContent()` | `Promise<Uint8Array>` | Serialise the current presentation to `.pptx`. |

### Exported components & helpers

`PowerPointViewerComponent`, `SlideCanvasComponent`, `ElementRendererComponent`,
`LoadContentService`, `provideViewerTheme`, `VIEWER_THEME`, and the
`ViewerTheme` / `CanvasSize` / `CollaborationConfig` types.

## Limitations

The Angular package has reached functional parity with the React package: all 11
element types render; the full Tailwind 4 Office ribbon is wired; editing
(including slide master/layout template editing), presentation, export,
collaboration, comments, and mobile chrome all work. The remaining items are
polish/cosmetic, not behavioural gaps:

- **Pixel-level cosmetic differences** - Some toolbar controls are not pixel-
  identical to their React counterparts (spacing, split-button affordances,
  dropdown chrome).
- **3D models need the Three.js peer** - GLB/GLTF models render interactively when
  the optional `three` peer dependency is installed, and fall back to their poster
  image otherwise (the same as the React package).

The `pptx-viewer-core` engine parses all element data, so you can access it from
the model even where the UI does not expose it yet. Progress and design notes live
in [`PORTING.md`](./PORTING.md).

## Build (contributing)

```bash
bun run build      # ng-packagr → dist (Angular Package Format)
bun run typecheck  # tsc against tsconfig.lib.json
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
