# pptx-react-viewer

[![npm version](https://img.shields.io/npm/v/pptx-react-viewer.svg)](https://www.npmjs.com/package/pptx-react-viewer)
[![license](https://img.shields.io/npm/l/pptx-react-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/pptx-react-viewer.svg)](https://www.npmjs.com/package/pptx-react-viewer)

> A drop-in **React** component that turns a `.pptx` file into a fully interactive PowerPoint: **view, edit, present, collaborate, and export**, entirely in the browser.

![The pptx-react-viewer editor: ribbon toolbar, slide thumbnails, and a slide rendered on the canvas](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

Slides render with real **HTML/CSS** (not `<canvas>`), so text stays crisp at any zoom, is selectable and screen-reader accessible, and every element is directly editable. The parsing/editing engine ([`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core)) is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[📦 npm](https://www.npmjs.com/package/pptx-react-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

> **[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo/)**: open a `.pptx` in your browser and view, edit, present, and export it. No install required.

---

## Install

```bash
npm install pptx-react-viewer
```

Then add the React peer dependencies your app uses:

```bash
npm install react react-dom framer-motion lucide-react react-icons jspdf jszip fast-xml-parser i18next react-i18next
```

> The package is named **`pptx-react-viewer`** on npm. `pptx-viewer-core` (the engine) is **bundled in**, so you don't install it separately unless you want to call the SDK directly.
> **Optional:** `three` for 3D models/charts · `yjs y-websocket` for real-time collaboration.

## Quick start

```tsx
import { useState } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer';
// Not using Tailwind? Import the bundled stylesheet once at your app entry:
import 'pptx-react-viewer/styles';

export default function App() {
	const [content, setContent] = useState<ArrayBuffer | null>(null);

	// Load any .pptx as an ArrayBuffer (fetch, <input type="file">, drag-drop, …)
	const onPick = (e: React.ChangeEvent<HTMLInputElement>) =>
		e.target.files?.[0]?.arrayBuffer().then(setContent);

	return (
		<div style={{ height: '100vh' }}>
			{content ? (
				<PowerPointViewer content={content} canEdit />
			) : (
				<input type='file' accept='.pptx' onChange={onPick} />
			)}
		</div>
	);
}
```

The component fills its parent, so give the parent a height. That's the whole setup: open a file and you have a working viewer/editor.

To read the edited presentation back out as bytes, pass a `ref` and call `getContent()`:

```tsx
import { useRef } from 'react';
import { PowerPointViewer, type PowerPointViewerHandle } from 'pptx-react-viewer';

const viewerRef = useRef<PowerPointViewerHandle>(null);

// <PowerPointViewer ref={viewerRef} content={content} canEdit />
const bytes = await viewerRef.current?.getContent(); // Uint8Array of a valid .pptx
```

## Features

| Feature            | Description                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **View**           | Render slides with 16 element types: shapes, text, images, tables, 23 chart types, SmartArt, connectors, media, ink, OLE, 3D models, zoom |
| **Edit**           | Insert/move/resize/delete elements, edit text inline, modify styles, manage slides                                                        |
| **Present**        | Fullscreen slideshow with 40+ animations, 42 transitions (including morph), speaker notes, presenter view with timer                      |
| **Export**         | PNG/JPEG/SVG/PDF/GIF/video slide export, save-as PPTX                                                                                     |
| **Collaborate**    | Real-time multi-user editing (powered by Yjs) with live presence, remote cursors, and user avatars                                        |
| **Print**          | Print dialog with handout layouts and notes page formatting with overflow pagination                                                      |
| **Annotate**       | Pen/highlighter/laser pointer tools during presentations                                                                                  |
| **Find & Replace** | Cross-slide text search with regex support                                                                                                |
| **Accessibility**  | Keyboard navigation, alt-text audit panel, screen reader support                                                                          |
| **3D**             | GLB/GLTF model rendering via Three.js, 3D surface charts, CSS 3D shape/text extrusion                                                     |

---

## API reference

### `PowerPointViewer` props

| Prop                  | Type                                | Default  | Description                                                       |
| --------------------- | ----------------------------------- | -------- | ----------------------------------------------------------------- |
| `content`             | `ArrayBuffer \| Uint8Array \| null` | required | Raw .pptx file bytes                                              |
| `filePath`            | `string`                            | n/a      | Optional file path (for display and autosave)                     |
| `canEdit`             | `boolean`                           | `false`  | Enable editing mode                                               |
| `onContentChange`     | `(dirty: boolean) => void`          | n/a      | Called when content changes                                       |
| `onDirtyChange`       | `(isDirty: boolean) => void`        | n/a      | Called when dirty state changes                                   |
| `onActiveSlideChange` | `(index: number) => void`           | n/a      | Called when the active slide changes                              |
| `theme`               | `ViewerTheme`                       | n/a      | Theme configuration for customising colours, radius, and CSS vars |

### `PowerPointViewerHandle` (via `ref`)

| Method       | Signature                             | Description                            |
| ------------ | ------------------------------------- | -------------------------------------- |
| `getContent` | `() => Promise<string \| Uint8Array>` | Serialise current state to .pptx bytes |

### `renderToCanvas`

Standalone utility for rendering a DOM element to a Canvas (with an oklch colour-space workaround):

```typescript
import { renderToCanvas } from 'pptx-react-viewer';

const canvas = await renderToCanvas(element, options); // => HTMLCanvasElement
```

---

## Styling & theming

The viewer's UI references **CSS custom properties** (`--pptx-*`, the shadcn/ui token convention) for every visual token, so it works three ways:

- **Tailwind CSS v4 project**: the viewer classes resolve through your existing Tailwind tokens. No extra CSS import needed.
- **No Tailwind**: import the bundled stylesheet once at your app entry: `import 'pptx-react-viewer/styles';`
- **CSS custom properties**: define the `--pptx-*` properties yourself for full control.

Override specific values with the `theme` prop:

```tsx
<PowerPointViewer
	content={bytes}
	theme={{
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.5rem',
	}}
/>
```

All `ViewerTheme.colors` keys are optional; override only what you need. Helpers `defaultThemeColors`, `defaultRadius`, `themeToCssVars`, `defaultCssVars`, `ViewerThemeProvider`, and `useViewerTheme` are exported for advanced use. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete token list.

## Localization (i18n)

UI labels go through [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) with dotted keys such as `pptx.statusBar.allSaved`. Initialise an i18next instance and wrap your app in `I18nextProvider` (the demo's `demo/i18n.ts` shows a minimal config, including a `parseMissingKeyHandler` that derives Title Case labels for any key you don't explicitly translate). `pptx-react-viewer/i18n` exports `translationsEn` (the English dictionary), `keyToLabel` (the fallback), and a `TranslationKey` type you can use to type-check a new locale dictionary (`Record<TranslationKey, string>`) at compile time. Add a new language by supplying a resource bundle under its language code. See the [Localization guide](https://christophervr.github.io/pptx-viewer/guide/localization) for full wiring examples and how to contribute a translation upstream; the live demo's language picker is a working reference.

## How it's built

You only need the `<PowerPointViewer>` component; everything else is internal. Behind it, the logic lives in many small, focused React hooks, and the components themselves just draw what those hooks produce. Slides are rendered as ordinary HTML and CSS (charts as inline SVG, tables as real `<table>` elements), which is why text stays sharp, selectable, and accessible. For the full component tree, the rendering pipeline, the animation and transition engine, connector routing, collaboration, and a file-by-file map, see the [full documentation](https://christophervr.github.io/pptx-viewer/).

## Limitations

CSS-based rendering trades a few visual effects for crisp text, accessibility, and DOM interactivity: `backdrop-filter` becomes semi-transparent backgrounds and path gradients approximate as elliptical radials, while `mix-blend-mode` and CSS 3D transforms render natively on screen but flatten in raster export. Text uses fonts available in the browser (embedded fonts are injected when present). Media playback depends on browser codec support. SmartArt is decomposed into editable shapes with a live reflow engine for structural edits, and charts edit via the inspector data grid rather than the chart surface. 3D models need the optional Three.js peer. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete list.

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
