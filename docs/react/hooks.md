---
title: Hooks
description: The hooks-based architecture of PowerPointViewer, the curated set of public, tree-shakeable hooks exported from pptx-react-viewer/viewer, and the full internal set exposed via pptx-react-viewer/hooks-unstable.
---

# Hooks

`PowerPointViewer` is a thin `forwardRef` orchestrator. Almost all of its logic lives in **67+ custom
hooks** composed inside `PowerPointViewer.tsx`, while the visual components are largely
presentational. State is held entirely in React hooks; there is no external state library.

::: info Internal vs public vs unstable
Most of these hooks are **internal architecture**: they assume a specific composition order and
shared inputs. A small curated subset is exported from `pptx-react-viewer/viewer` with a normal
semver-stable API. The **complete** set is also importable from
`pptx-react-viewer/hooks-unstable`, but with **no compatibility guarantees**: see
[Complete Hooks Reference](/react/hooks-reference).
:::

## Architecture (internal)

These hooks describe how the viewer is wired. They are importable (see below) but assume a
specific composition order and shared inputs; treat this table as conceptual reference, not an
API contract.

| Hook                     | Concern                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `useViewerState`         | Composite state hook (composes core + UI state).                            |
| `useViewerCoreState`     | Document state: slides, selection, canvas size, mode.                       |
| `useViewerUIState`       | UI state: panel visibility, dialog flags, toolbar flags.                    |
| `useDerivedSlideState`   | Computed visible indexes, sections, master pseudo-slide.                    |
| `useEditorHistory`       | Undo/redo snapshot stack with deferred capture during pointer interactions. |
| `useZoomViewport`        | Zoom level, fit-to-width, viewport DOM ref.                                 |
| `useEditorOperations`    | Composes all editor operations into one result.                             |
| `useLoadContent`         | Parses the PPTX buffer on mount via `PptxHandler`.                          |
| `useContentLifecycle`    | Content sync, dirty tracking, recovery detection.                           |
| `usePresentationMode`    | Slideshow navigation, animation, transitions.                               |
| `useExportHandlers`      | PNG / SVG / PDF / GIF / video / PPTX export logic.                          |
| `usePrintHandlers`       | Print dialog and layout.                                                    |
| `useInsertElements`      | Shape / image / text box / table / chart insertion.                         |
| `useElementManipulation` | Move / resize / rotate / delete elements.                                   |
| `useSlideManagement`     | Add / delete / duplicate / reorder / hide slides.                           |
| `useTableOperations`     | Row/column insert/delete, merge/split cells.                                |
| `usePointerHandlers`     | Mouse/touch event processing for the canvas.                                |
| `useKeyboardShortcuts`   | Hotkey definitions.                                                         |
| `useViewerIntegration`   | Top-level integration: I/O, export, print, pointers, lifecycle.             |

There are dozens more (clipboard, comments, sections, autosave, font injection, recovery, theme
handlers, presentation sub-hooks, etc.). See the **[Complete Hooks Reference](/react/hooks-reference)**
for the full list, grouped by concern.

Internal hooks are wiring-heavy by design. `useEditorHistory`, for example, takes the full editor
state plus a setter for every state slice (13 setters) and returns
`{ canUndo, canRedo, undoLabel, redoLabel, handleUndo, handleRedo, resetHistory, markDirty, buildHistorySnapshot }`.
That shape only makes sense inside the component's composition; for standalone undo/redo, mutate
`PptxData` yourself and snapshot it (see [Editing Programmatically](/core/editing)).

## Public hooks

The following are exported from `pptx-react-viewer/viewer` and are safe to import. They are opt-in
and tree-shakeable. Note these come from the **`/viewer`** entry; the root `pptx-react-viewer`
entry exports the component, `renderToCanvas`, theme utilities (including the `useViewerTheme`
context hook), and viewer-preferences helpers, but none of the viewer hooks below.

```tsx
import { useThemeSwitching, useCollaborativeState } from 'pptx-react-viewer/viewer';
```

### `useThemeSwitching`

Switches the loaded **document's** PowerPoint theme (the OOXML color/font scheme, not the viewer
chrome theme; see [Theming](/guide/theming) for that distinction). Works against the same
`PptxHandler` + `PptxData` pair you get from a manual load.

