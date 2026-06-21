# pptx-angular-viewer

[![npm version](https://img.shields.io/npm/v/pptx-angular-viewer.svg)](https://www.npmjs.com/package/pptx-angular-viewer)
[![license](https://img.shields.io/npm/l/pptx-angular-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show Microsoft PowerPoint (`.pptx`) presentations directly in an Angular app:
no server, no conversion step, no PowerPoint install required. Drop in a
`<pptx-viewer>` component, hand it the file's bytes, and it reads and displays
the slides as real HTML and CSS, with slide navigation and zoom.

![PowerPoint editor UI rendered in the browser](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

> The screenshot shows the full-featured **React** editor. This Angular package
> is at a **read-only viewer** milestone today; see [Limitations](#limitations).

The reading is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine (also published as [`@christophervr/pptx-viewer`](https://www.npmjs.com/package/@christophervr/pptx-viewer) -- the two names are identical releases), which turns a `.pptx` file into a structured slide model. This package is the Angular layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)** · **[📦 npm](https://www.npmjs.com/package/pptx-angular-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)**: open a `.pptx` and render it in your browser, no install required.

## Features

- **Standalone component**: `<pptx-viewer>`, no NgModule needed.
- **Modern Angular**: built on signals and `OnPush`, and works without Zone.js.
- **Real HTML rendering**: slides are drawn as ordinary HTML and SVG, not as a
  picture, so text stays sharp at any zoom and is selectable and accessible.
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

| Input           | Type                                | Default | Description                                                 |
| --------------- | ----------------------------------- | ------- | ----------------------------------------------------------- |
| `content`       | `Uint8Array \| ArrayBuffer \| null` | `null`  | The `.pptx` bytes to render.                                |
| `theme`         | `ViewerTheme`                       | n/a     | Color/radius overrides applied as CSS custom properties.    |
| `class`         | `string`                            | `''`    | Class applied to the root element.                          |
| `canEdit`       | `boolean`                           | `false` | Reserved for the editor (not yet implemented).              |
| `collaboration` | `CollaborationConfig`               | n/a     | Reserved for real-time collaboration (not yet implemented). |

### Outputs

| Output              | Payload      | Description                                 |
| ------------------- | ------------ | ------------------------------------------- |
| `activeSlideChange` | `number`     | Emits the active slide index on navigation. |
| `dirtyChange`       | `boolean`    | Reserved for editing (not yet emitted).     |
| `contentChange`     | `Uint8Array` | Reserved for editing (not yet emitted).     |

### Methods

| Method         | Returns               | Description                                    |
| -------------- | --------------------- | ---------------------------------------------- |
| `getContent()` | `Promise<Uint8Array>` | Serialise the current presentation to `.pptx`. |

### Exported components & helpers

`PowerPointViewerComponent`, `SlideCanvasComponent`, `ElementRendererComponent`,
`LoadContentService`, `provideViewerTheme`, `VIEWER_THEME`, and the
`ViewerTheme` / `CanvasSize` / `CollaborationConfig` types.

## Limitations

This package is at a **read-only viewer** milestone: it shows the content of a
slide, but richer visual effects and editing are not built yet.

- **Shown today:** text (with mixed formatting), shapes (solid fill, outline, and
  basic rounded corners), pictures and images, the still frame of a video, and
  nested groups.
- **Shown as placeholders:** tables, charts, SmartArt, connectors, ink, OLE
  objects, 3D models, and zoom links appear as labelled boxes for now.
- **Not built yet:** gradient, pattern, and image fills; custom shape outlines;
  effects (shadows, glow, 3D, image filters); warped text and equations;
  embedded fonts; video and audio playback; animations, transitions, and
  presentation mode; editing (selecting, the toolbar, the inspector); and export.

The `pptx-viewer-core` engine already reads most of this data, so you can get it
from the parsed model even where this UI does not draw it yet. Progress, the
roadmap, and design notes live in [`PORTING.md`](./PORTING.md).

## Build (contributing)

```bash
bun run build      # ng-packagr → dist (Angular Package Format)
bun run typecheck  # tsc against tsconfig.lib.json
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
