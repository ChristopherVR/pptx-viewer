# pptx-vue-viewer

[![npm version](https://img.shields.io/npm/v/pptx-vue-viewer.svg)](https://www.npmjs.com/package/pptx-vue-viewer)
[![license](https://img.shields.io/npm/l/pptx-vue-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show Microsoft PowerPoint (`.pptx`) presentations directly in a Vue 3 app:
no server, no conversion step, no PowerPoint install required. Drop in a
`<PowerPointViewer>` component, hand it the file's bytes, and it reads and
displays the slides as real HTML and CSS, with slide navigation and zoom.

![PowerPoint editor UI rendered in the browser](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

> The screenshot shows the full-featured **React** editor. This Vue package is at
> a **read-only viewer** milestone today; see [Limitations](#limitations).

The reading is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine (also published as [`@christophervr/pptx-viewer`](https://www.npmjs.com/package/@christophervr/pptx-viewer) -- the two names are identical releases), which turns a `.pptx` file into a structured slide model. This package is the Vue layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-vue/)** · **[📦 npm](https://www.npmjs.com/package/pptx-vue-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-vue/)**: open a `.pptx` and render it in your browser, no install required.

## Features

- **A single component**: `<PowerPointViewer>`, written in `<script setup>` style.
- **Real HTML rendering**: slides are drawn as ordinary HTML and SVG, not as a
  picture, so text stays sharp at any zoom and is selectable and accessible.
- **Slide navigation**: live thumbnail previews, previous/next, and a slide counter.
- **Zoom**: in, out, and reset.
- **Themeable**: change colours through CSS custom properties.
- **Loads from anywhere**: an `ArrayBuffer` or `Uint8Array` from a file input,
  a `fetch`, drag-and-drop, and so on.

## Installation

```bash
npm install pptx-vue-viewer
```

**Peer requirements:** Vue 3.5+ and the engine's `jszip` / `fast-xml-parser`
peers:

```bash
npm install vue jszip fast-xml-parser
```

The `pptx-viewer-core` engine is **bundled in**, so you don't install it
separately unless you want to call the SDK directly.

## Usage

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';

// Base chrome styles (toolbar, thumbnails, layout). Import once.
import 'pptx-vue-viewer/styles';

const content = ref<Uint8Array>();
const viewer = ref<PowerPointViewerExpose>();

onMounted(async () => {
	const res = await fetch('/example.pptx');
	content.value = new Uint8Array(await res.arrayBuffer());
});

function onSlide(index: number) {
	console.log('active slide', index);
}
</script>

<template>
	<PowerPointViewer
		v-if="content"
		ref="viewer"
		:content="content"
		:theme="{ colors: { primary: '#6366f1' } }"
		@active-slide-change="onSlide"
		style="height: 100vh"
	/>
</template>
```

### Loading from a file input

```vue
<script setup lang="ts">
import { ref } from 'vue';
const content = ref<ArrayBuffer>();

async function onFile(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (file) content.value = await file.arrayBuffer();
}
</script>

<template>
	<input type="file" accept=".pptx" @change="onFile" />
</template>
```

### Theming

Pass a partial `theme`; unset tokens fall back to the built-in dark palette.
Values accept any CSS color (`hex`, `rgb()`, `hsl()`, `oklch()`, …) and map to
`--pptx-*` CSS custom properties (shadcn/ui token names).

```ts
import type { ViewerTheme } from 'pptx-vue-viewer';

const theme: ViewerTheme = {
	colors: { primary: '#6366f1', background: '#0b1020' },
	radius: '0.5rem',
};
```

For app-wide theming you can also provide a theme to a subtree:

```ts
import { provideViewerTheme } from 'pptx-vue-viewer';
// call inside a parent component's setup()
provideViewerTheme({ colors: { primary: '#6366f1' } });
```

### Reading the current presentation back

`getContent()` turns the current presentation back into `.pptx` bytes. Reach it
through a template `ref`:

```ts
const viewer = ref<PowerPointViewerExpose>();

async function save() {
	const bytes = await viewer.value!.getContent();
	// write `bytes` (Uint8Array) to a Blob / download / upload
}
```

## API

### Props

| Prop            | Type                        | Default | Description                                                 |
| --------------- | --------------------------- | ------- | ----------------------------------------------------------- |
| `content`       | `Uint8Array \| ArrayBuffer` | n/a     | The `.pptx` bytes to render. **Required.**                  |
| `theme`         | `ViewerTheme`               | n/a     | Color/radius overrides applied as CSS custom properties.    |
| `class`         | `string`                    | n/a     | Class applied to the root element.                          |
| `canEdit`       | `boolean`                   | `false` | Reserved for the editor (not yet implemented).              |
| `filePath`      | `string`                    | n/a     | Reserved for autosave recovery.                             |
| `authorName`    | `string`                    | n/a     | Reserved for comments/annotations.                          |
| `collaboration` | `CollaborationConfig`       | n/a     | Reserved for real-time collaboration (not yet implemented). |

### Events

| Event                 | Payload      | Description                                 |
| --------------------- | ------------ | ------------------------------------------- |
| `active-slide-change` | `number`     | Emits the active slide index on navigation. |
| `content-change`      | `Uint8Array` | Reserved for editing (not yet emitted).     |
| `dirty-change`        | `boolean`    | Reserved for editing (not yet emitted).     |

### Exposed methods (template `ref`)

| Method         | Returns               | Description                                    |
| -------------- | --------------------- | ---------------------------------------------- |
| `getContent()` | `Promise<Uint8Array>` | Serialise the current presentation to `.pptx`. |

### Exported components & helpers

`PowerPointViewer`, `SlideCanvas`, `SlideStage`, `ElementRenderer`,
`provideViewerTheme`, `useViewerTheme`, and the `ViewerTheme` / `CanvasSize` /
`CollaborationConfig` types.

## Limitations

This package is at a **read-only viewer** milestone: it shows the content of a
slide, but some visual effects and all editing are not built yet.

- **Shown today:** text (with mixed formatting), shapes (solid, gradient, and
  image fills, plus outlines), pictures and images, the still frame of a video,
  nested groups, and straight connectors.
- **Shown as placeholders:** tables, charts, SmartArt, ink, OLE objects, 3D
  models, and zoom links appear as labelled boxes for now.
- **Not built yet:** custom shape outlines and bent or curved connectors;
  effects (shadows, glow, 3D, image filters); warped text and equations;
  embedded fonts; video and audio playback; animations, transitions, and
  presentation mode; editing (selecting, the toolbar, the inspector); and export.

The `pptx-viewer-core` engine already reads most of this data, so you can get it
from the parsed model even where this UI does not draw it yet. Progress, the
roadmap, and design notes live in [`PORTING.md`](./PORTING.md).

## Build (contributing)

```bash
bun run build      # Vite library build → dist (ESM + CJS + d.ts)
bun run typecheck  # vue-tsc
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
