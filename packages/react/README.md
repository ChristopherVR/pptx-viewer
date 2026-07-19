# pptx-react-viewer

[![npm version](https://img.shields.io/npm/v/pptx-react-viewer.svg)](https://www.npmjs.com/package/pptx-react-viewer)
[![license](https://img.shields.io/npm/l/pptx-react-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/pptx-react-viewer.svg)](https://www.npmjs.com/package/pptx-react-viewer)

> A drop-in **React** component that turns a `.pptx` file into a fully interactive PowerPoint: **view, edit, present, collaborate, and export**, entirely in the browser.

![Selecting, dragging, and resizing a slide element in the React demo](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/react-demo.gif)

Slides render with real **HTML/CSS** (not `<canvas>`), so text stays crisp at any zoom, is selectable and screen-reader accessible, and every element is directly editable. The parsing/editing engine ([`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core)) is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[📦 npm](https://www.npmjs.com/package/pptx-react-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

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
> **Optional:** `three` (3D models/charts, 3D SmartArt) and `yjs` / `y-websocket` / `y-webrtc` (real-time collaboration) are declared as `optionalDependencies`, so npm installs them automatically when possible; the features degrade gracefully if they're absent.

## Quick start

```tsx
import { useState } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer';
// Not using Tailwind? Import the bundled stylesheet once at your app entry:
import 'pptx-react-viewer/styles';

export default function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	// Load any .pptx as bytes (fetch, <input type="file">, drag-drop, …)
	const onPick = (e: React.ChangeEvent<HTMLInputElement>) =>
		e.target.files?.[0]?.arrayBuffer().then((buf) => setContent(new Uint8Array(buf)));

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
| **Present**        | Fullscreen slideshow with 40+ animations, 46 transitions (including morph), speaker notes, presenter view with timer                      |
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

| Prop                   | Type                                    | Default  | Description                                                                                                                            |
| ---------------------- | --------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `content`              | `Uint8Array`                            | required | Raw .pptx file bytes                                                                                                                   |
| `filePath`             | `string`                                | n/a      | Optional file path (for display and autosave recovery)                                                                                 |
| `fileName`             | `string`                                | n/a      | Display name of the open document, shown in the title bar                                                                              |
| `className`            | `string`                                | n/a      | Class applied to the root element                                                                                                      |
| `canEdit`              | `boolean`                               | `false`  | Enable editing mode                                                                                                                    |
| `fonts`                | `ViewerFontSource[]`                    | n/a      | Licensed font sources supplied by the host application                                                                                 |
| `authorName`           | `string`                                | n/a      | Author name for comments/annotations and collaboration presence                                                                        |
| `collaboration`        | `CollaborationConfig`                   | n/a      | Yjs real-time collaboration config (server URL, room, role)                                                                            |
| `shareDefaults`        | `{ roomId?, userName?, serverUrl? }`    | n/a      | Seed values for the Share dialog fields                                                                                                |
| `smartArt3D`           | `boolean`                               | `false`  | Opt-in Three.js 3D SmartArt renderer (needs the optional `three` dependency; falls back to SVG without it)                             |
| `onOpenFile`           | `() => void`                            | n/a      | Host override for File > Open; bypasses the built-in file picker                                                                       |
| `onContentChange`      | `(content: Uint8Array) => void`         | n/a      | Called with freshly serialised `.pptx` bytes when the content changes                                                                  |
| `onDirtyChange`        | `(isDirty: boolean) => void`            | n/a      | Called when dirty state changes                                                                                                        |
| `onActiveSlideChange`  | `(index: number) => void`               | n/a      | Called when the active slide changes                                                                                                   |
| `onModeChange`         | `(mode: ViewerMode) => void`            | n/a      | Called when the viewer mode changes                                                                                                    |
| `onZoomChange`         | `(zoom: number) => void`                | n/a      | Called when the zoom level changes                                                                                                     |
| `onSelectionChange`    | `(ids: string[]) => void`               | n/a      | Called when element selection changes                                                                                                  |
| `onSlideCountChange`   | `(count: number) => void`               | n/a      | Called when the total slide count changes                                                                                              |
| `onStartCollaboration` | `(config: CollaborationConfig) => void` | n/a      | Called when the user starts a collaboration session from the Share dialog                                                              |
| `onStopCollaboration`  | `() => void`                            | n/a      | Called when the collaboration session stops                                                                                            |
| `theme`                | `ViewerTheme`                           | n/a      | Theme configuration for customising colours, radius, and CSS vars                                                                      |
| `hiddenActions`        | `ToolbarActionId[]`                     | n/a      | Hide individual toolbar buttons and/or ribbon tabs (e.g. `['share', 'broadcast']`) instead of the whole toolbar; omitted hides nothing |
| `defaultThemeKey`      | `string`                                | n/a      | Initial File > Options > Appearance selection when no persisted preference exists                                                      |
| `availableThemes`      | `ThemeCatalogEntry[]`                   | n/a      | Theme choices offered by File > Options > Appearance (defaults to the built-in catalog)                                                |
| `onThemeChange`        | `(key: string) => void`                 | n/a      | Host hook for the appearance picker; when set, the host owns persisting the choice                                                     |
| `defaultLocale`        | `string`                                | n/a      | Initial locale code when no persisted preference exists                                                                                |
| `availableLocales`     | `LocaleCatalogEntry[]`                  | n/a      | Locale choices offered by File > Options > Language (defaults to the registered i18next locales)                                       |
| `onLocaleChange`       | `(code: string) => void`                | n/a      | Host hook for the language picker; when set, the host owns applying/persisting the switch                                              |
| `accountAuth`          | `AccountAuthConfig`                     | n/a      | Optional sign-in hook point for File > Account (disabled unless `enabled: true`)                                                       |

### `PowerPointViewerHandle` (via `ref`)

| Method                  | Signature                    | Description                              |
| ----------------------- | ---------------------------- | ---------------------------------------- |
| `getContent`            | `() => Promise<Uint8Array>`  | Serialise current state to .pptx bytes   |
| `goTo`                  | `(index: number) => void`    | Navigate to a slide by zero-based index  |
| `goPrev`                | `() => void`                 | Navigate to the previous slide           |
| `goNext`                | `() => void`                 | Navigate to the next slide               |
| `undo`                  | `() => void`                 | Undo the last editing action             |
| `redo`                  | `() => void`                 | Redo the last undone action              |
| `canUndo`               | `() => boolean`              | Whether an undo action is available      |
| `canRedo`               | `() => boolean`              | Whether a redo action is available       |
| `getZoom`               | `() => number`               | Get the current zoom level (1 = 100%)    |
| `setZoom`               | `(level: number) => void`    | Set the zoom level                       |
| `zoomIn`                | `() => void`                 | Zoom in by one step                      |
| `zoomOut`               | `() => void`                 | Zoom out by one step                     |
| `zoomReset`             | `() => void`                 | Reset zoom to 100%                       |
| `getMode`               | `() => ViewerMode`           | Get the current viewer mode              |
| `setMode`               | `(mode: ViewerMode) => void` | Switch mode programmatically             |
| `getActiveSlideIndex`   | `() => number`               | Get the zero-based active slide index    |
| `getSlideCount`         | `() => number`               | Get the total number of slides           |
| `isDirty`               | `() => boolean`              | Whether the document has unsaved changes |
| `getSelectedElementIds` | `() => string[]`             | Get IDs of selected elements             |
| `selectElements`        | `(ids: string[]) => void`    | Programmatically select elements by ID   |
| `clearSelection`        | `() => void`                 | Clear the current selection              |

The handle implements the full shared `PowerPointViewerAPI`, so the following
slide/element manipulation methods are also available:
`setActiveSlideIndex(index)`, `getSlides()`, `getSlide(index)`,
`getActiveSlide()`, `addSlide(afterIndex?)`, `deleteSlides(indexes)`,
`duplicateSlides(indexes)`, `moveSlide(from, to)`, `toggleHideSlides(indexes)`,
`getElements(slideIndex?)`, `getElementById(id, slideIndex?)`,
`updateElement(id, patch)`, `deleteElements(ids)`, and
`duplicateElement(id)`.

### `renderToCanvas`

Standalone utility for rendering a DOM element to a Canvas (with an oklch colour-space workaround):

```typescript
import { renderToCanvas } from 'pptx-react-viewer';

const canvas = await renderToCanvas(element, options); // => HTMLCanvasElement
```

### Composing a custom viewer shell

`<PowerPointViewer>` bundles a full editor chrome (toolbar, canvas, side panels, dialogs, presentation mode). If you only need the toolbar and slide canvas, with your own layout around them, `Toolbar` and `SlideCanvas` are exported as standalone components, and `useViewerBuildingBlocks` wires up the same state and hooks `PowerPointViewer` uses internally, mapped into the flat props those two components expect:

```tsx
import { Toolbar, SlideCanvas, useViewerBuildingBlocks } from 'pptx-react-viewer';

function MyCustomViewer({ content }: { content: Uint8Array }) {
	// Also returned: `mode` (current ViewerMode) and `autosaveStatus`
	const { toolbarProps, canvasProps, loading, error } = useViewerBuildingBlocks({
		content,
		canEdit: true,
	});

	if (loading) return <p>Loading…</p>;
	if (error) return <p>Failed to load: {error}</p>;

	return (
		<div className='my-custom-layout'>
			<Toolbar {...toolbarProps} />
			<SlideCanvas {...canvasProps} />
		</div>
	);
}
```

`useViewerBuildingBlocks` accepts the same `content` / `canEdit` / `filePath` / `hiddenActions` / `onDirtyChange`-style inputs as `PowerPointViewer`, plus `onOpenSettings` / `onOpenHeaderFooter` / `onOpenShareDialog` callbacks (fired by the corresponding toolbar buttons) since this composition doesn't render those dialogs itself. It's an additive alternative, not a replacement: dialogs, presentation-mode overlays, mobile chrome, resizable side panels, and real-time collaboration are all part of `PowerPointViewer` and are out of scope for these building blocks. Reach for `PowerPointViewer` when you need the full editor; reach for `useViewerBuildingBlocks` when you're assembling your own chrome around just the toolbar and canvas.

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

Two ready-made presets ship with the package: `vermilionLightTheme` (warm paper canvas) and `vermilionDarkTheme` (dimmed presenter room), the same vermilion brand look as the [documentation site](https://christophervr.github.io/pptx-viewer/):

```tsx
import { PowerPointViewer, vermilionLightTheme } from 'pptx-react-viewer';

<PowerPointViewer content={bytes} theme={vermilionLightTheme} />;
```

The underlying palettes (`vermilionLightColors`, `vermilionDarkColors`) and radius (`vermilionRadius`) are exported too, so you can spread them into your own variant.

## Localization (i18n)

UI labels go through [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) with dotted keys such as `pptx.statusBar.allSaved`. Initialise an i18next instance and wrap your app in `I18nextProvider` (the demo's `demo/i18n.ts` shows a minimal config, including a `parseMissingKeyHandler` that derives Title Case labels for any key you don't explicitly translate). `pptx-react-viewer/i18n` exports `translationsEn` (the English dictionary), `keyToLabel` (the fallback), and a `TranslationKey` type you can use to type-check a new locale dictionary (`Record<TranslationKey, string>`) at compile time. Add a new language by supplying a resource bundle under its language code. See the [Localization guide](https://christophervr.github.io/pptx-viewer/guide/localization) for full wiring examples and how to contribute a translation upstream; the live demo's language picker is a working reference.

## How it's built

You only need the `<PowerPointViewer>` component; everything else is internal. Behind it, the logic lives in many small, focused React hooks, and the components themselves just draw what those hooks produce. Slides are rendered as ordinary HTML and CSS (charts as inline SVG, tables as real `<table>` elements), which is why text stays sharp, selectable, and accessible. For the full component tree, the rendering pipeline, the animation and transition engine, connector routing, collaboration, and a file-by-file map, see the [full documentation](https://christophervr.github.io/pptx-viewer/).

A small curated set of those hooks is exported from `pptx-react-viewer/viewer` with a stable API; the complete set (67+) is also importable from `pptx-react-viewer/internals` for advanced integrations. The `internals` subpath is **not covered by semver**: prefer the stable root exports. See the [Hooks reference](https://christophervr.github.io/pptx-viewer/react/hooks-reference) for the full list.

## Limitations

CSS-based rendering trades a few visual effects for crisp text, accessibility, and DOM interactivity: `backdrop-filter` becomes semi-transparent backgrounds and path gradients approximate as elliptical radials, while `mix-blend-mode` and CSS 3D transforms render natively on screen but flatten in raster export. Text uses fonts available in the browser (embedded fonts are injected when present). Media playback depends on browser codec support. SmartArt is decomposed into editable shapes with a live reflow engine for structural edits, and charts edit via the inspector data grid rather than the chart surface. 3D models need the optional Three.js peer. See the [full docs](https://christophervr.github.io/pptx-viewer/) for the complete list.

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
