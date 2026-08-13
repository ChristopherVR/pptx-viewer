---
title: Options & Callbacks
description: Complete reference for PptxViewerOptions and PptxViewerCallbacks - source, theme, locale, chrome toggles, renderer registry, autosave, collaboration, and every onLoad/onError/onSlideChange-style callback.
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

| Option     | Type                 | Default | Description                                                                                                    |
| ---------- | -------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `source`   | `PptxViewerSource`   | -       | The presentation to open: raw bytes (`ArrayBuffer` / `Uint8Array`), a `Blob`/`File`, or a URL string to fetch. |
| `fileName` | `string`             | -       | Display name shown in the PowerPoint-style title bar.                                                          |
| `fonts`    | `ViewerFontSource[]` | -       | Licensed font sources supplied by the host application (`{ family, src, format?, weight?, style? }`).          |

```ts
type PptxViewerSource = ArrayBuffer | Uint8Array | Blob | string;
```

## Chrome & initial state

| Option              | Type                | Default | Description                                                                                                                                                                                   |
| ------------------- | ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialSlide`      | `number`            | `0`     | Zero-based slide to show after load (clamped).                                                                                                                                                |
| `showToolbar`       | `boolean`           | `true`  | Show the navigation/zoom/fullscreen toolbar.                                                                                                                                                  |
| `showThumbnails`    | `boolean`           | `true`  | Show the thumbnail sidebar.                                                                                                                                                                   |
| `showFormatToolbar` | `boolean`           | `true`  | Build the editing format toolbar row (bold/fill/insert/z-order). The row is only _visible_ while editing is enabled.                                                                          |
| `showInspector`     | `boolean`           | `true`  | Build the property inspector panel (position/size/fill/line). Only _visible_ while editing is enabled.                                                                                        |
| `hiddenActions`     | `ToolbarActionId[]` | -       | Individually hide toolbar buttons and/or ribbon tabs; see below.                                                                                                                              |
| `editable`          | `boolean`           | `false` | Enable editing: click to select, drag/resize/rotate, inline text editing, keyboard shortcuts, undo/redo, and the toolbar Save button. Toggle later via [`setEditable`](/vanilla/api#editing). |
| `readOnly`          | `boolean`           | -       | Legacy flag superseded by `editable`; kept so existing option objects stay type-valid. It has no effect.                                                                                      |

### `hiddenActions`

Each id in `ToolbarActionId` controls one quick-access button, one control cluster, or one whole
ribbon tab; unlike `showToolbar`, this hides individual pieces rather than the whole chrome:

- **Buttons/clusters**: `'share'`, `'broadcast'`, `'export'`, `'undo'`, `'redo'`, `'record'`,
  `'notes'`, `'fullscreen'`, `'zoom'` (zoom in/out/fit as a unit), `'navigation'` (prev/next as a
  unit).
- **Ribbon tabs**: `'file'`, `'home'`, `'insert'`, `'draw'`, `'design'`, `'transitions'`,
  `'animations'`, `'slideShow'`, `'record'`, `'review'`, `'view'`, `'help'`.

`'record'` hides both the quick-access Record control and the Record ribbon tab, since they surface
the same feature.

## Theming & localization {#theming--localization}

| Option             | Type                            | Default                 | Description                                                                                                                                                     |
| ------------------ | ------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`            | `ViewerTheme`                   | -                       | Viewer chrome theme (shared `ViewerTheme`: colors, radius, CSS vars). See [Theming](/vanilla/theming).                                                          |
| `locale`           | `string`                        | `'en'`                  | UI locale. Dictionaries come from `messages`; English is built in.                                                                                              |
| `messages`         | `TranslationMessages`           | -                       | Per-locale `pptx.*` message dictionaries. English falls back to the built-in shared dictionary; other locales fall back to English.                             |
| `availableThemes`  | `readonly ThemeCatalogEntry[]`  | shared theme catalog    | Theme choices offered by File > Options > Appearance (default/light/vermilion light/vermilion dark), also highlighted in the Design tab's quick-access gallery. |
| `availableLocales` | `readonly LocaleCatalogEntry[]` | registered dictionaries | Language choices offered by File > Options > Language. Defaults to every locale with a registered `messages` dictionary plus `'en'`.                            |
| `accountAuth`      | `AccountAuthConfig`             | disabled                | Optional hook point wiring a real sign-in flow into File > Account (`{ enabled, onSignIn, signedInUser? }`); renders nothing unless `enabled: true`.            |