```ts
interface UseThemeSwitchingInput {
	handlerRef: RefObject<PptxHandler | null>;
	data: PptxData | null;
	onDataChange: (newData: PptxData) => void;
	onThemeChanged?: (preset: PptxThemePreset) => void;
}

interface ThemeSwitchingResult {
	presets: readonly PptxThemePreset[]; // built-in presets (office, facet, ion, ...)
	switchToPreset: (preset: PptxThemePreset) => Promise<void>;
	switchToCustom: (
		colorScheme: PptxThemeColorScheme,
		fontScheme?: PptxThemeFontScheme,
		themeName?: string,
	) => Promise<void>;
	currentPreset: PptxThemePreset | undefined; // preset matching the current theme, if any
}
```

`switchToPreset` updates both the in-memory ZIP (so the change survives `save()`) and the parsed
data's resolved element colors.

```tsx
function ThemePicker({ handlerRef, data, setData }: Props) {
	const { presets, switchToPreset, currentPreset } = useThemeSwitching({
		handlerRef,
		data,
		onDataChange: setData,
	});

	return (
		<div>
			{presets.map((preset) => (
				<button
					key={preset.id}
					onClick={() => switchToPreset(preset)}
					aria-pressed={preset.id === currentPreset?.id}
				>
					{preset.name}
				</button>
			))}
		</div>
	);
}
```

### Collaboration hooks

For building custom collaboration UIs or driving sync yourself. See
[Collaboration](/react/collaboration). They require the `yjs` / `y-websocket` optional peers
(loaded dynamically, so they tree-shake away when unused). All of them take the same
`CollaborationConfig` the component's `collaboration` prop accepts: `roomId`, `serverUrl`,
`userName`, plus optional `transport` (`'websocket' | 'webrtc'`), `signaling`, `userColor`,
`userAvatar`, `authToken`, `role`, `sessionIntent`, and the elected-writer `onWriteBack` /
`writeBackDebounceMs` pair.

| Hook                      | Signature (input => result)                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `useYjsProvider`          | `{ config?: CollaborationConfig }` => `{ status, awareness, doc, clientId, synced, retry }`                                                |
| `usePresenceTracking`     | `{ awareness, localClientId, userName, userColor, userAvatar?, role?, canvasWidth, canvasHeight }` => `{ remoteUsers, broadcastPresence }` |
| `useCollaborativeState`   | `{ config?, canvasWidth, canvasHeight }` => `CollaborationContextValue \| null`                                                            |
| `useCollaborativeHistory` | `{ localClientId, handleUndo, handleRedo, canUndo, canRedo }` => same four, wrapped for local-only undo scoping                            |

`useCollaborativeState` is the composition root the built-in `CollaborationProvider` uses: it
manages the transport (`useYjsProvider`) and presence (`usePresenceTracking`) and returns `null`
while `config` is `undefined` (the hooks stay dormant so your tree shape is stable).

```tsx
import { useCollaborativeState } from 'pptx-react-viewer/viewer';

function PresenceBar({ roomId, userName }: { roomId: string; userName: string }) {
	const collab = useCollaborativeState({
		config: { roomId, serverUrl: 'wss://collab.example.com', userName },
		canvasWidth: 960,
		canvasHeight: 540,
	});

	if (!collab) return null;
	return (
		<span>{collab.status === 'connected' ? `${collab.connectedCount} online` : collab.status}</span>
	);
}
```

`useYjsProvider` on its own is the thin transport layer: it lazily imports the Yjs packages,
creates the `Y.Doc` and provider, times out to `status: 'error'` when the connection fails
(recover with `retry()`), and exposes `synced` so late joiners can gate local writes until the
room's document has arrived.

The `CollaborationProvider` component and presence UI (`RemoteUserCursors`, `UserAvatarBar`,
`CollaborationStatusIndicator`) are exported alongside these.

### Audience-window helpers

Not hooks, but exported from `pptx-react-viewer/viewer` for the presenter/audience-window flow:
`isAudienceTab`, `loadAudienceContent`, `storeAudienceContent`, `clearAudienceContent`, and
`parseAudienceNonce`.

## Using an internal hook directly

If the curated public hooks above don't cover what you need, every internal hook is also
importable in full from `pptx-react-viewer/hooks-unstable`:

```tsx
import { useEditorHistory, useViewerState } from 'pptx-react-viewer/hooks-unstable';
```

::: warning No compatibility guarantees
`pptx-react-viewer/hooks-unstable` re-exports the same hooks `PowerPointViewer` composes
internally, unmodified. They are not part of the package's semver contract: signatures and
behavior can change, and hooks can be renamed or removed, in **any** release including a patch
release. Prefer the props/handle API or the curated `pptx-react-viewer/viewer` hooks first; reach
for this only for advanced integrations, and pin an exact version if you depend on it.
:::

See the **[Complete Hooks Reference](/react/hooks-reference)** for the full list and
[Overview](/react/#hooks-based-architecture) for the broader architectural picture.
