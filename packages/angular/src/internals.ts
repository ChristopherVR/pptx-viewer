// ── Internal building blocks. Not covered by semver; prefer the stable root exports. ──
//
// `PowerPointViewerComponent` composes ~150 internal Angular building blocks: `@Injectable`
// orchestration services (provided on the component and injected with `inject()`), standalone
// child components, and plain signal-free helper functions. Only a curated subset is re-exported
// from the package root (`pptx-angular-viewer`, see `src/viewer/index.ts` via `public-api.ts`).
// This module re-exports literally everything else, for advanced integrations that need
// finer-grained control than the component's inputs/outputs provide.
//
// It backs the dedicated `pptx-angular-viewer/internals` secondary entry point (see
// `internals/ng-package.json`), so import these the same way as any other subpath:
//
//   import { AutosaveService, buildSaveSlides } from 'pptx-angular-viewer/internals';
//
// Generated from `packages/angular/src/viewer/**/*.ts`. If you add, rename, or remove a building
// block here, update `docs/angular/services-reference.md` in the same change.

// ── Orchestration services (provided on PowerPointViewerComponent, composed via inject()) ──
export { AutosaveService } from './viewer/autosave.service';
export { CanvasFitService } from './viewer/canvas-fit.service';
export { FieldContextService } from './viewer/field-context.service';
export { InkDrawingService } from './viewer/ink-drawing.service';
export { RulerGuidesService } from './viewer/ruler-guides.service';
export { SmartArt3DService } from './viewer/smart-art-3d.service';
export { ViewerCanvasEditingService } from './viewer/viewer-canvas-editing.service';
export { ViewerCollabCursorService } from './viewer/viewer-collab-cursor.service';
export { ViewerCollaborationSessionService } from './viewer/viewer-collaboration-session.service';
export { ViewerCustomShowsService } from './viewer/viewer-custom-shows.service';
export { ViewerDocumentPropertiesService } from './viewer/viewer-document-properties.service';
export { ViewerExportService } from './viewer/viewer-export.service';
export { ViewerFileIOService } from './viewer/viewer-file-io.service';
export { ViewerFindReplaceService } from './viewer/viewer-find-replace.service';
export { ViewerFormatPainterService } from './viewer/viewer-format-painter.service';
export { ViewerInspectorPanelService } from './viewer/viewer-inspector-panel.service';
export { ViewerKeyboardService } from './viewer/viewer-keyboard.service';
export { ViewerMobileSheetService } from './viewer/viewer-mobile-sheet.service';
export { ViewerPresentationModeService } from './viewer/viewer-presentation-mode.service';
export { ViewerThemeGalleryService } from './viewer/viewer-theme-gallery.service';
export { ViewerTouchGesturesService } from './viewer/viewer-touch-gestures.service';
export { ViewerZoomService } from './viewer/viewer-zoom.service';
export { ZoomNavigationService } from './viewer/zoom-navigation.service';
export { ZoomTargetService } from './viewer/zoom-target.service';

// ── Editing & element primitives ──
export * from './viewer/align-distribute';
export * from './viewer/editor-insert';
export * from './viewer/group-ops';
export * from './viewer/template-mode';
export * from './viewer/inspector-helpers';
export * from './viewer/text-advanced-helpers';
export * from './viewer/effects-helpers';
export * from './viewer/gradient-picker-helpers';
export * from './viewer/selection-geometry';
export * from './viewer/snap-guides';

// ── Chart internals (back the curated chart-*-options components) ──
export * from './viewer/chart-advanced-helpers';
export * from './viewer/chart-combo-stock';
export * from './viewer/chart-data-helpers';
export * from './viewer/chart-editor-styles';
export * from './viewer/chart-event-helpers';
export * from './viewer/chart-overlays';
export * from './viewer/chart-renderer-helpers';
export * from './viewer/chart-surface-treemap';
export * from './viewer/chart-waterfall-map';

// ── SmartArt internals (2D authoring helpers + the opt-in 3D renderer) ──
export { SmartArt3DRendererComponent } from './viewer/smart-art-3d-renderer.component';
export { SmartArtPreviewComponent } from './viewer/smart-art-preview.component';
export { SmartArtPropertiesComponent } from './viewer/smart-art-properties.component';
// `DEFAULT_PALETTE` here is the SmartArt node palette; it collides with the
// chart palette of the same name re-exported via `chart-renderer-helpers`
// above, so it's aliased to `SMARTART_DEFAULT_PALETTE` (its underlying name in
// `pptx-viewer-shared`) to keep both importable from this single barrel.
export type { RenderedShape, DrawingViewBox } from './viewer/smart-art-drawing';
export {
	PALETTES as SMARTART_PALETTES,
	DEFAULT_PALETTE as SMARTART_DEFAULT_PALETTE,
	paletteColour as smartArtPaletteColour,
	resolvePalette as resolveSmartArtPalette,
	buildChromeStyle,
	computeDrawingViewBox,
	projectDrawingShapes,
	styleShadowFilter,
} from './viewer/smart-art-drawing';
export * from './viewer/smart-art-inline-edit';
export * from './viewer/smart-art-insert-helpers';
export * from './viewer/smart-art-node-style-helpers';
export * from './viewer/smart-art-properties-helpers';
export * from './viewer/smart-art-renderer-helpers';

