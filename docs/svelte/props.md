---
title: Svelte Viewer Component Props
description: The complete props and event-callback contract of the PowerPointViewer Svelte 5 component - content, appearance, chrome, editing, autosave, and collaboration.
---

# Component Props

`<PowerPointViewer>` follows the Vue binding's contract with two Svelte 5 conventions:
events are **callback props** (`onload`, not `@load`), and the content prop is named
**`source`**.

## Content and appearance

| Prop     | Type                                             | Default  | Description                                                                                          |
| -------- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `source` | `Uint8Array \| ArrayBuffer \| null \| undefined` | -        | Raw `.pptx` bytes. Assigning a new value loads the new presentation in place.                        |
| `fonts`  | `ViewerFontSource[]`                             | -        | Licensed font sources supplied by the host (`{ family, src, format?, weight?, style? }`).            |
| `theme`  | `ViewerTheme`                                    | built-in | Partial palette / radius / raw CSS vars; see [Theming](/svelte/theming).                             |
| `locale` | `string`                                         | `'en'`   | UI locale (BCP 47). Register non-English dictionaries via [`pptx-svelte-viewer/i18n`](/svelte/i18n). |
| `class`  | `string`                                         | -        | Extra class on the root element.                                                                     |

## Chrome and behaviour

| Prop             | Type                | Default | Description                                                                                                                                                    |
| ---------------- | ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialSlide`   | `number`            | `0`     | Slide shown after load (0-based, clamped).                                                                                                                     |
| `showThumbnails` | `boolean`           | `true`  | Show the thumbnail sidebar.                                                                                                                                    |
| `showToolbar`    | `boolean`           | `true`  | Show the navigation/zoom toolbar (and, when `editable`, the ribbon).                                                                                           |
| `showNotes`      | `boolean`           | `true`  | Show the speaker-notes panel and its toolbar toggle. Pass `onnotesupdate` to make the panel editable; omit it for read-only notes.                             |
| `hiddenActions`  | `ToolbarActionId[]` | -       | Toolbar buttons and/or ribbon tabs to hide (see [values below](#hiddenactions-values)).                                                                        |
| `fileName`       | `string`            | -       | Display name shown in the desktop title bar.                                                                                                                   |
| `smartArt3D`     | `boolean`           | `false` | Opt in to the Three.js (WebGL) SmartArt renderer. Requires the optional `three` dependency; falls back to SVG when it is unavailable or the WebGL mount fails. |
| `editable`       | `boolean`           | `false` | Enable in-place editing: select, drag, resize/rotate handles, double-click text editing, keyboard shortcuts, undo/redo, save/download.                         |

### `hiddenActions` values {#hiddenactions-values}

`ToolbarActionId` is a union of quick-access **button** ids and ribbon **tab** ids:

- Buttons: `share`, `broadcast`, `export`, `undo`, `redo`, `record`, `notes`, `fullscreen`, `zoom`, `navigation`
- Tabs: `file`, `home`, `insert`, `draw`, `design`, `transitions`, `animations`, `slideShow`, `record`, `review`, `view`, `help`

`zoom` and `navigation` each hide their whole control cluster. `record` is shared by the
quick-access button and the ribbon tab, so hiding it removes both.

```svelte
<!-- A read-only embed with the collaboration entry points removed -->
<PowerPointViewer source={bytes} hiddenActions={['share', 'broadcast']} />
```

## File > Options pickers {#options-pickers}

These drive the built-in Appearance and Language pickers under File > Options. Without the
`on*Change` callbacks the user's choice is persisted to `localStorage` automatically; supplying
a callback hands persistence to the host.

| Prop               | Type                            | Default                  | Description                                                                                                      |
| ------------------ | ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `defaultThemeKey`  | `string`                        | stored, else `'default'` | Initial Appearance selection: a key into `availableThemes` (or the built-in `THEME_CATALOG`).                    |
| `availableThemes`  | `readonly ThemeCatalogEntry[]`  | `THEME_CATALOG`          | Theme choices offered by the Appearance picker.                                                                  |
| `onThemeChange`    | `(themeKey: string) => void`    | -                        | Fired when the user picks a theme (Design tab or Options).                                                       |
| `defaultLocale`    | `string`                        | stored, else `locale`    | Initial Language selection (locale code).                                                                        |
| `availableLocales` | `readonly LocaleCatalogEntry[]` | registered locales       | Language choices offered by the Language picker; defaults to every locale registered via `registerTranslations`. |
| `onLocaleChange`   | `(locale: string) => void`      | -                        | Fired when the user picks a language from Options.                                                               |
| `accountAuth`      | `AccountAuthConfig`             | disabled                 | Optional hook point for a real sign-in flow in File > Account (`{ enabled, onSignIn, signedInUser? }`).          |

::: tip Precedence
Once the user picks a theme from the UI, that catalog key drives the effective theme for the
rest of the session; the `theme` prop still wins whenever the resolved key is `'default'`.
Similarly, a user-picked language always wins over the `locale` prop for the session.
:::

## Autosave

See [Getting Started > Autosave](/svelte/getting-started#autosave) for the full flow.

| Prop                 | Type      | Default | Description                                                                                   |
| -------------------- | --------- | ------- | --------------------------------------------------------------------------------------------- |
| `autosave`           | `boolean` | `false` | Enable debounced crash-recovery autosave to the shared IndexedDB store (requires `filePath`). |
| `filePath`           | `string`  | -       | IndexedDB record key (typically the open file's name/path). Autosave is inert without one.    |
| `autosaveIntervalMs` | `number`  | `2000`  | Autosave debounce window in milliseconds.                                                     |

## Collaboration

See [Collaboration](/svelte/collaboration) for the config shape and transports.

| Prop            | Type                                                         | Default | Description                                                                                      |
| --------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `collaboration` | `CollaborationConfig`                                        | -       | When set, connects to the room and syncs edits in real time. Clearing it tears the session down. |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string }` | -       | Prefilled values for the built-in Share dialog (Broadcast reuses `serverUrl`).                   |

