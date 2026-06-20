# pptx-angular-viewer

[![npm version](https://img.shields.io/npm/v/pptx-angular-viewer.svg)](https://www.npmjs.com/package/pptx-angular-viewer)
[![license](https://img.shields.io/npm/l/pptx-angular-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Render Microsoft PowerPoint (`.pptx`) presentations directly in an Angular app:
no server, no conversion step, no PowerPoint install. Drop in a `<pptx-viewer>`
component, hand it the file bytes, and it parses and displays the slides as
scalable HTML/CSS with slide navigation and zoom.

![PowerPoint editor UI rendered in the browser](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

> The screenshot shows the full-featured **React** editor. This Angular package
> is at a **read-only viewer** milestone today; see [Limitations](#limitations).

Parsing is powered by the framework-agnostic `pptx-viewer-core` engine
(OpenXML → a structured slide model); this package is the Angular rendering
layer on top of it.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)** · **[📦 npm](https://www.npmjs.com/package/pptx-angular-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-angular/)**: open a `.pptx` and render it in your browser, no install required.

## Features

- **Standalone component**: `<pptx-viewer>`, no NgModule required.
- **Signals-based & zoneless-friendly**: `OnPush` everywhere, built on the
  Angular signals API.
- **CSS rendering**: slides are real DOM (scaled HTML/SVG), so text stays sharp
  at any zoom and is selectable/accessible.
- **Slide navigation**: thumbnail rail, prev/next, slide counter.
- **Zoom**: in/out/reset.
- **Themeable**: semantic color tokens via CSS custom properties.
- **Loads from anywhere**: `ArrayBuffer` / `Uint8Array` from a file input,
  `fetch`, drag-and-drop, etc.

## Installation

```bash
npm install pptx-angular-viewer pptx-viewer-core
```

**Peer requirements:** Angular 22+ (`@angular/core`, `@angular/common`),
`rxjs`, and `pptx-viewer-core`.

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

`getContent()` serialises the in-memory presentation to `.pptx` bytes. Reach it
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

This package is at a **read-only viewer** milestone: it renders the structural
content of a slide, but rich visual effects and editing are not yet wired up.

- **Rendered:** text (rich runs), shapes (solid fill, stroke, basic preset
  corners), pictures/images, media poster frames, and nested groups.
- **Placeholders:** tables, charts, SmartArt, connectors, ink, OLE objects, 3D
  models, and zoom links are shown as labelled placeholders.
- **Not yet implemented:** gradient/pattern/picture fills, custom-geometry
  clip-paths, effects (shadows, glow, 3D, image filters), text warp / equations,
  embedded-font injection, media playback, animations/transitions/presentation
  mode, editing (selection, toolbar, inspector), and export.

The underlying `pptx-viewer-core` engine already parses most of this data, so
you can read it from the parsed model even where this UI layer doesn't render it
yet. Progress, the roadmap, and design notes live in
[`PORTING.md`](./PORTING.md).

## Build (contributing)

```bash
bun run build      # ng-packagr → dist (Angular Package Format)
bun run typecheck  # tsc against tsconfig.lib.json
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
