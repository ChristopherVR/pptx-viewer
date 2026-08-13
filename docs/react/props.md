---
title: Component Props
description: Complete reference for PowerPointViewerProps - content, editing, callbacks, theming, and collaboration props of the PowerPointViewer component.
---

# Component Props

The `PowerPointViewer` component accepts the `PowerPointViewerProps` interface below. Only `content`
is required; everything else is optional. This reference is taken directly from the source interface.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerProps } from 'pptx-react-viewer';
```

::: tip
`PowerPointViewer` uses `forwardRef`, so you can also pass a `ref` of type
[`PowerPointViewerHandle`](/react/handle) - that is not part of `PowerPointViewerProps`.
:::

## Content

| Prop                 | Type         | Default                | Description                                                                                                 |
| -------------------- | ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `content`            | `Uint8Array` | (required)             | Raw `.pptx` file bytes. Wrap an `ArrayBuffer` with `new Uint8Array(buf)`.                                   |
| `filePath`           | `string`     | -                      | Original file path or name. Used as the key for autosave recovery and display in the title bar.             |
| `autosave`           | `boolean`    | `true`                 | Recovery autosave. A policy ceiling over the title-bar toggle; see [Autosave & Recovery](#autosave-policy). |
| `autosaveIntervalMs` | `number`     | File > Options cadence | Recovery cadence. An explicit value outranks the user's AutoRecover setting.                                |

::: warning `content` type
The prop is a `Uint8Array`, not an `ArrayBuffer`. See [Getting Started](/react/getting-started) for
conversion from a `fetch`/file `ArrayBuffer`.
:::

::: tip Autosave recovery requires `filePath`
The viewer's built-in autosave timer periodically serializes the document to IndexedDB keyed by
`filePath`. On page reload, recovery detection checks for a recent snapshot matching the same
`filePath`. If you don't persist and re-supply `filePath` across reloads, recovery won't trigger.
See [Autosave & Recovery](#autosave-recovery) below.
:::

## Editing

| Prop      | Type      | Default | Description                                                                                                                                        |
| --------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | Enables editing actions (toolbar editing controls, inspector edits, inline text editing, slide management). When `false`, the viewer is read-only. |

## Callbacks

| Prop                  | Type                             | Default | Description                                                                                                                         |
| --------------------- | -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `onDirtyChange`       | `(isDirty: boolean) => void`     | -       | Called when the unsaved-changes flag flips.                                                                                         |
| `onContentChange`     | `(content: Uint8Array) => void`  | -       | Called with the re-serialized document bytes when content changes.                                                                  |
| `onActiveSlideChange` | `(slideIndex: number) => void`   | -       | Called when the active slide changes.                                                                                               |
| `onModeChange`        | `(mode: ViewerMode) => void`     | -       | Called when the viewer mode changes (e.g. edit to present).                                                                         |
| `onZoomChange`        | `(zoom: number) => void`         | -       | Called when the zoom level changes.                                                                                                 |
| `onSelectionChange`   | `(elementIds: string[]) => void` | -       | Called when element selection changes.                                                                                              |
| `onSlideCountChange`  | `(count: number) => void`        | -       | Called when the total slide count changes (slide added/deleted).                                                                    |
| `onOpenFile`          | `() => void`                     | -       | Host override for the File > Open action: bypasses the built-in file picker; the host then supplies a new `content` buffer instead. |

::: info
`onContentChange` delivers a `Uint8Array` (the serialized document), not a boolean. To pull content
on demand instead, use the handle's [`getContent()`](/react/handle).
:::

## Presentation / authoring

| Prop         | Type      | Default | Description                                                                                                                                 |
| ------------ | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorName` | `string`  | -       | Display name used as the author for comments and annotations. Falls back to `collaboration.userName` when collaborating, otherwise `'You'`. |
| `className`  | `string`  | -       | Optional class name applied to the viewer root element.                                                                                     |
| `smartArt3D` | `boolean` | `false` | Opt in to the Three.js SmartArt renderer (extruded 3D blocks on WebGL). Requires the optional `three` peer; falls back to SVG without it.   |

## Theming

| Prop    | Type          | Default | Description                                                                                                                                                                 |
| ------- | ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme` | -       | Theme configuration: partial color overrides, a custom `radius`, and arbitrary `cssVars`. Unset values fall back to the built-in dark theme. See [Theming](/react/theming). |

```tsx
<PowerPointViewer
	content={bytes}
	theme={{
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.75rem',
	}}
/>
```

## Collaboration

These props enable and control real-time co-editing. See [Collaboration](/react/collaboration) for
the full flow and the `CollaborationConfig` shape.

| Prop                   | Type                                                         | Default | Description                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration`        | `CollaborationConfig`                                        | -       | When provided, enables collaborative editing with live cursors, presence, and Yjs CRDT sync. Requires the `yjs` and `y-websocket` peer dependencies. |
| `onStartCollaboration` | `(config: CollaborationConfig) => void`                      | -       | Called when the user starts a session from the Share dialog. The host should set the `collaboration` prop with the returned config.                  |
| `onStopCollaboration`  | `() => void`                                                 | -       | Called when the user stops a session from the Share dialog. The host should clear the `collaboration` prop.                                          |
| `shareDefaults`        | `{ roomId?: string; userName?: string; serverUrl?: string }` | -       | Default values for the Share dialog fields. If omitted, the fields start empty.                                                                      |

