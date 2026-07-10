# pptx-svelte-viewer

Svelte 5 PowerPoint viewer component. Renders `.pptx` slides in the browser
using the same framework-agnostic engine (`pptx-viewer-core` +
`pptx-viewer-shared`) as the React, Vue, and Angular bindings.

## Install

```bash
npm install pptx-svelte-viewer
```

Requires Svelte 5 (runes).

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

| Prop             | Type                            | Default | Description                                |
| ---------------- | ------------------------------- | ------- | ------------------------------------------ |
| `source`         | `Uint8Array \| ArrayBuffer`     | -       | Raw `.pptx` bytes.                         |
| `theme`          | `ViewerTheme`                   | -       | Color/radius/CSS-var overrides.            |
| `locale`         | `string`                        | `'en'`  | UI locale (see `pptx-svelte-viewer/i18n`). |
| `initialSlide`   | `number`                        | `0`     | Slide shown after load (0-based).          |
| `showThumbnails` | `boolean`                       | `true`  | Thumbnail sidebar.                         |
| `showToolbar`    | `boolean`                       | `true`  | Navigation/zoom/fullscreen toolbar.        |
| `onload`         | `(d: ViewerLoadDetail) => void` | -       | Fired after a presentation loads.          |
| `onerror`        | `(message: string) => void`     | -       | Fired when loading fails.                  |
| `onslidechange`  | `(index: number) => void`       | -       | Fired when the active slide changes.       |

## Status

This package is the viewer milestone: text, shapes, images, groups,
connectors, tables, charts, SmartArt, media (video/audio), ink, and OLE
embedded objects all render for real, powered by the same shared engine as
the other bindings. The remaining niche types (content parts, zoom links,
3D models) render typed placeholders. Editing is not included yet.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
