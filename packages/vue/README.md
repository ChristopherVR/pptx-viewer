# pptx-vue-viewer

Render Microsoft PowerPoint (`.pptx`) presentations directly in a Vue 3 app —
no server, no conversion step, no PowerPoint install. Drop in a
`<PowerPointViewer>` component, hand it the file bytes, and it parses and
displays the slides as scalable HTML/CSS with slide navigation and zoom.

Parsing is powered by the framework-agnostic `pptx-viewer-core` engine
(OpenXML → a structured slide model); this package is the Vue rendering layer on
top of it.

## Features

- **Composition API component** — `<PowerPointViewer>`, `<script setup>` style.
- **CSS rendering** — slides are real DOM (scaled HTML/SVG), so text stays sharp
  at any zoom and is selectable/accessible.
- **Slide navigation** — live thumbnail previews, prev/next, slide counter.
- **Zoom** — in/out/reset.
- **Themeable** — semantic color tokens via CSS custom properties.
- **Loads from anywhere** — `ArrayBuffer` / `Uint8Array` from a file input,
  `fetch`, drag-and-drop, etc.

## Installation

```bash
npm install pptx-vue-viewer pptx-viewer-core
```

**Peer requirements:** Vue 3.5+, and `pptx-viewer-core` (plus its `jszip` /
`fast-xml-parser` peers used by the engine).

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

`getContent()` serialises the in-memory presentation to `.pptx` bytes. Reach it
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
| `content`       | `Uint8Array \| ArrayBuffer` | —       | The `.pptx` bytes to render. **Required.**                  |
| `theme`         | `ViewerTheme`               | —       | Color/radius overrides applied as CSS custom properties.    |
| `class`         | `string`                    | —       | Class applied to the root element.                          |
| `canEdit`       | `boolean`                   | `false` | Reserved for the editor (not yet implemented).              |
| `filePath`      | `string`                    | —       | Reserved for autosave recovery.                             |
| `authorName`    | `string`                    | —       | Reserved for comments/annotations.                          |
| `collaboration` | `CollaborationConfig`       | —       | Reserved for real-time collaboration (not yet implemented). |

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

This package is at a **read-only viewer** milestone. Today it renders the
structural content of a slide; some visual effects and all editing are not yet
wired up.

**Element coverage**

- ✅ Rendered: text (rich runs — bold/italic/underline/strike/color/size),
  shapes (solid, gradient, and image fills + stroke), pictures/images, media
  poster frames, nested groups, and straight connectors (SVG with arrowheads
  and dashes).
- ⚠️ Shown as labelled placeholders: tables, charts, SmartArt, ink, OLE objects,
  3D models, and zoom links.

**Rendering fidelity (current gaps)**

- Connectors render straight only — bent/curved routing, compound lines, and
  connector text are not yet drawn.
- No custom-geometry clip-paths; only a few common preset shapes get rounded/
  elliptical corners.
- No shadows, glow, reflection, soft-edge, 3D bevels, or image effects.
- No text warp / WordArt, and equations (OMML) are not rendered.
- Fonts use whatever is available in the browser; embedded-font injection is not
  yet wired up, which can affect text metrics.

**Playback & interaction**

- Media shows the poster frame only — audio/video playback is not implemented.
- No animations, slide transitions, or presentation mode yet.
- The viewer is read-only: no selection, editing, toolbar, or inspector.

**Export**

- No image/PDF/GIF/video export yet.

If you need any of the above today, the underlying `pptx-viewer-core` engine
already parses most of this data — you can read it from the parsed model even
where this UI layer doesn't render it yet.

## Roadmap

Actively being worked on, roughly in priority order:

1. **Richer rendering** — clip-paths for preset geometries, then tables,
   full connector routing, and charts.
2. **Effects** — shadows, glow, image effects, and 3D styling.
3. **Editing** — selection, transform, and an editor chrome (toolbar/inspector),
   unlocking `canEdit`, `dirty-change`, and `content-change`.
4. **Animations, transitions, and presentation mode.**
5. **Export** — PNG/PDF/GIF/video.
6. **Real-time collaboration** (the `collaboration` prop).
7. **Font embedding/injection** for higher text fidelity.

Progress and design notes live in [`PORTING.md`](./PORTING.md).

## Build (contributing)

```bash
bun run build      # Vite library build → dist (ESM + CJS + d.ts)
bun run typecheck  # vue-tsc
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