::: info
`collaboration` is controlled. The viewer does not start a session on its own - wire
`onStartCollaboration` to set the `collaboration` prop, and `onStopCollaboration` to clear it.
:::

## Interface sketch

::: info Abridged
This block shows the commonly used members, not the whole type. `PowerPointViewerProps`
also carries `ai`, `accountAuth`, `hiddenActions`, `fonts`, `fileName`, `availableThemes`,
`defaultThemeKey`, `onThemeChange`, `availableLocales`, `defaultLocale`, `onLocaleChange`,
`onModeChange`, `onSelectionChange`, `onSlideCountChange` and `onZoomChange`. Read the
shipped `.d.ts` (or `packages/react/src/viewer/types-ui.ts`) for the authoritative list.
:::

```ts
interface PowerPointViewerProps {
	content: Uint8Array;
	filePath?: string;

	onDirtyChange?: (isDirty: boolean) => void;
	onContentChange?: (content: Uint8Array) => void;
	onActiveSlideChange?: (slideIndex: number) => void;
	onOpenFile?: () => void;

	canEdit?: boolean;
	className?: string;
	authorName?: string;
	smartArt3D?: boolean;

	theme?: ViewerTheme;

	collaboration?: CollaborationConfig;
	onStartCollaboration?: (config: CollaborationConfig) => void;
	onStopCollaboration?: () => void;
	shareDefaults?: {
		roomId?: string;
		userName?: string;
		serverUrl?: string;
	};
}
```

## Notes on triggering features

Navigation, mode-switching, zoom, undo/redo, and selection are available through the imperative
[handle](/react/handle) (`ref.current.goNext()`, `ref.current.setMode('present')`, etc.).
Export and print are driven through the built-in toolbar/dialogs.
See [Export](/react/export) for details on document export.

## Autosave & Recovery {#autosave-recovery}

When `canEdit` is true and a `filePath` is supplied, the viewer automatically saves recovery
snapshots to **IndexedDB** on a timer (default every 120 seconds). If the page is closed or crashes,
the data persists in the browser.

### How it works

1. Every 120 s (configurable) the viewer checks if the document is dirty.
2. If dirty, it serializes the current state to a `Uint8Array` and stores it in an IndexedDB
   database (`pptx-viewer-autosave`) keyed by `filePath`.
3. On next load, if the viewer receives the same `filePath` and slides are loaded, it checks
   IndexedDB for a recent snapshot (within 24 hours) and opens the version-history panel.

### Host responsibility

The viewer does **not** persist `filePath` across page reloads on its own. The host app must:

1. **Remember the file identifier** (e.g. store it in `localStorage`, a URL parameter, or a
   backend session).
2. **Re-supply `filePath`** when the viewer remounts after a reload.

Without this, the recovery check has no key to look up and will not find the saved snapshot.

### Recovery helpers (shared package)

The `pptx-viewer-shared` package exports low-level helpers for building custom recovery flows:

```ts
import {
	getAutosaveSnapshot,
	listAutosaveSnapshots,
	deleteAutosaveSnapshot,
	saveAutosaveSnapshot,
} from 'pptx-viewer-shared';

// List all stored snapshots (without the heavy data blob)
const snapshots = await listAutosaveSnapshots();
// => [{ key: 'report.pptx', timestamp: 1720300000000, size: 524288 }, ...]

// Retrieve a specific snapshot by its key (filePath)
const snapshot = await getAutosaveSnapshot('report.pptx');
if (snapshot) {
	// snapshot.data is a Uint8Array you can pass as `content`
	setContent(snapshot.data);
}

// Delete a snapshot (e.g. after the user dismisses recovery)
await deleteAutosaveSnapshot('report.pptx');
```

### Reopening the deck after a refresh {#session-restore}

Recovery snapshots answer "the tab crashed, can I get my edits back?". A plain **refresh** is the
more common case, and it has its own helpers. Every binding re-exports `rememberSessionDeck` /
`restoreSessionDeck` (also available from `pptx-viewer-shared`), which remember the open deck **per
browser tab** and hand it back on the next load:

```ts
import { rememberSessionDeck, restoreSessionDeck } from 'pptx-react-viewer';

// After the host loads a deck:
await rememberSessionDeck(file.name, bytes);

// On mount, before falling back to your file picker:
const deck = await restoreSessionDeck();
if (deck) {
	setContent(deck.data);
	setFilePath(deck.fileName);
}
```

- **Scope is one browser tab.** The record is keyed by an id held in `sessionStorage`, so a refresh
  reopens the deck while a brand-new tab still starts empty, and two tabs holding different decks
  never steal each other's content.
- **Edits are not lost.** `restoreSessionDeck()` prefers a newer autosave snapshot of the same
  `fileName`, so a refresh mid-edit comes back with the edited deck rather than the bytes it was
  opened with.
