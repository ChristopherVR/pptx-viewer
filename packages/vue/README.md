# pptx-vue-viewer

[![npm version](https://img.shields.io/npm/v/pptx-vue-viewer.svg)](https://www.npmjs.com/package/pptx-vue-viewer)
[![license](https://img.shields.io/npm/l/pptx-vue-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show, edit, and present Microsoft PowerPoint (`.pptx`) files directly in a
Vue 3 app: no server, no conversion step, no PowerPoint install required. Drop
in a `<PowerPointViewer>` component, hand it the file's bytes, and it renders
slides as real HTML and CSS with full editing and export support.

![Navigating between slides in the Vue 3 demo](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/vue-demo.gif)

The rendering is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine, which turns a `.pptx` file into a structured slide model. This package is the Vue layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-vue/)** · **[📦 npm](https://www.npmjs.com/package/pptx-vue-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-vue/)**: open a `.pptx` and render it in your browser, no install required.

## Features

- **A single component**: `<PowerPointViewer>`, written in `<script setup>` style.
- **Real HTML rendering**: slides are drawn as ordinary HTML and SVG, not as a
  picture, so text stays sharp at any zoom and is selectable and accessible.
- **Editing**: select, drag, resize, rotate; inline text editing; format painter;
  shape adjustment handles; align, distribute, group, flip, and z-order; undo/redo;
  snap-to-grid, snap-to-shape, H/V guides, and rulers.
- **Full Office-style ribbon**: all tabs wired (Home, Insert, Draw, Design,
  Transitions, Animations, Slide Show, Review, View) plus a status bar and
  context menu.
- **Inspector**: element and slide property panels, including chart data editor.
- **Presentation mode**: animation playback, presenter view, slide transitions,
  rehearse timings, subtitles, and freehand ink.
- **Export**: PNG, PDF, GIF, and WebM video; print; Save As (pptx/ppsx/pptm).
- **Collaboration**: real-time Yjs-based co-editing with cursor/selection presence.
- **Comments, find/replace, accessibility panel, version history**, and more.
- **Mobile chrome**: touch toolbar, bottom bar with sheets, and touch editing.
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

Two ready-made presets ship with the package: `vermilionLightTheme` (warm paper
canvas) and `vermilionDarkTheme` (dimmed presenter room), the same vermilion
brand look as the [documentation site](https://christophervr.github.io/pptx-viewer/):

```ts
import { vermilionLightTheme } from 'pptx-vue-viewer';
// <PowerPointViewer :theme="vermilionLightTheme" … />
```

The underlying palettes (`vermilionLightColors`, `vermilionDarkColors`) and
radius (`vermilionRadius`) are exported too for deriving your own variant.

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

| Prop            | Type                        | Default | Description                                                                                                               |
| --------------- | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `content`       | `Uint8Array \| ArrayBuffer` | n/a     | The `.pptx` bytes to render. **Required.**                                                                                |
| `theme`         | `ViewerTheme`               | n/a     | Color/radius overrides applied as CSS custom properties.                                                                  |
| `class`         | `string`                    | n/a     | Class applied to the root element.                                                                                        |
| `canEdit`       | `boolean`                   | `false` | Enables the editor toolbar, inspector, and drag-and-drop editing.                                                         |
| `filePath`      | `string`                    | n/a     | Passed to autosave / recovery logic.                                                                                      |
| `authorName`    | `string`                    | n/a     | Displayed in comment annotations.                                                                                         |
| `collaboration` | `CollaborationConfig`       | n/a     | Yjs real-time collaboration config (server URL, room, role).                                                              |
| `hiddenActions` | `ToolbarActionId[]`         | n/a     | Individual toolbar buttons and/or ribbon tabs to hide (e.g. `['share', 'broadcast', 'insert']`). Omit to show everything. |

### Events

| Event                 | Payload      | Description                                                                          |
| --------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `active-slide-change` | `number`     | Emits the active slide index on navigation.                                          |
| `content-change`      | `Uint8Array` | Emits updated bytes after any editing change.                                        |
| `dirty-change`        | `boolean`    | Emits `true`/`false` when the dirty state changes.                                   |
| `mode-change`         | `string`     | Emits the new mode when it changes (`'preview'`, `'edit'`, `'present'`, `'master'`). |
| `zoom-change`         | `number`     | Emits the new zoom level (1 = 100%).                                                 |
| `selection-change`    | `string[]`   | Emits the selected element IDs when selection changes.                               |
| `slide-count-change`  | `number`     | Emits the total slide count when slides are added/removed.                           |

### Exposed methods (template `ref`)

| Method                    | Returns               | Description                                    |
| ------------------------- | --------------------- | ---------------------------------------------- |
| `getContent()`            | `Promise<Uint8Array>` | Serialise the current presentation to `.pptx`. |
| `goTo(index)`             | `void`                | Navigate to a slide by zero-based index.       |
| `goPrev()`                | `void`                | Navigate to the previous slide.                |
| `goNext()`                | `void`                | Navigate to the next slide.                    |
| `undo()`                  | `void`                | Undo the last editing action.                  |
| `redo()`                  | `void`                | Redo the last undone action.                   |
| `canUndo()`               | `boolean`             | Whether an undo action is available.           |
| `canRedo()`               | `boolean`             | Whether a redo action is available.            |
| `getZoom()`               | `number`              | Get the current zoom level.                    |
| `setZoom(level)`          | `void`                | Set the zoom level (clamped to 0.2 - 3.0).     |
| `zoomIn()`                | `void`                | Zoom in by one step.                           |
| `zoomOut()`               | `void`                | Zoom out by one step.                          |
| `zoomReset()`             | `void`                | Reset zoom to 100%.                            |
| `getMode()`               | `ViewerMode`          | Get the current viewer mode.                   |
| `setMode(mode)`           | `void`                | Switch mode programmatically.                  |
| `getActiveSlideIndex()`   | `number`              | Get the zero-based active slide index.         |
| `getSlideCount()`         | `number`              | Get the total number of slides.                |
| `isDirty()`               | `boolean`             | Whether the document has unsaved changes.      |
| `getSelectedElementIds()` | `string[]`            | Get IDs of currently selected elements.        |
| `selectElements(ids)`     | `void`                | Programmatically select elements by ID.        |
| `clearSelection()`        | `void`                | Clear the current selection.                   |

### Exported components & helpers

`PowerPointViewer`, `SlideCanvas`, `SlideStage`, `ElementRenderer`,
`provideViewerTheme`, `useViewerTheme`, and the `ViewerTheme` / `CanvasSize` /
`CollaborationConfig` / `ToolbarActionId` types.

## Localization (i18n)

UI labels go through [vue-i18n](https://vue-i18n.intlify.dev/) with dotted keys such as `pptx.statusBar.allSaved`. Create a `vue-i18n` instance with `createI18n()` and install it as a plugin (the demo's `src/i18n.ts` shows a minimal config, including a `missing` handler that derives Title Case labels for any key you don't explicitly translate):

```ts
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n';
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
});
```

Switch languages with `i18n.global.locale.value = 'fr'`. `pptx-vue-viewer/i18n` also exports a `TranslationKey` type for type-checking a new locale dictionary (`Record<TranslationKey, string>`) at compile time. See the [Localization guide](https://christophervr.github.io/pptx-viewer/guide/localization) for the full picture across all five viewer bindings and how to contribute a translation upstream; the live demo's language picker is a working reference.

## Limitations

A handful of effects (`backdrop-filter`, path gradients) are approximated on
screen, and a few effects flatten in raster export; see the root README's
Limitations for details.

The `pptx-viewer-core` engine parses all slide data, so anything not surfaced in
the UI is still readable from the model.

## Build (contributing)

```bash
bun run build      # Vite library build → dist (ESM + CJS + d.ts)
bun run typecheck  # vue-tsc
bun run test       # vitest
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
