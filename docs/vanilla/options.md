---
title: Options & Callbacks
description: Complete reference for PptxViewerOptions and PptxViewerCallbacks - source, theme, locale, chrome toggles, renderer registry, and the onLoad/onError/onSlideChange/onZoomChange/onPresentationChange callbacks.
---

# Options & Callbacks

`createPptxViewer(container, options)` takes the `PptxViewerOptions` interface below. Every option
is optional, including `source` (omit it to start empty and call
[`loadFile` / `loadUrl`](/vanilla/api#loading) later). This reference is taken directly from
`packages/vanilla/src/viewer/types.ts`.

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';
import type { PptxViewerOptions, PptxViewerCallbacks } from 'pptx-vanilla-viewer';
```

::: tip
The factory also returns an imperative handle, see [Viewer Instance API](/vanilla/api) - that is not
part of `PptxViewerOptions`.
:::

## Content

| Option   | Type               | Default | Description                                                                                                    |
| -------- | ------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `source` | `PptxViewerSource` | -       | The presentation to open: raw bytes (`ArrayBuffer` / `Uint8Array`), a `Blob`/`File`, or a URL string to fetch. |

```ts
type PptxViewerSource = ArrayBuffer | Uint8Array | Blob | string;
```

## Chrome & initial state

| Option           | Type      | Default | Description                                                                                                                                                                                   |
| ---------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialSlide`   | `number`  | `0`     | Zero-based slide to show after load (clamped).                                                                                                                                                |
| `showToolbar`    | `boolean` | `true`  | Show the navigation/zoom/fullscreen toolbar.                                                                                                                                                  |
| `showThumbnails` | `boolean` | `true`  | Show the thumbnail sidebar.                                                                                                                                                                   |
| `editable`       | `boolean` | `false` | Enable editing: click to select, drag/resize/rotate, inline text editing, keyboard shortcuts, undo/redo, and the toolbar Save button. Toggle later via [`setEditable`](/vanilla/api#editing). |
| `readOnly`       | `boolean` | -       | Legacy flag superseded by `editable`; kept so existing option objects stay type-valid. It has no effect.                                                                                      |

## Theming & localization

| Option     | Type                  | Default | Description                                                                                                                         |
| ---------- | --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `theme`    | `ViewerTheme`         | -       | Viewer chrome theme (shared `ViewerTheme`: colors, radius, CSS vars). See [Theming](/vanilla/theming).                              |
| `locale`   | `string`              | `'en'`  | UI locale. Dictionaries come from `messages`; English is built in.                                                                  |
| `messages` | `TranslationMessages` | -       | Per-locale `pptx.*` message dictionaries. English falls back to the built-in shared dictionary; other locales fall back to English. |

`TranslationMessages` is a `Record<string, Record<string, string>>`: locale code to a flat
dictionary of dotted `pptx.*` keys. Both can be changed later via
[`setTheme` / `setLocale`](/vanilla/api#theming--localization).

## Extension

| Option     | Type                      | Default                   | Description                                                                                                                                                                    |
| ---------- | ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registry` | `ElementRendererRegistry` | `createDefaultRegistry()` | Custom element-renderer registry; pass your own (or mutate the default via `getRegistry()`) to add or override element renderers. See [Element Renderers](/vanilla/renderers). |

## Callbacks

`PptxViewerOptions` extends `PptxViewerCallbacks` - there is no framework event system, so events
are plain callback options:

| Callback               | Signature                                                        | Description                                                         |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `onLoad`               | `(info: { slideCount: number; canvasSize: CanvasSize }) => void` | Fired after a presentation loads successfully.                      |
| `onError`              | `(message: string, error: unknown) => void`                      | Fired when a load fails (message is already localised/best-effort). |
| `onSlideChange`        | `(index: number) => void`                                        | Fired when the active slide changes (zero-based index).             |
| `onZoomChange`         | `(scale: number) => void`                                        | Fired when the effective zoom scale changes (1 = 100%).             |
| `onPresentationChange` | `(presenting: boolean) => void`                                  | Fired when presentation (fullscreen) mode is entered or exited.     |
| `onChange`             | `() => void`                                                     | Fired after any document mutation (move, resize, edit, undo, ...).  |
| `onDirtyChange`        | `(dirty: boolean) => void`                                       | Fired when the unsaved-edits flag flips (a save resets it).         |
| `onSelectionChange`    | `(elementId: string \| null) => void`                            | Fired when the selected element changes (`null` = no selection).    |

## Full interface

```ts
interface PptxViewerCallbacks {
	onLoad?: (info: { slideCount: number; canvasSize: CanvasSize }) => void;
	onError?: (message: string, error: unknown) => void;
	onSlideChange?: (index: number) => void;
	onZoomChange?: (scale: number) => void;
	onPresentationChange?: (presenting: boolean) => void;
	onChange?: () => void;
	onDirtyChange?: (dirty: boolean) => void;
	onSelectionChange?: (elementId: string | null) => void;
}

interface PptxViewerOptions extends PptxViewerCallbacks {
	source?: PptxViewerSource;
	theme?: ViewerTheme;
	locale?: string;
	messages?: TranslationMessages;
	initialSlide?: number;
	editable?: boolean;
	readOnly?: boolean;
	showToolbar?: boolean;
	showThumbnails?: boolean;
	registry?: ElementRendererRegistry;
}
```

## Example: everything wired

```ts
import { createPptxViewer, vermilionLightTheme } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx',
	theme: vermilionLightTheme,
	locale: 'en',
	initialSlide: 0,
	editable: true,
	showToolbar: true,
	showThumbnails: true,
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
	onSlideChange: (index) => console.log('slide', index + 1),
	onZoomChange: (scale) => console.log(`${Math.round(scale * 100)}%`),
	onPresentationChange: (presenting) => console.log(presenting ? 'presenting' : 'back'),
	onDirtyChange: (dirty) => console.log('unsaved edits:', dirty),
	onSelectionChange: (elementId) => console.log('selected', elementId),
	onError: (message) => console.error(message),
});
```
