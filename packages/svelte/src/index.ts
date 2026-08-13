/**
 * pptx-svelte-viewer: Svelte 5 PowerPoint viewer component.
 *
 * Public surface mirrors the Vue binding's viewer subset: the
 * `PowerPointViewer` component, its prop/event types, and the shared theme
 * system (types, defaults, CSS-variable helpers, Vermilion presets).
 */
export { PowerPointViewer } from './viewer/component';
export type {
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
	SvgExportAllOptions,
	SvgExportSingleSlideOptions,
} from './viewer/export';
export {
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
	exportSlideAsSvg,
	exportSlideToSvg,
	exportSlideToSvgBlob,
} from './viewer/export';
export type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	PowerPointViewerApi,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
} from './viewer/types';
// AI assistant types, re-exported so hosts can type the viewer's `ai` prop and
// build a bridge / connection without depending on `pptx-viewer-shared/ai`.
export type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiToolName,
	PptxAiUIMessage,
	PptxAiWritePolicy,
} from 'pptx-viewer-shared/ai';
export type { AutosaveStatus } from './viewer/state/autosave.svelte';
// Autosave recovery helpers (shared IndexedDB store), re-exported so a host can
// offer restore-on-load. The viewer itself never auto-restores (see the
// `autosave` prop docs); matching React/Vue, recovery is a host concern.
export {
	deleteAutosaveSnapshot,
	getAutosaveSnapshot,
	listAutosaveSnapshots,
} from 'pptx-viewer-shared';
export type { AutosaveRecord } from 'pptx-viewer-shared';
export { loadPresentationDeck, parsePresentationSessionId } from 'pptx-viewer-shared';
// Session restore (opt-in, host-driven): remember the deck the host has open,
// per browser tab, so a page refresh reopens it instead of dropping the user
// back on the file picker.
export {
	forgetSessionDeck,
	getSessionTabId,
	loadSessionDeck,
	rememberSessionDeck,
	restoreSessionDeck,
} from 'pptx-viewer-shared';
export type { SessionDeck } from 'pptx-viewer-shared';
export {
	defaultCssVars,
	defaultRadius,
	defaultThemeColors,
	themeToCssVars,
	vermilionDarkColors,
	vermilionDarkTheme,
	vermilionLightColors,
	vermilionLightTheme,
	vermilionRadius,
} from './theme';
export type { ViewerThemeColors } from './theme';
export { registerTranslations } from './i18n';
export type { TranslationDictionary, Translator } from './i18n';

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
export { renderToCanvas } from './viewer/export/render-to-canvas';