`TranslationMessages` is a `Record<string, Record<string, string>>`: locale code to a flat
dictionary of dotted `pptx.*` keys. Theme and locale can be changed later via
[`setTheme` / `setLocale`](/vanilla/api#theming--localization).

`ThemeCatalogEntry` is `{ key: string; labelKey: string; theme: ViewerTheme | undefined }`
(`undefined` resets to the built-in default); `LocaleCatalogEntry` is
`{ code: string; label: string; nativeLabel: string }`.

## Extension

| Option       | Type                      | Default                   | Description                                                                                                                                                                                                                                                  |
| ------------ | ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registry`   | `ElementRendererRegistry` | `createDefaultRegistry()` | Custom element-renderer registry; pass your own (or mutate the default via `getRegistry()`) to add or override element renderers. See [Element Renderers](/vanilla/renderers).                                                                               |
| `smartArt3D` | `boolean`                 | `false`                   | Opt-in WebGL SmartArt renderer: renders `smartArt` elements as an extruded Three.js scene. `three` is an optional peer dependency, lazily imported only when `true`; if unavailable, the SVG renderer is used. Set once at construction (no runtime setter). |

## Autosave

Debounced crash-recovery snapshots in a shared IndexedDB store. Autosave never replaces the user's
real Save; it is a safety net offered back on the next start.

| Option               | Type      | Default                | Description                                                                                                      |
| -------------------- | --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `autosave`           | `boolean` | `true`                 | Recovery autosave; the toolbar shows a small status pill. A policy ceiling over the title-bar toggle; see below. |
| `autosaveIntervalMs` | `number`  | File > Options cadence | Debounce window (ms). An explicit value outranks the user's AutoRecover setting.                                 |
| `autosaveFilePath`   | `string`  | `'presentation.pptx'`  | IndexedDB recovery key for autosave.                                                                             |

Runtime control lives on the instance: [`autosaveNow` / `setAutosaveEnabled` /
`isAutosaveEnabled`](/vanilla/api#autosave).

### Who decides: the `autosave` prop or the AutoSave toggle? {#autosave-policy}

The rule is the same in **all five bindings** and lives in one shared decision function,
`resolveAutosaveActivation`:

> **The `autosave` prop is a policy ceiling. The title-bar AutoSave toggle is the user's preference
> inside it.**

| `autosave` | What runs                                                       | The toggle                    |
| ---------- | --------------------------------------------------------------- | ----------------------------- |
| omitted    | Autosave runs; the user's toggle decides, defaulting to **on**. | Works.                        |
| `true`     | Same as omitted: the host permits it, the user decides.         | Works.                        |
| `false`    | Autosave is off, and no recovery prompt is offered on load.     | **Inert** (it must not move). |

A preference can never exceed a policy, which is why `autosave: false` also takes the switch away: a
control that silently does nothing is worse than no control. `canEdit`/`editable` and a `filePath`
key remain hard requirements either way.

The same rule governs the cadence: an explicit `autosaveIntervalMs` is a host policy honoured as
given, and omitting it follows the user's **File > Options > Save > "Save AutoRecover information
every N minutes"** (two minutes by default).

The default is `true` because crash recovery that is off by default is crash recovery nobody has.

### Recovering a snapshot

When a deck finishes loading and a snapshot newer than 24 hours exists for the same key, the viewer
raises a **"Recover unsaved changes?"** dialog offering Restore or Discard. Restore loads the
snapshot's bytes; Discard deletes it. It is deliberately not raised for a snapshot this tab has
already taken delivery of (for example when the host itself restored it through
`restoreSessionDeck`).

## Collaboration

| Option          | Type                  | Default | Description                                                                                                                                                                        |
| --------------- | --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration` | `CollaborationConfig` | -       | Start a real-time collaboration session immediately (Yjs over y-websocket or serverless y-webrtc). A `role: 'viewer'` config forces read-only.                                     |
| `shareDefaults` | `ShareDefaults`       | -       | Prefilled values for the built-in Share/Broadcast dialog form fields (`{ roomId?, userName?, serverUrl? }`); the broadcast dialog uses `userName` as the presenter's display name. |

Sessions can also be started or stopped later with
[`startCollaboration` / `stopCollaboration`](/vanilla/api#collaboration).

::: warning Wire-format limitation
Media/OLE/3D/ink binary payloads are not carried over the wire (a shared codec limitation), and a
remote update replaces the whole local slide array, so a joiner's host-provided media can degrade.
:::

## Callbacks

`PptxViewerOptions` extends `PptxViewerCallbacks` - there is no framework event system, so events
are plain callback options:

| Callback                | Signature                                                        | Description                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onLoad`                | `(info: { slideCount: number; canvasSize: CanvasSize }) => void` | Fired after a presentation loads successfully.                                                                                                                                                                            |
| `onError`               | `(message: string, error: unknown) => void`                      | Fired when a load fails (message is already localised/best-effort).                                                                                                                                                       |
| `onSlideChange`         | `(index: number) => void`                                        | Fired when the active slide changes (zero-based index).                                                                                                                                                                   |
| `onZoomChange`          | `(scale: number) => void`                                        | Fired when the effective zoom scale changes (1 = 100%).                                                                                                                                                                   |
| `onPresentationChange`  | `(presenting: boolean) => void`                                  | Fired when presentation (fullscreen) mode is entered or exited.                                                                                                                                                           |
| `onChange`              | `() => void`                                                     | Fired after any document mutation (move, resize, edit, undo, ...).                                                                                                                                                        |
| `onDirtyChange`         | `(dirty: boolean) => void`                                       | Fired when the unsaved-edits flag flips (a save resets it).                                                                                                                                                               |
| `onSelectionChange`     | `(elementId: string \| null) => void`                            | Fired when the selected element changes (`null` = no selection).                                                                                                                                                          |
| `onAutosaveStatus`      | `(status: AutosaveStatus) => void`                               | Fired on every autosave lifecycle transition (`'idle' \| 'saving' \| 'saved' \| 'error'`).                                                                                                                                |
| `onAutosaveRecovery`    | `(record: AutosaveRecord) => void`                               | Offered a recovery snapshot found on start; the host decides whether to restore it (see below).                                                                                                                           |
| `onCollaborationStatus` | `(status: ConnectionStatus) => void`                             | Fired on every collaboration connection-status transition (`'disconnected' \| 'connecting' \| 'connected' \| 'error'`).                                                                                                   |
| `onThemeChange`         | `(key: string) => void`                                          | Fired when a theme is selected via File > Options > Appearance (or a `setTheme` call matching a catalog entry). When supplied, the host owns persistence; otherwise the viewer uses `localStorage` (`pptx-viewer-prefs`). |
| `onLocaleChange`        | `(code: string) => void`                                         | Fired when a language is selected via File > Options > Language (or any `setLocale` call). Same persistence rule as `onThemeChange`.                                                                                      |
| `onToggleAutosave`      | `(enabled: boolean) => void`                                     | Fired when the title-bar AutoSave control enables or disables recovery autosave.                                                                                                                                          |

`AutosaveRecord` is `{ key: string; data: Uint8Array; timestamp: number; size: number }`; a typical
recovery flow is `viewer.loadFile(record.data)`.

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
	onAutosaveStatus?: (status: AutosaveStatus) => void;
	onAutosaveRecovery?: (record: AutosaveRecord) => void;
	onCollaborationStatus?: (status: ConnectionStatus) => void;
}

interface PptxViewerOptions extends PptxViewerCallbacks {
	source?: PptxViewerSource;
	fonts?: ViewerFontSource[];
	theme?: ViewerTheme;
	fileName?: string;
	locale?: string;
	messages?: TranslationMessages;
	availableThemes?: readonly ThemeCatalogEntry[];
	availableLocales?: readonly LocaleCatalogEntry[];
	onThemeChange?: (key: string) => void;
	onLocaleChange?: (code: string) => void;
	accountAuth?: AccountAuthConfig;
	initialSlide?: number;
	editable?: boolean;
	readOnly?: boolean;
	showToolbar?: boolean;
	showThumbnails?: boolean;
	showFormatToolbar?: boolean;
	showInspector?: boolean;
	hiddenActions?: ToolbarActionId[];
	registry?: ElementRendererRegistry;
	smartArt3D?: boolean;
	autosave?: boolean;
	onToggleAutosave?: (enabled: boolean) => void;
	autosaveIntervalMs?: number;
	autosaveFilePath?: string;
	collaboration?: CollaborationConfig;
	shareDefaults?: ShareDefaults;
}
```

## Example: everything wired

```ts
import { createPptxViewer, vermilionLightTheme } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx',
	fileName: 'quarterly.pptx',
	theme: vermilionLightTheme,
	locale: 'en',
	initialSlide: 0,
	editable: true,
	showToolbar: true,
	showThumbnails: true,
	hiddenActions: ['broadcast', 'record'],
	autosave: true,
	autosaveFilePath: 'quarterly.pptx',
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
	onSlideChange: (index) => console.log('slide', index + 1),
	onZoomChange: (scale) => console.log(`${Math.round(scale * 100)}%`),
	onPresentationChange: (presenting) => console.log(presenting ? 'presenting' : 'back'),
	onDirtyChange: (dirty) => console.log('unsaved edits:', dirty),
	onSelectionChange: (elementId) => console.log('selected', elementId),
	onAutosaveStatus: (status) => console.log('autosave:', status),
	onAutosaveRecovery: (record) => {
		if (confirm('Restore unsaved changes from your last session?')) {
			void viewer.loadFile(record.data);
		}
	},
	onError: (message) => console.error(message),
});
```
