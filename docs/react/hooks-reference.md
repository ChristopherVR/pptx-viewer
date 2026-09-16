---
title: Complete Hooks Reference
description: The full list of every internal hook that composes PowerPointViewer, and how to import them via pptx-react-viewer/internals.
---

# Complete Hooks Reference

This is the complete list referenced from the [Hooks](/react/hooks) page: every hook that composes
`PowerPointViewer` internally, grouped by concern. For the small curated subset that has a
semver-stable public API, see [Hooks -> Public hooks](/react/hooks#public-hooks) instead.

::: warning Internal building blocks
All of the hooks below are importable from `pptx-react-viewer/internals`, but the name is
literal: they are not covered by semver, so signatures, behavior, and existence can change without
a major bump. Reach for this entry only when the curated `pptx-react-viewer/viewer` export and the
public `PowerPointViewer` props/handle genuinely can't do what you need. Pin an exact version if
you depend on it.

```tsx
import { useViewerState, useEditorHistory } from 'pptx-react-viewer/internals';
```

:::

## Core state & lifecycle

| Hook                     | Concern                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `useViewerState`         | Composite state hook (composes core + UI state).                |
| `useViewerCoreState`     | Document state: slides, selection, canvas size, mode.           |
| `useViewerUIState`       | UI state: panel visibility, dialog flags, toolbar flags.        |
| `useDerivedSlideState`   | Computed visible indexes, sections, master pseudo-slide.        |
| `useDerivedElementState` | Computed per-element derived state (bounds, handles, z-order).  |
| `useContentLifecycle`    | Content sync, dirty tracking, recovery detection wiring.        |
| `useLoadContent`         | Parses the PPTX buffer on mount via `PptxHandler`.              |
| `useRecoveryDetection`   | Detects a prior unsaved session to offer recovery.              |
| `useAutosave`            | Periodic autosave scheduling and status.                        |
| `useSerialize`           | Serializes the current document back to bytes.                  |
| `useViewerIntegration`   | Top-level integration: I/O, export, print, pointers, lifecycle. |

## Editing & history

| Hook                         | Concern                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `useEditorHistory`           | Undo/redo snapshot stack with deferred capture during pointer interactions. |
| `useEditorOperations`        | Composes all editor operations into one result.                             |
| `useElementOperations`       | Element create/update/delete primitives.                                    |
| `useElementManipulation`     | Move / resize / rotate / delete elements.                                   |
| `useSectionOperations`       | Section (slide grouping) create/rename/delete.                              |
| `useTableOperations`         | Row/column insert/delete, merge/split cells.                                |
| `useSlideManagement`         | Add / delete / duplicate / reorder / hide slides.                           |
| `useInsertElements`          | Shape / image / text box / table / chart insertion.                         |
| `useGroupAlignLayerHandlers` | Group/ungroup, align/distribute, layer (front/back) operations.             |
| `useMergeShapesHandler`      | Boolean shape merge (union/subtract/intersect/exclude).                     |
| `usePropertyHandlers`        | Property-panel change handlers for selected elements.                       |
| `useThemeHandlers`           | Applying/switching the document's PowerPoint theme.                         |
| `useThemeSwitching`          | Higher-level theme switch orchestration (also public, see below).           |
| `useLayoutSwitching`         | Switching a slide's layout while remapping placeholders.                    |
| `useClipboardHandlers`       | Copy / cut / paste of elements.                                             |
| `useFindReplace`             | Find & replace across slide text.                                           |
| `useComments`                | Comment thread state and CRUD.                                              |
| `useAnnotationHandlers`      | Freehand/shape annotation drawing handlers.                                 |

## Canvas interaction

| Hook                        | Concern                                            |
| --------------------------- | -------------------------------------------------- |
| `usePointerHandlers`        | Mouse/touch event processing for the canvas.       |
| `useCanvasInteractions`     | Selection box, drag-select, canvas-level gestures. |
| `useZoomViewport`           | Zoom level, fit-to-width, viewport DOM ref.        |
| `useKeyboardShortcuts`      | Hotkey definitions.                                |
| `useKeyboardShortcutWiring` | Wires hotkey definitions to DOM event listeners.   |
| `useResizablePanels`        | Resizable inspector/sidebar panel widths.          |
| `useSheetDismissDrag`       | Swipe-to-dismiss for bottom sheets (mobile).       |
| `useModalDismissDrag`       | Swipe-to-dismiss for modals (mobile).              |

## Export, print & I/O

| Hook                                             | Concern                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| `useExportHandlers`                              | PNG / SVG / PDF / GIF / video / PPTX export logic. |
| `useExportSaveAs`                                | "Save as" file-picker flow around export.          |
| `usePrintHandlers`                               | Print dialog and layout.                           |
| `useIOHandlers`                                  | Open/import file handling.                         |
| `useFontInjection`                               | Injects embedded document fonts into the page.     |
| `useVirtualizedSlides` (+ `computeVirtualRange`) | Virtualizes the slide panel/list for large decks.  |

## Dialogs

| Hook                   | Concern                                          |
| ---------------------- | ------------------------------------------------ |
| `useViewerDialogs`     | Open/close state for every modal dialog.         |
| `useDialogCustomShows` | Custom "show" gating logic for specific dialogs. |

## Presentation mode

| Hook                         | Concern                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `usePresentationMode`        | Slideshow navigation, animation, transitions (top-level composer). |
| `usePresentationSetup`       | Presentation-mode entry setup (fullscreen, initial slide).         |
| `usePresentationAnnotations` | Pen/highlighter annotations while presenting.                      |
| `useAnimationPlayback`       | Plays back element animation timelines.                            |
| `useRehearsalTimings`        | Records per-slide timings during a rehearsal pass.                 |
| `usePresentationKeyboard`    | Keyboard navigation while presenting.                              |
| `useSlideNavigation`         | Next/previous/jump slide navigation.                               |
| `useZoomNavigation`          | Zoom/pan while presenting.                                         |
| `usePresenterWindow`         | Presenter-window <-> audience-window messaging.                    |
| `useAudienceMode`            | Audience-window-side rendering mode.                               |

## Slide-transition helpers

`pptx-viewer-shared` (the framework-agnostic logic every binding bundles) is a private,
unpublished workspace package: it is never on npm, so code outside this monorepo cannot
`import` from it directly. A host embedding its own presentation stage (a custom `SlideStage`
instead of the full `PowerPointViewer`) still needs the transition resolver/keyframes, so the
whole surface is re-exported here instead:

| Export                                                                                                                                                          | Concern                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveSlideTransition`                                                                                                                                        | Resolve a `PptxSlideTransition` to CSS `animation` shorthands for the outgoing/incoming layers.                                                     |
| `resolveTransitionDurationMs`                                                                                                                                   | Effective duration (ms) for a transition, honoring an authored duration, the legacy `spd` token, and PowerPoint's own defaults.                     |
| `getSlideTransitionAnimations`                                                                                                                                  | Lower-level resolver `resolveSlideTransition` calls internally (classic 2-D transition family).                                                     |
| `getCinematicTransitionAnimations` / `getP14TransitionAnimations`                                                                                               | The Office 2013+ (p15) cinematic family and the Office 2010 (p14) exotic/3-D family, respectively.                                                  |
| `SLIDE_TRANSITION_KEYFRAMES` (alias `SLIDE_TRANSITION_KEYFRAMES_CSS`)                                                                                           | The full `@keyframes` block every resolved animation name above references. Inject once via a `<style>` tag.                                        |
| `CINEMATIC_TRANSITION_KEYFRAMES` / `P14_TRANSITION_KEYFRAMES_ALL`                                                                                               | The keyframe sub-blocks already folded into `SLIDE_TRANSITION_KEYFRAMES`; exported individually too.                                                |
| `resolveDirection` / `resolveDirection8` / `resolveOrientation`                                                                                                 | Normalize an OOXML `dir`/`orient` token to a resolved direction/orientation.                                                                        |
| `resolveWheelSpokeCount`                                                                                                                                        | Snap an authored Wheel spoke count to the nearest PowerPoint-offered value.                                                                         |
| `RANDOM_ELIGIBLE_TYPES`, `INSTANT`, `DEFAULT_TRANSITION_DURATION_MS`, `DEFAULT_MORPH_DURATION_MS`, `TRANSITION_SPEED_DURATION_MS`, `EASE`, `WHEEL_SPOKE_COUNTS` | Supporting constants used by the resolvers above.                                                                                                   |
| `PresentationTransitionOverlay`, `MorphTransitionOverlay`, `SlideLayer`, `FragmentedTransitionLayer`                                                            | The presentation-mode transition overlay components themselves, for a host that wants the whole rendered overlay rather than just the CSS resolver. |

## Collaboration

See [Collaboration](/react/collaboration) for the curated public subset. The full internal set:

| Hook                      | Concern                                                  |
| ------------------------- | -------------------------------------------------------- |
| `useYjsProvider`          | Manages the Yjs WebSocket provider lifecycle.            |
| `useYjsDocumentSync`      | Syncs the Yjs document into viewer state.                |
| `usePresenceTracking`     | Tracks remote cursors, selection, and connection status. |
| `useCollaborativeState`   | CRDT-backed shared document state.                       |
| `useCollaborativeHistory` | Collaborative undo/redo.                                 |
| `useBroadcastFollower`    | Follows another user's viewport/selection broadcast.     |
| `useFollowMode`           | "Follow presenter" mode orchestration.                   |

## Mobile & responsive

| Hook                 | Concern                                                       |
| -------------------- | ------------------------------------------------------------- |
| `useIsMobile`        | Device/viewport classification (mobile/tablet/orientation).   |
| `useTouchGestures`   | Pinch-zoom, pan, and tap-gesture recognition.                 |
| `useKeyboardInsets`  | Adjusts layout for the on-screen keyboard (mobile).           |
| `useSwipeNavigation` | Swipe-to-change-slide navigation (mobile).                    |
| `useReducedMotion`   | Respects `prefers-reduced-motion` for animations/transitions. |

This list is generated from `packages/react/src/viewer/hooks/**/*.ts` and re-exported in full from
[`pptx-react-viewer/internals`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/react/src/internals.ts).
If you add or rename a hook there, update this page in the same change.
