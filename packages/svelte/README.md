# pptx-svelte-viewer

[![npm version](https://img.shields.io/npm/v/pptx-svelte-viewer.svg)](https://www.npmjs.com/package/pptx-svelte-viewer)
[![license](https://img.shields.io/npm/l/pptx-svelte-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show, edit, and present Microsoft PowerPoint (`.pptx`) files directly in a
Svelte 5 app: no server, no conversion step, no PowerPoint install required.
Drop in a `<PowerPointViewer>` component (built with runes), hand it the
file's bytes, and it renders slides as real HTML and CSS.

![A PowerPoint deck rendered by the Svelte 5 viewer demo](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/svelte-demo.gif)

The rendering is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine, which turns a `.pptx` file into a structured slide model. This package is the Svelte layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-svelte/)** · **[📦 npm](https://www.npmjs.com/package/pptx-svelte-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/svelte/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

## Features

- **A single component**: `<PowerPointViewer>`, written with Svelte 5 runes.
- **Real HTML rendering**: slides are drawn as ordinary HTML and SVG, not as a
  picture, so text stays sharp at any zoom and is selectable and accessible.
- **Full element coverage**: text, shapes, images, groups, connectors, tables,
  charts, SmartArt (2D and opt-in 3D), media (video/audio), ink, OLE embedded
  objects, and 3D models - all powered by the same shared engine as the other
  bindings.
- **Editing**: insert and format elements; multi-select, group, arrange, drag,
  resize, and rotate; rich inline text and notes editing; inherited template
  element editing; undo/redo; save the edited deck back to `.pptx`.
- **Presentation mode**: fullscreen presenting via the real Fullscreen API,
  with media autoplay.
- **Export**: PNG, PDF, GIF, video, print, notes pages, and handouts.
- **Slide navigation**: responsive desktop/mobile chrome, thumbnail sidebar,
  toolbar, keyboard navigation, and a rich speaker-notes panel.
- **Review and accessibility**: comments and presentation-wide accessibility
  checks from the Review ribbon.
- **Themeable**: the shared `ViewerTheme` system (`--pptx-*` CSS custom
  properties), including the vermilion presets.
- **i18n**: English built in; register more locales via
  `pptx-svelte-viewer/i18n`.

## Install

```bash
npm install pptx-svelte-viewer jszip fast-xml-parser
```

Requires Svelte 5 (runes) as a peer. The `pptx-viewer-core` engine is
**bundled in**, so you don't install it separately unless you want to call
the SDK directly.

Component styles ship as a real stylesheet, not runtime-injected CSS (which
proved unreliable in real SvelteKit apps: SSR, a strict CSP, or the host's own
global CSS could all cause it to silently not apply). Import it once at your
app entry:

```ts
import 'pptx-svelte-viewer/styles';
```

## Usage

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let source: ArrayBuffer | undefined = $state();

	async function open(file: File) {
		source = await file.arrayBuffer();
	}
</script>

<div style="height: 600px">
	<PowerPointViewer
		{source}
		initialSlide={0}
		showThumbnails
		showToolbar
		onload={(detail) => console.log('slides:', detail.slideCount)}
		onslidechange={(index) => console.log('slide', index)}
		onerror={(message) => console.error(message)}
	/>
</div>
```

## Props

| Prop             | Type                            | Default | Description                                       |
| ---------------- | ------------------------------- | ------- | ------------------------------------------------- |
| `source`         | `Uint8Array \| ArrayBuffer`     | -       | Raw `.pptx` bytes.                                |
| `theme`          | `ViewerTheme`                   | -       | Color/radius/CSS-var overrides.                   |
| `locale`         | `string`                        | `'en'`  | UI locale (see `pptx-svelte-viewer/i18n`).        |
| `initialSlide`   | `number`                        | `0`     | Slide shown after load (0-based).                 |
| `showThumbnails` | `boolean`                       | `true`  | Thumbnail sidebar.                                |
| `showToolbar`    | `boolean`                       | `true`  | Navigation/zoom/fullscreen toolbar.               |
| `showNotes`      | `boolean`                       | `true`  | Speaker-notes panel and its toolbar toggle.       |
| `editable`       | `boolean`                       | `false` | Ribbon editing, insertion, arrange, and save.     |
| `smartArt3D`     | `boolean`                       | `false` | Opt-in Three.js 3D SmartArt renderer.             |
| `onload`         | `(d: ViewerLoadDetail) => void` | -       | Fired after a presentation loads.                 |
| `onerror`        | `(message: string) => void`     | -       | Fired when loading fails.                         |
| `onslidechange`  | `(index: number) => void`       | -       | Fired when the active slide changes.              |
| `onnotesupdate`  | `(notes: string) => void`       | -       | Fired when the user edits the speaker notes.      |
| `onchange`       | `() => void`                    | -       | Fired after every committed edit when `editable`. |

See the [full docs](https://christophervr.github.io/pptx-viewer/svelte/) for
the complete props/events contract, theming, and localization guides.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
