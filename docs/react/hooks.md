---
title: Hooks
description: The hooks-based architecture of PowerPointViewer, and the curated set of public, tree-shakeable hooks exported from pptx-viewer/viewer.
---

# Hooks

`PowerPointViewer` is a thin `forwardRef` orchestrator. Almost all of its logic lives in **67+ custom
hooks** composed inside `PowerPointViewer.tsx`, while the visual components are largely
presentational. State is held entirely in React hooks - there is no external state library.

::: info Internal vs public
Most of these hooks are **internal architecture**: they assume a specific composition order and
shared inputs, and are not importable from the package. A curated subset is exported from the
`pptx-viewer/viewer` entry for advanced integrations. The tables below mark which is which.
:::

## Architecture (internal)

These hooks describe how the viewer is wired. They are named in the source and the README but are
**not** part of the supported public import surface - treat them as conceptual reference.

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
handlers, presentation sub-hooks, etc.). The complete list is in the package README's _Hooks
Reference_.

## Public hooks

The following are exported from `pptx-viewer/viewer` and are safe to import. They are opt-in and
tree-shakeable. Note these come from the **`/viewer`** entry - the root `pptx-viewer` entry exports
only the component, `renderToCanvas`, and theme utilities.

```tsx
import { useThemeSwitching, useCollaborativeState } from 'pptx-react-viewer/viewer';
```

### Collaboration hooks

For building custom collaboration UIs or driving sync yourself. See
[Collaboration](/react/collaboration). Require the `yjs` / `y-websocket` optional peers.

| Hook                      | Exported type(s)                                                | Purpose                                                  |
| ------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `useYjsProvider`          | -                                                               | Manages the Yjs WebSocket provider lifecycle.            |
| `usePresenceTracking`     | `UsePresenceTrackingInput`, `UsePresenceTrackingResult`         | Tracks remote cursors, selection, and connection status. |
| `useCollaborativeState`   | `UseCollaborativeStateInput`                                    | CRDT-backed shared document state.                       |
| `useCollaborativeHistory` | `UseCollaborativeHistoryInput`, `UseCollaborativeHistoryResult` | Collaborative undo/redo.                                 |

The `CollaborationProvider` component and presence UI (`RemoteUserCursors`, `UserAvatarBar`,
`CollaborationStatusIndicator`) are exported alongside these.

### Theme switching

| Hook                | Exported type(s)                                 | Purpose                                 |
| ------------------- | ------------------------------------------------ | --------------------------------------- |
| `useThemeSwitching` | `UseThemeSwitchingInput`, `ThemeSwitchingResult` | Switch the document's PowerPoint theme. |

### Audience-window helpers

Not hooks, but exported from `pptx-viewer/viewer` for the presenter/audience-window flow:
`isAudienceTab`, `loadAudienceContent`, `storeAudienceContent`, `clearAudienceContent`.

::: warning Hooks reference table caveat
The package README publishes a large "Hooks Reference" table listing ~40 hooks. Most of those are
internal composition hooks and are **not** importable - only the hooks listed under _Public hooks_
above are re-exported from `pptx-viewer/viewer`. Do not import internal hooks from deep paths; they
have no stability guarantees.
:::

For the broader internal hook map, see [Overview](/react/#hooks-based-architecture) and the package
README.
