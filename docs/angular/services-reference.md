---
title: Complete Services Reference
description: The full list of every internal service, component, and helper that composes PowerPointViewerComponent, and how to import them from pptx-angular-viewer.
---

# Complete Services Reference

This is the complete list referenced from the [Services](/angular/services) page: every internal
building block that composes `PowerPointViewerComponent`, grouped by concern. For the small curated
subset that has a semver-stable public API, see
[Services › Public services & components](/angular/services#public-services-components) instead.

::: warning No compatibility guarantees
Everything below is importable from `pptx-angular-viewer` (the package root - Angular has no
separate `hooks-unstable` subpath, since ng-packagr builds a single entry point here), but the
framing is literal: signatures, behavior, and existence can change in **any** release, including a
patch release, without a deprecation period. Reach for this only when the curated services/inputs/
outputs/[public API](/angular/api) genuinely can't do what you need. Pin an exact version if you
depend on it.

```ts
import { EditorStateService, ViewerExportService } from 'pptx-angular-viewer';
```

:::

## Orchestration services

Provided on `PowerPointViewerComponent` (`providers: [...]`) and wired together via `inject()` plus
each service's own `bind()` handoff of host accessors.

| Service                             | Concern                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `AutosaveService`                   | Periodic autosave scheduling and status.                                            |
| `CanvasFitService`                  | Fit-to-width / canvas-size calculations for the editor viewport.                    |
| `FieldContextService`               | Field/placeholder context (date, slide number, ...) for text rendering.             |
| `InkDrawingService`                 | Freehand ink stroke state for the drawing tools.                                    |
| `RulerGuidesService`                | Ruler tick and guide-line state for the editor canvas.                              |
| `SmartArt3DService`                 | Gates the opt-in Three.js SmartArt renderer via the `smartArt3D` input.             |
| `ViewerCanvasEditingService`        | Canvas editing orchestration: element select, transform, text/ink/table-cell edits. |
| `ViewerCollabCursorService`         | Local pointer tracking for broadcasting the user's cursor position.                 |
| `ViewerCollaborationSessionService` | Share/Broadcast dialog state and session connect/disconnect orchestration.          |
| `ViewerCustomShowsService`          | Custom-show (subset-of-slides presentation) state.                                  |
| `ViewerDocumentPropertiesService`   | Document Info dialog and hyperlink dialog state.                                    |
| `ViewerExportService`               | PNG/PDF/GIF/video export and print orchestration, with progress + cancellation.     |
| `ViewerFileIOService`               | File ▸ Open / Save As orchestration, content override, `getContent()`.              |
| `ViewerFindReplaceService`          | Find and Find & Replace bar state and search/replace operations.                    |
| `ViewerFormatPainterService`        | Format painter + eyedropper tool state.                                             |
| `ViewerInspectorPanelService`       | Right-rail inspector panel switching and mobile inspector visibility.               |
| `ViewerKeyboardService`             | Keyboard shortcut dispatch for the document-level keydown listener.                 |
| `ViewerMobileSheetService`          | Mobile bottom-sheet state (slides/menu/notes) and quick-insert action.              |
| `ViewerPresentationModeService`     | Presentation-mode orchestration: enter/exit, presenter view, audience window.       |
| `ViewerThemeGalleryService`         | Theme gallery dialog state and applying a theme preset.                             |
| `ViewerTouchGesturesService`        | Pinch-zoom, swipe-navigation, and long-press gesture wiring.                        |
| `ViewerZoomService`                 | Zoom level state (zoom / zoomIn / zoomOut / zoomReset / zoomPercent).               |
| `ZoomNavigationService`             | PowerPoint "Zoom" (summary/section zoom) navigation targets.                        |
| `ZoomTargetService`                 | Resolves a Zoom tile's fallback thumbnail info from the live deck.                  |

## Editing & element primitives

| Export                                                                                              | Concern                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `align-distribute` exports                                                                          | Align/distribute selected elements horizontally/vertically.                       |
| `editor-insert` exports (`newTextElement`, `newShapeElement`, `newTableElement`, `newChartElement`) | Factories for newly-inserted elements.                                            |
| `group-ops` exports                                                                                 | Group/ungroup selected elements.                                                  |
| `template-mode` exports (`buildSaveSlides`, ...)                                                    | Merge separated master/layout template elements back into slides for save/export. |
| `inspector-helpers` exports                                                                         | Property-panel change-handling helpers for selected elements.                     |
| `text-advanced-helpers` exports                                                                     | Advanced text formatting (spacing, columns, ...) helpers.                         |
| `effects-helpers` exports                                                                           | Shadow/glow/reflection effect style helpers.                                      |
| `gradient-picker-helpers` exports                                                                   | Gradient stop editing helpers for the gradient picker.                            |
| `selection-geometry` exports                                                                        | Selection-box and handle geometry math.                                           |
| `snap-guides` exports                                                                               | Snap-to-grid / snap-to-shape guide computation.                                   |

## Chart internals

Back the curated `chart-*-options` components ([Services › Public services](/angular/services)).

| Export                           | Concern                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `chart-advanced-helpers` exports | Advanced chart configuration helpers.                                                                            |
| `chart-combo-stock` exports      | Combo and stock chart type helpers.                                                                              |
| `chart-data-helpers` exports     | Chart series/category data editing helpers.                                                                      |
| `chart-editor-styles` exports    | Shared style constants for the chart editor panels.                                                              |
| `chart-event-helpers` exports    | Chart interaction/event helpers.                                                                                 |
| `chart-overlays` exports         | Chart overlay (data labels, trendlines, error bars) rendering helpers.                                           |
| `chart-renderer-helpers` exports | Chart view-model helpers (thin shim over `pptx-viewer-shared`), including `DEFAULT_PALETTE` (the chart palette). |
| `chart-surface-treemap` exports  | Surface and treemap chart layout helpers.                                                                        |
| `chart-waterfall-map` exports    | Waterfall and map chart layout helpers.                                                                          |

## SmartArt internals

2D authoring helpers plus the opt-in 3D renderer, backing the curated `SmartArtRendererComponent`.

| Export                                                                                                                                                                                       | Concern                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SmartArt3DRendererComponent`                                                                                                                                                                | Renders SmartArt diagrams as extruded 3D blocks on WebGL (opt-in via `smartArt3D`).                                                                                                                                                            |
| `SmartArtPreviewComponent`                                                                                                                                                                   | Live-renders a SmartArt layout preset for gallery previews.                                                                                                                                                                                    |
| `SmartArtPropertiesComponent`                                                                                                                                                                | SmartArt-specific inspector panel.                                                                                                                                                                                                             |
| `SMARTART_PALETTES`, `SMARTART_DEFAULT_PALETTE`, `smartArtPaletteColour`, `resolveSmartArtPalette`, `buildChromeStyle`, `computeDrawingViewBox`, `projectDrawingShapes`, `styleShadowFilter` | Drawing-shape view-model helpers (palette, chrome, viewBox, `RenderedShape` projection). Aliased with a `SmartArt`/`SMARTART_` prefix here because the bare names collide with the chart palette of the same name (see chart internals above). |
| `smart-art-inline-edit` exports                                                                                                                                                              | On-canvas inline SmartArt text/node editing.                                                                                                                                                                                                   |
| `smart-art-insert-helpers` exports (`buildSmartArtInsertElement`)                                                                                                                            | Builds a new SmartArt element from a chosen preset + item texts.                                                                                                                                                                               |
| `smart-art-node-style-helpers` exports                                                                                                                                                       | Per-node style resolution helpers.                                                                                                                                                                                                             |
| `smart-art-properties-helpers` exports                                                                                                                                                       | Helpers backing `SmartArtPropertiesComponent`.                                                                                                                                                                                                 |
| `smart-art-renderer-helpers` exports                                                                                                                                                         | Helpers backing the curated `SmartArtRendererComponent`.                                                                                                                                                                                       |

## Table internals

| Export                             | Concern                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `table-cell-style` exports         | Table cell style resolution.                          |
| `table-data-helpers` exports       | Table row/column/cell data editing helpers.           |
| `table-properties-helpers` exports | Helpers backing `TablePropertiesComponent`.           |
| `table-renderer-helpers` exports   | Helpers backing the curated `TableRendererComponent`. |

## Ribbon (toolbar sub-sections)

Composed by `RibbonComponent`, itself composed by `PowerPointViewerComponent`.

| Component                                                         | Concern                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `RibbonComponent`                                                 | The full tabbed ribbon, composing every section below.       |
| `RibbonPrimaryRowComponent`                                       | The tab-strip row above the section content.                 |
| `RibbonHomeSectionComponent`                                      | Home tab: clipboard, font, paragraph controls.               |
| `RibbonInsertSectionComponent`, `RibbonInsertFieldsComponent`     | Insert tab: shapes, tables, charts, SmartArt, fields.        |
| `RibbonDrawSectionComponent`, `RibbonDrawingGroupComponent`       | Draw tab: freehand ink tools.                                |
| `RibbonDesignSectionComponent`                                    | Design tab: theme gallery entry point.                       |
| `RibbonTransitionsSectionComponent`                               | Transitions tab.                                             |
| `RibbonAnimationsSectionComponent`                                | Animations tab.                                              |
| `RibbonSlideshowSectionComponent`                                 | Slide Show tab: present, presenter view, custom shows.       |
| `RibbonReviewSectionComponent`                                    | Review tab: spelling, accessibility.                         |
| `RibbonViewSectionComponent`                                      | View tab: grid, rulers, guides, snap, slide sorter.          |
| `RibbonArrangeSectionComponent`                                   | Arrange tab: align, distribute, group, order.                |
| `RibbonEditingSectionComponent`                                   | Editing tab controls (find/replace entry point).             |
| `RibbonFileSectionComponent`                                      | File tab: open/save actions.                                 |
| `RibbonFontControlsComponent`, `RibbonParagraphControlsComponent` | Shared font/paragraph control groups reused across sections. |
| `RibbonColorPopoverComponent`                                     | Shared color-swatch popover reused across sections.          |
| `ribbon-text-helpers` exports (`patchTextStyle`)                  | Applies a text-style patch to the selected element.          |

## Presentation, navigation & touch internals

| Export                                  | Concern                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `presentation-fullscreen` exports       | Fullscreen API wrapper for presentation mode.                            |
| `presentation-overlay-helpers` exports  | Helpers backing `PresentationOverlayComponent`.                          |
| `presentation-subtitle-helpers` exports | Helpers backing `PresentationSubtitleBarComponent`.                      |
| `touch-gestures` exports                | Pinch-zoom, pan, and tap-gesture recognition.                            |
| `swipe-dismiss` exports                 | Swipe-to-dismiss for mobile sheets/drawers.                              |
| `ruler-ticks` exports                   | Ruler tick-mark computation.                                             |
| `zoom-renderer-helpers` exports         | Helpers backing the curated `ZoomRendererComponent`.                     |
| `shortcut-reference` exports            | The keyboard-shortcut cheat-sheet data backing `ShortcutPanelComponent`. |

## Collaboration internals

The full internal set behind `CollaborationService` ([Collaboration](/angular/collaboration) covers
the curated public surface).

| Export                                                                            | Concern                                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `collaboration-local-presence` exports (`LocalPresencePublisher`)                 | Publishes the local user's cursor/selection/active-slide to Yjs awareness. |
| `collaboration-providers` exports (`createWebsocketBundle`, `createWebrtcBundle`) | Constructs the Yjs doc + provider + awareness bundle for each transport.   |
| `collaboration-writeback` exports (`WriteBackScheduler`)                          | Debounced elected-writer PPTX snapshot write-back.                         |

## Media, ink, OLE, 3D-model & color helper internals

| Export                                | Concern                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `ink-drawing-helpers` exports         | Pure helpers backing `InkDrawingService`.                   |
| `ink-renderer-helpers` exports        | Helpers backing the curated `InkRendererComponent`.         |
| `MediaRendererComponent`              | Renders audio/video media elements.                         |
| `media-renderer-helpers` exports      | Helpers backing `MediaRendererComponent`.                   |
| `model3d-renderer-helpers` exports    | Helpers backing the curated `Model3DRendererComponent`.     |
| `ole-renderer-helpers` exports        | Helpers backing the curated `OleRendererComponent`.         |
| `ColorChangedImageComponent`          | Renders an image with a duotone/recolor filter applied.     |
| `color-changed-image-helpers` exports | Helpers backing `ColorChangedImageComponent`.               |
| `eyedropper` exports                  | Screen eyedropper (`EyeDropper` API) color-picking helpers. |

## Mobile chrome internals

| Export                          | Concern                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `mobile-chrome-helpers` exports | Shared helpers for the mobile toolbar/bottom-bar/sheets. |

## Ancillary components & helpers

Not part of the curated root export, but composed directly by `PowerPointViewerComponent`.

| Export                                                   | Concern                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `CustomShowsComponent`, `custom-shows-helpers` exports   | Custom-show create/rename/delete dialog.                                     |
| `ExportProgressModalComponent`                           | Progress modal shown during PDF/GIF/video export.                            |
| `FollowModeBarComponent`                                 | "Follow presenter" mode banner.                                              |
| `InsertSmartArtDialogComponent`, `SmartArtInsertEvent`   | The Insert ▸ SmartArt gallery dialog.                                        |
| `NotesToolbarComponent`                                  | Speaker-notes panel toolbar.                                                 |
| `RemoteSelectionOverlayComponent`                        | Renders remote users' element-selection highlights.                          |
| `SelectionPaneComponent`                                 | The Selection Pane (Arrange tab) listing/toggling elements.                  |
| `ThemeGalleryComponent`, `theme-gallery-presets` exports | The Design tab's theme gallery dialog and its preset data.                   |
| `TitleBarComponent`                                      | The top title bar (save status, undo/redo, autosave toggle, command search). |
| `slide-canvas-helpers` exports                           | Helpers backing the curated `SlideCanvasComponent`.                          |
| `slide-sorter-overlay-helpers` exports                   | Helpers backing the curated `SlideSorterOverlayComponent`.                   |
| `animation-author-helpers` exports                       | Helpers backing `AnimationAuthorPanelComponent`.                             |

This list is generated from `packages/angular/src/viewer/**/*.ts` and re-exported in full from
[`pptx-angular-viewer/src/services-unstable.ts`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/angular/src/services-unstable.ts),
itself re-exported from the package root via `public-api.ts`. If you add or rename a building block
there, update this page in the same change.