- **The viewer's own File ▸ Open is covered.** Opening a deck from the backstage (or from Recent)
  swaps it inside the viewer without notifying the host, so those paths record it themselves.
- `forgetSessionDeck()` drops the record. Every call is best-effort: a blocked IndexedDB or a
  partitioned `sessionStorage` degrades to "nothing to restore", never to a thrown error.

All five demo apps use exactly this flow, which is why a refresh keeps the presentation on screen.

### Example: recovery on page reload

```tsx
import { useEffect, useState } from 'react';
import { getAutosaveSnapshot } from 'pptx-viewer-shared';
import { PowerPointViewer } from 'pptx-react-viewer';

const STORAGE_KEY = 'my-app-last-file';

function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);
	const [filePath, setFilePath] = useState('');

	// On mount, check for a recovery snapshot
	useEffect(() => {
		const lastFile = localStorage.getItem(STORAGE_KEY);
		if (!lastFile) return;

		getAutosaveSnapshot(lastFile).then((snapshot) => {
			if (snapshot && Date.now() - snapshot.timestamp < 24 * 60 * 60 * 1000) {
				// Offer recovery (or auto-restore)
				setContent(snapshot.data);
				setFilePath(snapshot.key);
			}
		});
	}, []);

	// When user opens a file, persist the name
	function handleOpen(file: File) {
		localStorage.setItem(STORAGE_KEY, file.name);
		setFilePath(file.name);
		file.arrayBuffer().then((buf) => setContent(new Uint8Array(buf)));
	}

	if (!content) return <FileDropzone onFile={handleOpen} />;

	return <PowerPointViewer content={content} filePath={filePath} canEdit />;
}
```

### Who decides: the `autosave` prop or the AutoSave toggle? {#autosave-policy}

Two things can speak about autosave, so one of them has to win. The rule is the same in **all five
bindings** (react, vue, angular, svelte, vanilla) and lives in one shared decision function,
`resolveAutosaveActivation`:

> **The `autosave` prop is a policy ceiling. The title-bar AutoSave toggle is the user's preference
> inside it.**

| `autosave` prop | What runs                                                       | The toggle                    |
| --------------- | --------------------------------------------------------------- | ----------------------------- |
| omitted         | Autosave runs; the user's toggle decides, defaulting to **on**. | Works.                        |
| `true`          | Same as omitted: the host permits it, the user decides.         | Works.                        |
| `false`         | Autosave is off. No snapshots, and no recovery prompt on load.  | **Inert** (it must not move). |

A host passing an explicit prop is stating what its application permits; a user flipping the switch
is expressing a preference within that. A preference can never exceed a policy, which is why
`autosave={false}` also takes the switch away: a control that silently does nothing is worse than
no control. Two further gates are not negotiable by either party, because without them there is
nothing to write or nowhere to write it: `canEdit` must be true, and `filePath` must be set.

The same rule governs the cadence. An explicit `autosaveIntervalMs` is a host policy and is honoured
as given; omit it and the viewer follows the user's **File > Options > Save > "Save AutoRecover
information every N minutes"** (two minutes by default).

The default is `true` because crash recovery that is off by default is crash recovery nobody has.
Pass `autosave={false}` to opt out.

### Recovering a snapshot

When a deck finishes loading and a snapshot newer than 24 hours exists for the same `filePath`, the
viewer raises a **"Recover unsaved changes?"** dialog offering Restore or Discard. Restore loads the
snapshot's bytes; Discard deletes it. The prompt is deliberately not raised for a snapshot this tab
has already taken delivery of (for example when the host itself restored it through
`restoreSessionDeck`).

### Requirements and status feedback

Autosave automatically disables itself and displays a reason in the title bar when requirements
are not met:

| Condition                 | Status shown                                        | Reason                                                                                |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `filePath` not provided   | "AutoSave disabled: no file path provided"          | The viewer needs a stable key to store the snapshot under. Pass `filePath` to enable. |
| User toggles AutoSave off | "AutoSave off"                                      | The user explicitly disabled it via the title-bar toggle.                             |
| `autosave={false}`        | "AutoSave turned off by this application"           | The host forbade it; the toggle is inert.                                             |
| `canEdit` is false        | "AutoSave disabled: this presentation is read-only" | Autosave is only relevant in edit mode.                                               |

When the missing requirement is resolved (e.g. `filePath` is set), the status automatically
transitions back to `'idle'` and the timer begins.

The `AutosaveStatus` type reflects this:

```ts
type AutosaveStatus =
	| { state: 'idle' }
	| { state: 'disabled'; reason: string }
	| { state: 'saving' }
	| { state: 'saved'; timestamp: number }
	| { state: 'error'; message: string };
```

The `reason` field is one of `'autosave_host_off'`, `'autosave_toggle_off'`, `'no_file_path'` or
`'read_only'`, and maps through the shared `autosaveDisabledReasonKey` to the i18n keys
`pptx.autosave.disabledByHost`, `pptx.autosave.disabledToggleOff`, `pptx.autosave.disabledNoFilePath`
and `pptx.autosave.disabledReadOnly` respectively.
