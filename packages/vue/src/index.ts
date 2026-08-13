// ── Vue 3 PowerPoint viewer/editor ──
export {
	PowerPointViewer,
	SlideCanvas,
	SlideStage,
	ElementRenderer,
	RibbonToolbar,
	CollaborationCursors,
	CollaborationStatusIndicator,
	RemoteSelectionOverlay,
	FollowModeBar,
	useCollaboration,
	useYjsProvider,
	usePresenceTracking,
	useCollaborativeState,
	useCollaborativeHistory,
	exportSlideToSvg,
	exportSlideToSvgBlob,
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
} from './viewer';
export type {
	PowerPointViewerProps,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	CollaborationConfig,
	CollaborationRole,
	CanvasSize,
	RemoteCursor,
	RemotePresence,
	RemoteSelectionBox,
	UseCollaborationOptions,
	UseCollaborationResult,
	UsePresenceTrackingResult,
	UseCollaborativeStateResult,
	UseCollaborativeHistoryInput,
	UseCollaborativeHistoryResult,
	SvgExportSingleSlideOptions,
	SvgExportAllOptions,
	RibbonProps,
	ToolbarSection,
	DrawingTool,
	SupportedShapeType,
	ElementClipboardPayload,
	TableCellEditorState,
	LayoutOption,
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiToolName,
	PptxAiUIMessage,
	PptxAiWritePolicy,
	PptxAiBridge,
} from './viewer';

// ── Shared API types ──
export type {
	ViewerMode,
	PowerPointViewerAPI,
	ToolbarActionId,
	ToolbarButtonId,
	ToolbarTabId,
} from 'pptx-viewer-shared';

// ── Audience / presenter content sharing (IndexedDB, wire-compatible with React) ──
export {
	AUDIENCE_HASH,
	isAudienceTab,
	parseAudienceNonce,
	storeAudienceContent,
	loadAudienceContent,
	clearAudienceContent,
} from './viewer';
export { parsePresentationSessionId } from 'pptx-viewer-shared';

// ── Session restore (opt-in, host-driven) ──
// Remember the deck the host has open, per browser tab, so a page refresh
// reopens it instead of dropping the user back on the file picker.
export {
	forgetSessionDeck,
	getSessionTabId,
	loadSessionDeck,
	rememberSessionDeck,
	restoreSessionDeck,
} from 'pptx-viewer-shared';
export type { SessionDeck } from 'pptx-viewer-shared';

// ── Shared utilities ──
export { cn } from './utils';

// ── Theme configuration ──
export type { ViewerTheme, ViewerThemeColors } from './theme';
export {
	defaultThemeColors,
	defaultRadius,
	themeToCssVars,
	defaultCssVars,
	provideViewerTheme,
	useViewerTheme,
	useThemeStyle,
	vermilionLightColors,
	vermilionDarkColors,
	vermilionLightTheme,
	vermilionDarkTheme,
	vermilionRadius,
} from './theme';

// ── Openable-file allow list ───────────────────────────────────────────
// The one answer to "can the viewer open this file?", so a host's drop target
// and its `<input accept>` cannot disagree with the loader. Hand-rolled lists
// drift: every demo in this repo shipped `.pptx,.ppt,.json`, which refused a
// `.pptm` on drop that File > Open inside the viewer accepted without
// complaint. Re-exported here so a host never has to reach into
// `pptx-viewer-shared` (an internal, unpublished package) to get them.
export {
	PPTX_OPEN_ACCEPT,
	PRESENTATION_OPEN_EXTENSIONS,
	isSupportedPresentationFile,
	isLegacyBinaryPresentation,
	presentationBaseName,
	savedPresentationFileName,
} from 'pptx-viewer-shared';
export type { SavedPresentationFormat } from 'pptx-viewer-shared';

// ── Rasterisation escape hatch ─────────────────────────────────────────
// The same `html2canvas-pro` wrapper the built-in export pipeline uses, so a
// host building its own export gets the colour/CSS normalisation passes rather
// than calling html2canvas raw (which cannot parse the `oklch()` the viewer's
// theme tokens are authored in). React and Angular have always exported this;
// the other three did not, which is the asymmetry this closes.
export { renderToCanvas } from './lib/canvas-export';