## Event callbacks

| Prop                   | Signature                               | Fired when                                                                                                   |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `onload`               | `(detail: ViewerLoadDetail) => void`    | A presentation finishes loading (`{ slideCount, canvasSize }`).                                              |
| `onerror`              | `(message: string) => void`             | A load fails (message is human-readable).                                                                    |
| `onslidechange`        | `(index: number) => void`               | The active slide changes (0-based).                                                                          |
| `onchange`             | `() => void`                            | After every committed editing mutation (move / resize / rotate / delete / duplicate / nudge / text / notes). |
| `ondirtychange`        | `(dirty: boolean) => void`              | The unsaved-edits flag flips.                                                                                |
| `oncontentchange`      | `(content: Uint8Array) => void`         | The serialized document bytes change.                                                                        |
| `onmodechange`         | `(mode: string) => void`                | The viewer mode changes (`'preview' \| 'edit' \| 'present' \| 'master'`).                                    |
| `onzoomchange`         | `(zoom: number) => void`                | The zoom level changes (1 = 100%).                                                                           |
| `onselectionchange`    | `(elementIds: string[]) => void`        | The element selection changes.                                                                               |
| `onslidecountchange`   | `(count: number) => void`               | The total slide count changes.                                                                               |
| `onnotesupdate`        | `(notes: string) => void`               | The user commits a speaker-notes edit (`change` / `blur`). Omit to render the notes panel read-only.         |
| `onopenfile`           | `() => void`                            | Host override for the File > Open action.                                                                    |
| `onautosave`           | `(bytes: Uint8Array) => void`           | After each successful autosave snapshot.                                                                     |
| `onautosavetoggle`     | `(enabled: boolean) => void`            | The desktop title bar toggles AutoSave.                                                                      |
| `onstartcollaboration` | `(config: CollaborationConfig) => void` | The user starts a session from the Share/Broadcast dialog.                                                   |
| `onstopcollaboration`  | `() => void`                            | The user stops the collaboration session.                                                                    |
| `onThemeChange`        | `(themeKey: string) => void`            | The user picks a theme (note the camelCase name; it belongs to the Options-picker group above).              |
| `onLocaleChange`       | `(locale: string) => void`              | The user picks a language (camelCase, Options-picker group).                                                 |

## Payload types

```ts
interface ViewerLoadDetail {
	/** Number of slides in the loaded presentation. */
	slideCount: number;
	/** Slide canvas size in pixels. */
	canvasSize: CanvasSize; // { width: number; height: number }
}
```

## Type exports

```ts
import type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	PowerPointViewerApi,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
	ViewerThemeColors,
	AutosaveStatus,
	AutosaveRecord,
} from 'pptx-svelte-viewer';
```

Theme presets and helpers (`vermilionLightTheme`, `vermilionDarkTheme`, `defaultThemeColors`,
`defaultRadius`, `themeToCssVars`, `defaultCssVars`) are exported from the package root; i18n
helpers (`registerTranslations`, `translate`, `keyToLabel`, `translationsEn`, and the
`TranslationKey` type) live under `pptx-svelte-viewer/i18n`. See [Theming](/svelte/theming)
and [Localization](/svelte/i18n).
