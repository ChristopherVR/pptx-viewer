---
title: Hooks
description: The hooks-based architecture of PowerPointViewer, the curated set of public, tree-shakeable hooks exported from pptx-react-viewer/viewer, and the full internal set exposed via pptx-react-viewer/hooks-unstable.
---

# Hooks

`PowerPointViewer` is a thin `forwardRef` orchestrator. Almost all of its logic lives in **67+ custom
hooks** composed inside `PowerPointViewer.tsx`, while the visual components are largely
presentational. State is held entirely in React hooks - there is no external state library.

::: info Internal vs public vs unstable
Most of these hooks are **internal architecture**: they assume a specific composition order and
shared inputs. A small curated subset is exported from `pptx-react-viewer/viewer` with a normal
semver-stable API. The **complete** set - every hook listed below - is also importable from
`pptx-react-viewer/hooks-unstable`, but with **no compatibility guarantees**: see
[Complete Hooks Reference](/react/hooks-reference). The tables below mark which category each hook falls into.
:::

## Architecture (internal)

These hooks describe how the viewer is wired. They are importable (see below) but assume a
specific composition order and shared inputs - treat this table as conceptual reference, not an
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
for the full list, grouped by concern, and how to import all of them from
`pptx-react-viewer/hooks-unstable`.

## Public hooks

The following are exported from `pptx-react-viewer/viewer` and are safe to import. They are opt-in and
tree-shakeable. Note these come from the **`/viewer`** entry - the root `pptx-react-viewer` entry exports
only the component, `renderToCanvas`, and theme utilities.

```tsx
import { useThemeSwitching, useCollaborativeState } from 'pptx-react-viewer/viewer';
```

### Collaboration hooks

For building custom collaboration UIs or driving sync yourself. See
[Collaboration](/react/collaboration). Require the `yjs` / `y-websocket` optional peers.

| Hook                      | Exported type(s)                | Purpose                                                  |
| ------------------------- | ------------------------------- | -------------------------------------------------------- |
| `useYjsProvider`          | -                               | Manages the Yjs WebSocket provider lifecycle.            |
| `usePresenceTracking`     | `UsePresenceTrackingResult`     | Tracks remote cursors, selection, and connection status. |
| `useCollaborativeState`   | `UseCollaborativeStateInput`    | CRDT-backed shared document state.                       |
| `useCollaborativeHistory` | `UseCollaborativeHistoryResult` | Collaborative undo/redo.                                 |

The `CollaborationProvider` component and presence UI (`RemoteUserCursors`, `UserAvatarBar`,
`CollaborationStatusIndicator`) are exported alongside these.

### Theme switching

| Hook                | Exported type(s)                                 | Purpose                                 |
| ------------------- | ------------------------------------------------ | --------------------------------------- |
| `useThemeSwitching` | `UseThemeSwitchingInput`, `ThemeSwitchingResult` | Switch the document's PowerPoint theme. |

### Audience-window helpers

Not hooks, but exported from `pptx-react-viewer/viewer` for the presenter/audience-window flow:
`isAudienceTab`, `loadAudienceContent`, `storeAudienceContent`, `clearAudienceContent`.

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
