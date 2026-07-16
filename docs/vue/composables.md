---
title: Composables
description: The composables-based architecture of PowerPointViewer, the curated set of public composables exported from pptx-vue-viewer/viewer, and the full internal set exposed via pptx-vue-viewer/composables-unstable.
---

# Composables

`PowerPointViewer.vue` is a thin `<script setup>` orchestrator. Almost all of its logic lives in
**70+ custom composables** under `viewer/composables/`, composed inside the component, while the
visual components are largely presentational. State is held entirely in Vue's reactivity system,
there is no external state library.

::: info Internal vs public vs unstable
Most of these composables are **internal architecture**: they assume a specific composition order
and shared inputs. A small curated subset is exported from `pptx-vue-viewer/viewer` with a normal
semver-stable API. The **complete** set, every composable listed below, is also importable from
`pptx-vue-viewer/composables-unstable`, but with **no compatibility guarantees**: see
[Complete Composables Reference](/vue/composables-reference). The tables below mark which category
each composable falls into.
:::

## Architecture (internal)

These composables describe how the viewer is wired. They are importable (see below) but assume a
specific composition order and shared inputs, treat this table as conceptual reference, not an API
contract.

| Composable                  | Concern                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `useLoadContent`            | Parses the PPTX buffer on load via `PptxHandler`.                                |
| `useEditorHistory`          | Undo/redo snapshot stack, aware of the template (master/layout) element layer.   |
| `useEditorOperations`       | Element create/update/delete/duplicate primitives.                               |
| `useElementDrag`            | Move / resize / rotate / adjust, plus snap & alignment guides.                   |
| `useElementInsertion`       | Shape / image / text box / table / chart insertion.                              |
| `useSlideOperations`        | Add / delete / duplicate / reorder slides.                                       |
| `useAutosave`               | Debounced autosave timer + status (see [Props > Autosave](/vue/props#autosave)). |
| `usePresentationModeWiring` | Slideshow navigation wiring into the component.                                  |
| `useExportWiring`           | PNG / PDF / GIF / WebM export + print, wired into the component.                 |
| `useCollaborationWiring`    | Share/Broadcast dialog + prop-driven Yjs session lifecycle.                      |
| `useRibbonProps`            | Composes the full Office-ribbon `RibbonProps` contract.                          |
| `useEditorKeyboard`         | Config-driven keyboard-shortcut registry + dispatch.                             |
| `useIsMobile`               | Device/viewport classification (mobile/tablet/orientation).                      |

There are dozens more (dialogs, comments, sections, SmartArt editing, table editing, presentation
sub-composables, mobile chrome, etc.). See the
**[Complete Composables Reference](/vue/composables-reference)** for the full list, grouped by
concern, and how to import all of them from `pptx-vue-viewer/composables-unstable`.

## Public composables

The following are exported from `pptx-vue-viewer/viewer` (and the root `pptx-vue-viewer` entry) and
are safe to import. They are opt-in and tree-shakeable.

```ts
import {
	useCollaboration,
	useCollaborationWiring,
	useEditorHistory,
	useEditorOperations,
	useLoadContent,
} from 'pptx-vue-viewer/viewer';
```

| Composable               | Exported type(s)                                                      | Purpose                                                             |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `useLoadContent`         | `UseLoadContentResult`                                                | Parse a `.pptx` buffer via `PptxHandler` and expose reactive state. |
| `useEditorHistory`       | -                                                                     | Undo/redo snapshot stack.                                           |
| `useEditorOperations`    | -                                                                     | Element create/update/delete primitives.                            |
| `useCollaboration`       | `UseCollaborationOptions`, `UseCollaborationResult`, `RemotePresence` | Yjs session, presence, cursors, and elected-writer synchronization. |
| `useCollaborationWiring` | `UseCollaborationWiringInput`, `UseCollaborationWiringResult`         | Full viewer collaboration and broadcast lifecycle wiring.           |

Alongside these, `pptx-vue-viewer/viewer` also exports a handful of **pure helper functions** (not
composables) used by the renderer components: `getContainerStyle`, `getShapeFillStrokeStyle`,
`getTextBlockStyle`, `getImageSrc`, `getResolvedShapeClipPath`, `getResolvedShapeClipPathFor`,
`collectMediaElements`, `collectImagePaths`, `buildInitialGuides`, plus the audience/presenter
content-sharing helpers (`isAudienceTab`, `storeAudienceContent`, `loadAudienceContent`,
`clearAudienceContent`).

The stable entry also exports `CollaborationCursors`, `CollaborationStatusIndicator`,
`RemoteSelectionOverlay`, and `FollowModeBar` for custom presence UI. See
[Collaboration](/vue/collaboration).

## Using an internal composable directly

If the curated public composables above don't cover what you need, every internal composable is
also importable in full from `pptx-vue-viewer/composables-unstable`:

```ts
import { useEditorHistory, useAlignGroup } from 'pptx-vue-viewer/composables-unstable';
```

::: warning No compatibility guarantees
`pptx-vue-viewer/composables-unstable` re-exports the same composables `PowerPointViewer.vue`
composes internally (directly, or via a wiring composable used by a child component), unmodified.
They are not part of the package's semver contract: signatures and behavior can change, and
composables can be renamed or removed, in **any** release including a patch release. Prefer the
props/`defineExpose` API or the curated `pptx-vue-viewer/viewer` composables first; reach for this
only for advanced integrations, and pin an exact version if you depend on it.
:::

See the **[Complete Composables Reference](/vue/composables-reference)** for the full list and
[Overview](/vue/#composables-based-architecture) for the broader architectural picture.