// ── Table internals ──
export * from './viewer/table-cell-style';
export * from './viewer/table-data-helpers';
export * from './viewer/table-properties-helpers';
export * from './viewer/table-renderer-helpers';

// ── Ribbon (toolbar sub-sections composed by RibbonComponent) ──
// `RibbonComponent` itself is a curated export (see `viewer/index.ts` /
// `pptx-angular-viewer`'s package root); the sub-sections below are internal
// building blocks it composes for its own template.
export * from './viewer/ribbon-animation-gallery.component';
export { RibbonAnimationsSectionComponent } from './viewer/ribbon-animations-section.component';
export { RibbonArrangeSectionComponent } from './viewer/ribbon-arrange-section.component';
export { RibbonColorPopoverComponent } from './viewer/ribbon-color-popover.component';
export { RibbonDesignSectionComponent } from './viewer/ribbon-design-section.component';
export { RibbonDrawingGroupComponent } from './viewer/ribbon-drawing-group.component';
export { RibbonDrawSectionComponent } from './viewer/ribbon-draw-section.component';
export { RibbonEditingSectionComponent } from './viewer/ribbon-editing-section.component';
export { RibbonFileSectionComponent } from './viewer/ribbon-file-section.component';
export { RibbonFontControlsComponent } from './viewer/ribbon-font-controls.component';
export { RibbonHomeSectionComponent } from './viewer/ribbon-home-section.component';
export { RibbonHyperlinkButtonComponent } from './viewer/ribbon-hyperlink-button.component';
export * from './viewer/ribbon-insert-file-picker';
export { RibbonInsertFieldsComponent } from './viewer/ribbon-insert-fields.component';
export { RibbonInsertSectionComponent } from './viewer/ribbon-insert-section.component';
export { RibbonParagraphControlsComponent } from './viewer/ribbon-paragraph-controls.component';
export { RibbonPrimaryRowComponent } from './viewer/ribbon-primary-row.component';
export { RibbonReviewSectionComponent } from './viewer/ribbon-review-section.component';
export * from './viewer/ribbon-shape-extras.component';
export { RibbonSlideshowSectionComponent } from './viewer/ribbon-slideshow-section.component';
export * from './viewer/ribbon-text-helpers';
export { RibbonTransitionsSectionComponent } from './viewer/ribbon-transitions-section.component';
export { RibbonViewSectionComponent } from './viewer/ribbon-view-section.component';

// ── Presentation, navigation & touch internals ──
export * from './viewer/presentation-fullscreen';
export * from './viewer/presentation-overlay-helpers';
export * from './viewer/presentation-subtitle-helpers';
export * from './viewer/touch-gestures';
export * from './viewer/swipe-dismiss';
// Ruler tick generation + the drag-out-a-guide drop rule now come straight from
// the shared module every binding uses; the Angular-only `ruler-ticks.ts` copy
// (fixed quarter-inch subdivisions, inches only) was deleted with this export.
export {
	generateTicks,
	PX_PER_CM,
	PX_PER_INCH,
	RULER_FONT_SIZE,
	RULER_THICKNESS,
	rulerDragToGuidePosition,
} from './internal/shared';
export type { RulerUnit, Tick } from './internal/shared';
export * from './viewer/ruler-strips';
export * from './viewer/zoom-renderer-helpers';
export * from './viewer/shortcut-reference';

// ── Collaboration internals ──
export * from './viewer/collaboration-local-presence';
export * from './viewer/collaboration-providers';
export * from './viewer/collaboration-writeback';

// ── Media, ink, OLE, 3D-model & color helper internals ──
export * from './viewer/ink-drawing-helpers';
export * from './viewer/ink-renderer-helpers';
export { MediaRendererComponent } from './viewer/media-renderer.component';
export * from './viewer/media-renderer-helpers';
export * from './viewer/model3d-renderer-helpers';
export * from './viewer/ole-renderer-helpers';
export { ColorChangedImageComponent } from './viewer/color-changed-image.component';
export * from './viewer/color-changed-image-helpers';
export * from './viewer/eyedropper';

// ── Mobile chrome internals ──
export * from './viewer/mobile-chrome-helpers';

// ── Ancillary components & helpers not part of the curated root export ──
export { CustomShowsComponent } from './viewer/custom-shows.component';
export * from './viewer/custom-shows-helpers';
export { ExportProgressModalComponent } from './viewer/export-progress-modal.component';
export { FollowModeBarComponent } from './viewer/follow-mode-bar.component';
export { InsertSmartArtDialogComponent } from './viewer/insert-smart-art-dialog.component';
export type { SmartArtInsertEvent } from './viewer/insert-smart-art-dialog.component';
export { NotesToolbarComponent } from './viewer/notes-toolbar.component';
export { RemoteSelectionOverlayComponent } from './viewer/remote-selection-overlay.component';
export { SelectionPaneComponent } from './viewer/selection-pane.component';
export { ThemeGalleryComponent } from './viewer/theme-gallery.component';
export * from './viewer/theme-gallery-presets';
export { TitleBarComponent } from './viewer/title-bar.component';
export * from './viewer/slide-canvas-helpers';
export * from './viewer/slide-sorter-overlay-helpers';
export * from './viewer/animation-author-helpers';
