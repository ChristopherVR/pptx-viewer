export { PowerPointViewerComponent } from './power-point-viewer.component';
export { SlideCanvasComponent } from './slide-canvas.component';
export { ElementRendererComponent } from './element-renderer.component';
export { ConnectorRendererComponent } from './connector-renderer.component';
export { ConnectorTextOverlayComponent } from './connector-text-overlay.component';
export { routeOrthogonalConnector, waypointsToPathD } from './connector-routing';
export type { Point as ConnectorPoint, Rect as ConnectorObstacle } from './connector-routing';
export type { ConnectorRouting } from './connector-path';
export { TableRendererComponent } from './table-renderer.component';
export { ChartRendererComponent } from './chart-renderer.component';
export { SmartArtRendererComponent } from './smart-art-renderer.component';
export { InkRendererComponent } from './ink-renderer.component';
export { OleRendererComponent } from './ole-renderer.component';
export { Model3DRendererComponent } from './model3d-renderer.component';
export { ZoomRendererComponent } from './zoom-renderer.component';
export { PresentationOverlayComponent } from './presentation-overlay.component';
export { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
export { FindBarComponent } from './find-bar.component';
export { InspectorPanelComponent } from './inspector-panel.component';
export { GradientPickerComponent } from './gradient-picker.component';
export { EffectsPanelComponent } from './effects-panel.component';
export { TextAdvancedPanelComponent } from './text-advanced-panel.component';
export { TableDataEditorComponent } from './table-data-editor.component';
export { ChartDataEditorComponent } from './chart-data-editor.component';
export { SlidesPanelComponent } from './slides-panel.component';
export { EditorToolbarComponent } from './editor-toolbar.component';
export { EditorContextMenuComponent } from './editor-context-menu.component';
export { collectElementText, collectSlideText, searchSlides } from './slide-search';
export { ExportService } from './export.service';
export { renderToCanvas } from '../lib/canvas-export';
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
export { ommlToMathml, convertOmmlToMathMl } from './omml-to-mathml';
export { LoadContentService } from './load-content.service';

// Comments
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

// Presentation transitions + presenter view
export { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
export { PresenterViewComponent } from './presenter-view.component';
export {
	getSlideTransitionAnimations,
	resolveTransitionDuration,
	SLIDE_TRANSITION_KEYFRAMES,
} from './transition-helpers';
export type { SlideTransitionAnimations } from './transition-helpers';
export {
	formatTime,
	formatElapsed,
	clampNotesFontSize,
	computeTimerProgress,
	resolvePresenterNotes,
} from './presenter-view-helpers';
export type {
	NotesSegmentViewModel,
	PresenterNotes,
	TimerProgress,
} from './presenter-view-helpers';

export type { CanvasSize, CollaborationConfig, CollaborationRole } from './types';
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
