export { PowerPointViewerComponent } from './power-point-viewer.component';
export { POWER_POINT_VIEWER_PROVIDERS } from './power-point-viewer.providers';
export * from './ai';
export { RibbonComponent } from './ribbon.component';
export { SlideCanvasComponent } from './slide-canvas.component';
export { ElementRendererComponent } from './element-renderer.component';
export { ConnectorRendererComponent } from './connector-renderer.component';
export { ConnectorTextOverlayComponent } from './connector-text-overlay.component';
export { routeOrthogonalConnector, waypointsToPathD } from './connector-routing';
export type { Point as ConnectorPoint, Rect as ConnectorObstacle } from './connector-routing';
export type { ConnectorRouting } from './connector-path';
export { TableRendererComponent } from './table-renderer.component';
export { ChartRendererComponent } from './chart-renderer.component';
export { ChartPrimitivesComponent } from './chart-primitives.component';
export { ChartElementViewComponent } from './chart-element-view.component';
export { ChartPartSelectionService } from './chart-part-selection.service';
export type { ChartPartSelection } from './chart-part-selection.service';
export { SmartArtRendererComponent } from './smart-art-renderer.component';
export { InkRendererComponent } from './ink-renderer.component';
export { OleRendererComponent } from './ole-renderer.component';
export { Model3DRendererComponent } from './model3d-renderer.component';
export { ZoomRendererComponent } from './zoom-renderer.component';
export { PresentationOverlayComponent } from './presentation-overlay.component';
export { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
export { OutlineViewOverlayComponent } from './outline-view-overlay.component';
export type { OutlineCommit } from './outline-view-overlay.component';
export { ReadingViewOverlayComponent } from './reading-view-overlay.component';
export { FindBarComponent } from './find-bar.component';
export { FindReplaceBarComponent } from './find-replace-bar.component';
export {
	findInSlides,
	replaceInSlides,
	replaceMatch,
	applyFindReplacements,
} from './find-replace-helpers';
export type { FindResult, FindOptions, ReplaceResult } from './find-replace-helpers';
export { InspectorPanelComponent } from './inspector-panel.component';
export { InspectorPaneHeaderComponent } from './inspector-pane-header.component';
export type { SlideInspectorTab } from './inspector-pane-header.component';
export { SlideDefaultInspectorComponent } from './slide-default-inspector.component';
export { PresentationPropertiesPanelComponent } from './presentation-properties-panel.component';
export { PresentationSettingsCardComponent } from './presentation-settings-card.component';
export { ThemeSelectorCardComponent } from './theme-selector-card.component';
export { SlideSizeCardComponent } from './slide-size-card.component';
export { SlideTransitionCardComponent } from './slide-transition-card.component';
export { SlideBackgroundCardComponent } from './slide-background-card.component';
export { TransitionDirectionPickerComponent } from './transition-direction-picker.component';
export { TransitionPreviewComponent } from './transition-preview.component';
export { NotesHandoutCardComponent } from './notes-handout-card.component';
export { DocumentPropertiesCardComponent } from './document-properties-card.component';
export { TagsCardComponent } from './tags-card.component';
export { GradientPickerComponent } from './gradient-picker.component';
export { EffectsPanelComponent } from './effects-panel.component';
export { TextAdvancedPanelComponent } from './text-advanced-panel.component';
export { Text3DPanelComponent } from './text-3d-panel.component';
export {
	TEXT_3D_BOTTOM_BEVEL_KEYS,
	TEXT_3D_TOP_BEVEL_KEYS,
	Text3DBevelSectionComponent,
	bevelSizePatch,
} from './text-3d-bevel-section.component';
export type { Text3DBevelKeys } from './text-3d-bevel-section.component';
export { TableDataEditorComponent } from './table-data-editor.component';
export { TablePropertiesComponent } from './table-properties.component';
export { TableCellFormattingComponent } from './table-cell-formatting.component';
export { TableCellAdvancedFillComponent } from './table-cell-advanced-fill.component';
export { TableResizeOverlayComponent } from './table-resize-overlay.component';
export { TableSelectionService } from './table-selection.service';
export type { TableCellSelection } from './table-selection.service';
export { ChartDataEditorComponent } from './chart-data-editor.component';
export { AdvancedChartEditorComponent } from './advanced-chart-editor.component';
export { ChartDisplayOptionsComponent } from './chart-display-options.component';
export { ChartDataLabelOptionsComponent } from './chart-data-label-options.component';
export { ChartAxisOptionsComponent } from './chart-axis-options.component';
export { ChartAxisStyleOptionsComponent } from './chart-axis-style-options.component';
export { ChartMarkerOptionsComponent } from './chart-marker-options.component';
export { ChartComboTypeOptionsComponent } from './chart-combo-type-options.component';
export { ChartDatapointMarkerOptionsComponent } from './chart-datapoint-marker-options.component';
export { ChartDatapointOptionsComponent } from './chart-datapoint-options.component';
export { ChartTrendlineOptionsComponent } from './chart-trendline-options.component';
export { ChartErrorBarOptionsComponent } from './chart-error-bar-options.component';
export { AnimationAuthorPanelComponent } from './animation-author-panel.component';
export { IsMobileService, computeIsMobile, computeIsTablet } from './is-mobile';
export { MobileBottomBarComponent } from './mobile-bottom-bar.component';
export { MobileMenuSheetComponent } from './mobile-menu-sheet.component';
export { MobileSlidesSheetComponent } from './mobile-slides-sheet.component';
export { MobileSheetComponent } from './mobile-sheet.component';
export { MobileToolbarComponent } from './mobile-toolbar.component';
export { NotesPanelComponent } from './notes-panel.component';
export {
	applyFormatToElement,
	copyFormatFromElement,
	hasCopyableFormat,
	type CopiedFormat,
} from './format-painter';
export { SlidesPanelComponent } from './slides-panel.component';
export { EditorToolbarComponent } from './editor-toolbar.component';
export { StatusBarComponent } from './status-bar.component';
export { EditorContextMenuComponent } from './editor-context-menu.component';
export { collectElementText, collectSlideText, searchSlides } from './slide-search';
export { ExportService } from './export.service';
export { renderToCanvas } from '../lib/canvas-export';
export {
	planGifFrames,
	encodeGif,
	msToFrameDelayCs,
	clampGifDimensions,
} from './gif-export-helpers';
export type { GifFrame, GifFramePlan, GifPlanOptions } from './gif-export-helpers';
export {
	planVideoSegments,
	recordWebm,
	pickSupportedMimeType,
	fpsToFrameIntervalMs,
	segmentFrameCount,
	WEBM_MIME_CANDIDATES,
} from './video-export-helpers';
export type { VideoSegmentPlan, VideoPlanOptions, RecordWebmOptions } from './video-export-helpers';
export { EditorStateService } from './editor-state.service';
export { EditorHistory } from './editor-history';
export {
	updateElementById,
	moveElementBy,
	setElementPosition,
	resizeElement,
	deleteElementsByIds,
	duplicateElementById,
	bringToFront,
	sendToBack,
	bringForward,
	sendBackward,
} from './element-operations';
export { applyMove, applyResize, RESIZE_HANDLES, type ResizeHandle, type Box } from './drag-resize';
export { resolveParagraphBullet, formatAutoNumber, bulletIndentPx } from './text-bullets';
export { EquationRendererComponent } from './equation-renderer.component';
export { ommlToMathml, convertOmmlToMathMl } from '../internal/shared';
export { LoadContentService } from './load-content.service';

// Comments
export { CommentMarkersOverlayComponent } from './comment-markers-overlay.component';
export { CommentsPanelComponent } from './comments-panel.component';
export { CommentsService, generateCommentId } from './comments.service';
export {
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';

// Digital signatures
export { SignaturesPanelComponent } from './signatures-panel.component';
export { SignaturesService } from './signatures.service';
export {
	isSigned,
	worstStatus,
	overallStatus,
	headerLabel,
	statusLabel,
	statusKind,
	signerName,
	signatureTimestamp,
	signatureKey,
	signatureCountLabel,
} from './signatures-helpers';
export type { OverallSignatureStatus, SignatureStatusKind } from './signatures-helpers';

// Accessibility
export { AccessibilityPanelComponent } from './accessibility-panel.component';
export { AccessibilityService } from './accessibility.service';
export {
	collectAccessibilityIssues,
	countAccessibilityIssues,
	groupIssuesBySeverity,
	issueTypeLabel,
	issueTrackKey,
	SEVERITY_GROUPS,
	SEVERITY_LABELS,
	TYPE_LABELS,
} from './accessibility-helpers';
export type { AccessibilityIssueGroup } from './accessibility-helpers';

// Embedded fonts
export { EmbeddedFontsService } from './embedded-fonts.service';
export {
	EMBEDDED_FONTS_STYLE_ID,
	buildEmbeddedFontStyles,
	buildFontFaceRule,
	resolveFontVariant,
	isInjectableUrl,
	normalizeFontFormat,
	fontMimeForFormat,
} from './embedded-fonts-helpers';
export type {
	ResolvedFontVariant,
	EmbeddedFontStyles,
	ObjectUrlFactory,
} from './embedded-fonts-helpers';

// Animation playback
export { AnimationPanelComponent } from './animation-panel.component';
export { ActionSettingsPanelComponent } from './action-settings-panel.component';
export { ImagePropertiesPanelComponent } from './image-properties-panel.component';
export { MediaPropertiesPanelComponent } from './media-properties-panel.component';
export { HeaderFooterDialogComponent } from './header-footer-dialog.component';
export { MediaPreviewComponent } from './media-preview.component';
export { MediaTrimTimelineComponent } from './media-trim-timeline.component';
export { SlideThemeOverridePanelComponent } from './slide-theme-override-panel.component';
export { ThemeEditorFieldsComponent } from './theme-editor-fields.component';
export type { CustomThemeEdit } from './theme-editor-fields.component';
export { AnimationPlaybackService } from './animation-playback.service';
export {
	buildClickGroups,
	clampStep,
	advanceStep,
	durationOf,
	revealedElementStyles,
	pendingElementStyles,
} from './animation-playback-helpers';
export type { AnimationClickGroup, CSSProperties } from './animation-playback-helpers';

// Collaboration (Yjs)
export { CollaborationCursorsComponent } from './collaboration-cursors.component';
export { CollaborationService } from './collaboration.service';
export {
	validateRoomId,
	isValidRoomId,
	sanitizeUserName,
	sanitizeColor,
	sanitizeSlideIndex,
	clampCursorPosition,
	derivePresenceList,
	presenceToCursors,
	assignUserColor,
	formatCursorLabel,
	CURSOR_PALETTE,
} from './collaboration-helpers';
export type { RemoteCursor, RemotePresence } from './collaboration-helpers';

// Dialog suite
export { ModalDialogComponent } from './modal-dialog.component';
export { PropertiesDialogComponent } from './properties-dialog.component';
export { ShareDialogComponent } from './share-dialog.component';
export { HyperlinkDialogComponent } from './hyperlink-dialog.component';
export { BroadcastDialogComponent } from './broadcast-dialog.component';
export {
	seedPropertiesDraft,
	formatPropertyDate,
	buildPropertiesPatch,
} from './properties-dialog-helpers';
export type { DocumentProperties, PropertiesDraft } from './properties-dialog-helpers';
export {
	seedShareFields,
	canStartShare,
	buildCollaborationConfig,
	buildShareUrl,
} from './share-helpers';
export type { ShareDefaults, ShareFormFields } from './share-helpers';
export {
	hasExistingLink,
	seedHyperlinkDraft,
	buildHyperlinkPatch,
	buildClearHyperlinkPatch,
} from './hyperlink-dialog-helpers';
export type { HyperlinkDraft } from './hyperlink-dialog-helpers';
export {
	DEFAULT_BROADCAST_SERVER_URL,
	generateBroadcastRoomId,
	seedBroadcastFields,
	canStartBroadcast,
	buildBroadcastConfig,
	buildBroadcastViewerUrl,
	canUseClipboard,
} from './broadcast-helpers';
export type { BroadcastDefaults, BroadcastConfig } from './broadcast-helpers';

// Secondary dialog suite (equation editor, set-up slide show, password
// protection, encrypted-file notice, compare, font embedding, version history,
// shortcut cheat-sheet, keep-annotations, signature-stripped warning)
export { ViewerExtraDialogsComponent } from './viewer-extra-dialogs.component';
export { ViewerDialogsService } from './viewer-dialogs.service';
export { ViewerCompareService } from './viewer-compare.service';
export { EquationEditorDialogComponent } from './equation-editor-dialog.component';
export { EquationTemplateGalleryComponent } from './equation-template-gallery.component';
export { TEMPLATES as EQUATION_TEMPLATES, latexToMathml } from './equation-editor-helpers';
export type { EquationTemplate } from './equation-editor-helpers';
export { SetUpSlideShowDialogComponent } from './set-up-slide-show-dialog.component';
export { ShowOptionsFieldsetComponent } from './show-options-fieldset.component';
export { ShowSlidesFieldsetComponent } from './show-slides-fieldset.component';
export { PasswordProtectionDialogComponent } from './password-protection-dialog.component';
export { PasswordStrengthMeterComponent } from './password-strength-meter.component';
export { getPasswordStrength, validatePassword } from './password-protection-helpers';
export { EncryptedFileDialogComponent } from './encrypted-file-dialog.component';
export { ComparePanelComponent } from './compare-panel.component';
export { SlideDiffRowComponent } from './slide-diff-row.component';
export { SlideDiffThumbnailsComponent } from './slide-diff-thumbnails.component';
export { SlideDiffChangesComponent } from './slide-diff-changes.component';
export {
	changeCountLabel,
	changeIcon,
	slideNumberOf,
	statusLabel as slideDiffStatusLabel,
} from './slide-diff-helpers';
export { FontEmbeddingPanelComponent } from './font-embedding-panel.component';
export { FontEmbeddingListComponent } from './font-embedding-list.component';
export { checkFontAvailable, scanAvailableFonts } from './font-embedding-helpers';
export { VersionHistoryPanelComponent } from './version-history-panel.component';
export {
	deleteVersion as deleteRecoveryVersion,
	formatFileSize,
	getVersions as getRecoveryVersions,
} from './version-history-helpers';
export type { RecoveryVersion } from './version-history-helpers';
export { ShortcutPanelComponent } from './shortcut-panel.component';
export { SettingsDialogComponent } from './settings-dialog.component';
export type { ViewerSettings } from './settings-dialog.component';
export { SettingsAppearanceTabComponent } from './settings-appearance-tab.component';
export { SettingsLanguageTabComponent } from './settings-language-tab.component';
export { AccountPageComponent } from './account-page.component';
export {
	AVATAR_COLOR_SWATCHES,
	clearAllLocalViewerData,
	DEFAULT_VIEWER_PROFILE,
	getLocalStorageUsageSummary,
	resolveProfileInitial,
	saveViewerProfile,
} from '../internal/shared';
export type {
	AccountAuthConfig,
	LocalStorageUsageSummary,
	ViewerProfile,
} from '../internal/shared';
export { KeepAnnotationsDialogComponent } from './keep-annotations-dialog.component';
export { SignatureStrippedDialogComponent } from './signature-stripped-dialog.component';
export {
	annotationMapToInkInserts,
	applyAcceptedDiff,
	buildEquationElement,
	buildEquationSegment,
	collectUsedFontFamilies,
	countAnnotationStrokes,
} from './viewer-extra-dialogs-helpers';
export type { AnnotationInkInsert } from './viewer-extra-dialogs-helpers';

// Print
export { PrintDialogComponent } from './print-dialog.component';
export { PrintSettingsPanelComponent } from './print-settings-panel.component';
export { PrintService } from './print.service';
export {
	buildPrintDocument,
	computeSlideIndices,
	computePageCount,
	estimatePageCount,
	computeHandoutLayout,
	validatePrintSettings,
	normalizeSlidesPerPage,
	DEFAULT_PRINT_SETTINGS,
	HANDOUT_OPTIONS,
} from './print-helpers';
export type {
	PrintWhat,
	PrintOrientation,
	PrintColorMode,
	HandoutSlidesPerPage,
	PrintSlideRange,
	PrintSettings,
	PrintDocumentOptions,
} from './print-helpers';

// Presentation annotations + subtitles
export { PresentationAnnotationsService } from './presentation-annotations.service';
export { PresentationAnnotationOverlayComponent } from './presentation-annotation-overlay.component';
export { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
export { PresentationToolbarComponent } from './presentation-toolbar.component';
export type { PresentToolbarAction } from './presentation-toolbar.component';
export { PresentToolbarAutoHide } from './presentation-toolbar-view';
export type { AnnotationStroke, PresentationTool } from './presentation-annotations-helpers';

// Presentation transitions + presenter view
export { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
export { PresenterViewComponent } from './presenter-view.component';
export { MobilePresenterViewComponent } from './mobile-presenter-view.component';
export {
	getSlideTransitionAnimations,
	resolveTransitionDuration,
	SLIDE_TRANSITION_KEYFRAMES,
} from './transition-helpers';
export type { SlideTransitionAnimations } from './transition-helpers';
// `computeTimerProgress` / `TimerProgress` / `TIMER_SEGMENT_MS` were an Angular
// re-derivation of the console's five-minute progress segment; they are now the
// shared `presenterTimerProgress` / `PresenterTimerProgress` /
// `PRESENTER_TIMER_SEGMENT_MS`, which every binding reads.
export {
	formatTime,
	formatElapsed,
	clampNotesFontSize,
	presenterTimerProgress,
	PRESENTER_TIMER_SEGMENT_MS,
	resolvePresenterNotes,
} from './presenter-view-helpers';
export type {
	NotesSegmentViewModel,
	PresenterNotes,
	PresenterTimerProgress,
} from './presenter-view-helpers';

// Audience window handoff (opt-in, framework-agnostic; wire-compatible with
// the React/Vue bindings via a shared IndexedDB database/store/key).
export {
	AUDIENCE_HASH,
	isAudienceTab,
	storeAudienceContent,
	loadAudienceContent,
	clearAudienceContent,
} from './audience-content-store';
export {
	PresenterWindowService,
	PRESENTER_CHANNEL_NAME,
	PRESENTER_MSG_ORIGIN,
	AUDIENCE_NONCE_KEY,
	isPresenterMessage,
	parseAudienceNonce,
} from './presenter-window.service';
export type {
	PresenterMessage,
	PresenterSlideChangeMessage,
	PresenterExitMessage,
} from './presenter-window.service';

export type { CanvasSize, CollaborationConfig, CollaborationRole } from './types';
export type { ViewerMode, PowerPointViewerAPI, ToolbarActionId } from '../internal/shared';
export type { StyleMap } from './element-style';
export {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
	getImageSrc,
	getDuotoneFilterDef,
} from './element-style';
export { buildDuotoneFilter, buildDuotoneFilterId } from './duotone-filter';
export type { DuotoneFilterDef } from './duotone-filter';
export { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './shape-geometry';
export { getTextWarp, getWarpCategory } from './text-warp';
export type { TextWarpDef, TextWarpPathDef, TextWarpCssDef } from './text-warp';
export { getWarpPath, shouldUseSvgWarp, SVG_WARP_PRESETS } from './warp-path-generators';
export { getSlideBackgroundStyle, DEFAULT_SLIDE_BACKGROUND } from './slide-background';
export { resolveHyperlinkHref, isUrlSafe, isPpactionUrl } from './hyperlink';
export { buildCssGradientFromShapeStyle } from './color-gradient';
export { getPatternSvg, buildPatternFillCss } from './color-patterns';
export {
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
} from './constants';
