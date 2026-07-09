---
title: Complete Composables Reference
description: The full list of every internal composable that composes PowerPointViewer, and how to import them via pptx-vue-viewer/composables-unstable.
---

# Complete Composables Reference

This is the complete list referenced from the [Composables](/vue/composables) page: every composable
that composes `PowerPointViewer.vue` internally (directly, or via a wiring composable used by a
child component), grouped by concern. For the small curated subset that has a semver-stable public
API, see [Composables > Public composables](/vue/composables#public-composables) instead.

::: warning No compatibility guarantees
All of the composables below are importable from `pptx-vue-viewer/composables-unstable`, but the
name is literal: signatures, behavior, and existence can change in **any** release, including a
patch release, without a deprecation period. Reach for this entry only when the curated
`pptx-vue-viewer/viewer` export and the public props/`defineExpose` API genuinely can't do what you
need. Pin an exact version if you depend on it.

```ts
import { useEditorHistory, useAlignGroup } from 'pptx-vue-viewer/composables-unstable';
```

:::

## Core state & lifecycle

| Composable                    | Concern                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `useLoadContent`              | Parses the PPTX buffer on load via `PptxHandler`.                    |
| `useAutosave`                 | Debounced autosave timer, dirty tracking, and status.                |
| `useDocumentStatistics`       | Word/character/slide/note counts for the Document Properties dialog. |
| `useDocumentPropertiesDialog` | Core / custom / app document-properties dialog state.                |
| `useMasterViewState`          | Slide / notes / handout master view state.                           |
| `useViewerSettingsDialog`     | Viewer settings dialog (spell check, grid, etc.) state.              |
| `useVersionHistory`           | Named, restorable in-memory slide snapshots.                         |
| `useVersionHistoryWiring`     | Wires version history + the compare panel into the component.        |

## Editing & history

| Composable             | Concern                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `useEditorHistory`     | Undo/redo snapshot stack, aware of the template (master/layout) element layer. |
| `useEditorOperations`  | Element create/update/delete/duplicate primitives.                             |
| `useEditorKeyboard`    | Config-driven keyboard-shortcut registry + dispatch.                           |
| `useElementDrag`       | Move / resize / rotate / adjust, plus snap & alignment guides.                 |
| `useElementInsertion`  | Shape / image / text box / table / chart insertion.                            |
| `useMultiSelectOps`    | Delete / duplicate / bring-forward / send-backward for the selection.          |
| `useAlignGroup`        | Align / distribute / group / ungroup.                                          |
| `useSlideOperations`   | Add / delete / duplicate / reorder slides.                                     |
| `useSlideMutations`    | Notes / hidden-flag / transition / animation mutations on a slide.             |
| `useSectionOperations` | Slide-rail section (grouping) create/rename/delete/reorder.                    |
| `useThemeEditing`      | Apply/edit the document's PowerPoint theme + palette.                          |
| `useFindReplace`       | Find & replace across slide text.                                              |
| `useFormatPainter`     | Copy formatting from one element and apply it to another.                      |
| `useInlineEditing`     | Inline text and table-cell edit entry, commit, and cancel.                     |
| `useInkDrawing`        | Freehand ink stroke drawing and erase.                                         |
| `useChartEditing`      | Chart axis-title, gridline, marker, and series style editing.                  |
| `useColorChangeImage`  | Image "recolor" (`clrChange`) effect editing (`use-color-change-image.ts`).    |
| `useModel3dScene`      | Interactive GLB/GLTF 3D model viewer scene.                                    |

## SmartArt editing

| Composable                   | Concern                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `useSmartArtEditing`         | SmartArt node/layout/color/style editing operations.                      |
| `useSmartArtFocus`           | SmartArt node keyboard focus and navigation.                              |
| `useSmartArtHoverRect`       | Hover-highlight rectangle for a SmartArt node.                            |
| `useSmartArtNodeEditContext` | Provide/inject context for inline SmartArt node text/fill editing.        |
| `useSmartArtInlineEditState` | Inline SmartArt node editor open/close state (`smartart-inline-edit.ts`). |
| `useSmartArt3D`              | Reads the `smartArt3D` opt-in flag via inject (`smart-art-3d.ts`).        |

## Tables

| Composable                   | Concern                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `useTableCellEditingContext` | Provide/inject context for inline table-cell text editing.             |
| `useTableCellSelection`      | Table cell range selection + column/row resize (`table-selection.ts`). |

## Canvas interaction

| Composable             | Concern                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `useContextMenu`       | Right-click / long-press element context menu.                          |
| `useIsMobile`          | Device/viewport classification (mobile/tablet/orientation).             |
| `useTouchGestures`     | Pinch-zoom, pan, and long-press gesture recognition.                    |
| `useKeyboardInsets`    | Adjusts layout for the on-screen keyboard (mobile).                     |
| `useKeyboardShortcuts` | Hotkey catalog, grouping, and match resolution.                         |
| `useSheetDismissDrag`  | Swipe-to-dismiss for bottom sheets (mobile).                            |
| `useToolbarAutoHide`   | Mouse-idle auto-hide for the floating presentation toolbar.             |
| `useDebouncedCallback` | Generic debounced-callback utility.                                     |
| `useSelection`         | Generic reactive selected-id-set helper (single/additive/toggle/clear). |

## Ribbon / toolbar

| Composable         | Concern                                                         |
| ------------------ | --------------------------------------------------------------- |
| `useRibbonProps`   | Composes the full Office-ribbon `RibbonProps` contract.         |
| `useRibbonActions` | Ribbon action handlers (text style, flip, move-to-edge, align). |
| `useRibbonUiState` | Ribbon open/collapsed/section and drawing-tool UI state.        |

## Export, print & I/O

| Composable          | Concern                                                   |
| ------------------- | --------------------------------------------------------- |
| `useExport`         | PNG / PDF export pipeline (`html2canvas-pro` + `jspdf`).  |
| `useExportProgress` | Export progress reporting and cancellation.               |
| `useExportWiring`   | Wires export, print, and media export into the component. |
| `useMediaExport`    | Animated GIF and WebM video slide export.                 |
| `usePrint`          | Print dialog state and the rasterised print-window flow.  |

## Dialogs

| Composable                | Concern                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `useInsertElementDialogs` | Insert SmartArt / equation dialog state and edit-entry routing.    |
| `useHeaderFooterDialog`   | Header/footer dialog state.                                        |
| `usePasswordProtection`   | Password-protection dialog and presentation password state.        |
| `useCustomShows`          | Custom show create/rename/delete CRUD.                             |
| `useCustomShowsWiring`    | Wires custom shows into the component.                             |
| `useSlideShowSettings`    | Set Up Slide Show dialog and the subtitles toggle.                 |
| `useSignatures`           | Digital-signature verification and overall status.                 |
| `useSignatureWorkflow`    | Signatures panel and signature-stripped warning wiring.            |
| `useFontEmbedding`        | Font-embedding dialog and used-font-family detection.              |
| `useSelectionPaneWiring`  | View > Selection Pane wiring (select, toggle visibility, reorder). |

## Comments

| Composable          | Concern                            |
| ------------------- | ---------------------------------- |
| `useComments`       | Comment thread state and CRUD.     |
| `useCommentsWiring` | Wires comments into the component. |

## Presentation mode

| Composable                   | Concern                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `usePresentationModeWiring`  | Slideshow navigation, wired into the component (top-level composer). |
| `usePresentationAnnotations` | Pen / highlighter / laser-pointer annotations while presenting.      |
| `useRehearseTimings`         | Records per-slide timings during a rehearsal pass.                   |

## Collaboration

See [Collaboration](/vue/collaboration) for the prop-driven flow. The full internal set:

| Composable               | Concern                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `useCollaboration`       | Yjs CRDT session lifecycle: start/stop, presence, cursors, elected-writer write-back.   |
| `useCollaborationWiring` | Share/Broadcast dialog state, prop-driven auto-start/stop, cursor/selection publishing. |

## Accessibility

| Composable         | Concern                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `useAccessibility` | Accessibility checker (alt text, contrast, reading order, etc.). |

This list is generated from `packages/vue/src/viewer/composables/**/*.ts` (files that export a
`use*()` composable function) and re-exported in full from
[`pptx-vue-viewer/composables-unstable`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/vue/src/composables-unstable.ts).
Files that only export pure helper functions, provide/inject keys, or constants (no `use*()`
function) are internal implementation detail and are not part of this surface. If you add or
rename a composable, update this page in the same change.

::: info `RasterizeSlide`
`useExport`, `useMediaExport`, and `usePrint` each declare an identical `RasterizeSlide` type
(`(index: number) => Promise<HTMLCanvasElement>`). To avoid an ambiguous re-export, only
`useExport`'s copy is re-exported from `pptx-vue-viewer/composables-unstable`; import the others
directly from their source files if you need the type by that exact name.
:::
