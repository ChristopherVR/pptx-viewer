/**
 * pptx-vanilla-viewer: a zero-framework PowerPoint viewer.
 *
 * ```ts
 * import { createPptxViewer } from 'pptx-vanilla-viewer';
 *
 * const viewer = createPptxViewer(document.getElementById('host')!, {
 * 	source: '/decks/quarterly.pptx',
 * });
 * ```
 *
 * Parsing/serialisation comes from `pptx-viewer-core` and all pure render
 * logic from `pptx-viewer-shared`; both are bundled in, so this package is
 * self-contained (peer deps: `jszip`, `fast-xml-parser`).
 */

// ── Viewer ─────────────────────────────────────────────────────────────
export { createPptxViewer, PptxViewer } from './viewer';
export type { PptxViewerCallbacks, PptxViewerInstance, PptxViewerOptions } from './viewer';
export type { PptxViewerSource } from './viewer';
export type { ViewerState, ZoomLevel } from './viewer';

// ── Collaboration + autosave (config + status types re-exported for hosts) ─
export type {
	AutosaveRecord,
	AutosaveStatus,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
} from './viewer';

// ── Element renderer extension surface ─────────────────────────────────
export type {
	CssStyleMap,
	ElementRenderContext,
	ElementRenderer,
	ElementRendererRegistry,
	PptxElementType,
	SlideStageOptions,
} from './viewer';
export {
	applyStyleMap,
	createDefaultRegistry,
	createEl,
	createElementRendererRegistry,
	createSvgEl,
	renderSlideStage,
} from './viewer';

// ── Ribbon / chrome builder (buildable standalone against your own store) ─
export type { Ribbon } from './viewer';
export { createRibbon } from './viewer';
export type {
	RibbonDesignHandlers,
	RibbonDrawHandlers,
	RibbonDrawState,
	RibbonEditState,
	RibbonFileHandlers,
	RibbonHandlers,
	RibbonInsertHandlers,
	RibbonNavHandlers,
	RibbonNavState,
	RibbonPrimaryHandlers,
	RibbonSelectionState,
	RibbonSlideShowHandlers,
	RibbonTabId,
} from './viewer';
// `RibbonHandlers.edit`/`findReplace` are typed by these two action-set
// interfaces; the factories that build real implementations of them
// (`createEditActions`, `createEditorController`, ...) stay internal,
// coupled to `PptxViewer`'s store/chrome/history wiring.
export type { EditActions, FindReplaceActions } from './viewer';

// ── Reactive store (build your own state container against `ViewerState`) ─
export type { Store } from './viewer';
export { createInitialViewerState, createStore } from './viewer';

// ── Export (PNG / PDF / GIF / WebM video / print) ───────────────────────
export type {
	ExportGifOptions,
	ExportPdfOptions,
	ExportProgress,
	SvgExportOptions,
	ExportVideoOptions,
	OpenPrintWindow,
	PrintOptions,
} from './viewer';
export { exportAllSlidesToSvg, exportSlideToSvg } from './viewer';

// ── i18n / styles ──────────────────────────────────────────────────────
export type { TranslationMessages, Translator } from './viewer';
export { createTranslator, getViewerCss } from './viewer';
export { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
export type { TranslationKey } from 'pptx-viewer-shared/i18n';

// ── Theme (re-exported from pptx-viewer-shared for host configuration) ─
export type { ViewerTheme, ViewerThemeColors } from 'pptx-viewer-shared';
// `createRibbon`'s `hiddenActions`/`accountAuth` params, re-exported so hosts
// can type them without a direct `pptx-viewer-shared` import.
export type { AccountAuthConfig, ToolbarActionId } from 'pptx-viewer-shared';
export {
	defaultCssVars,
	defaultRadius,
	defaultThemeColors,
	themeToCssVars,
	vermilionDarkTheme,
	vermilionLightTheme,
	loadPresentationDeck,
	parsePresentationSessionId,
} from 'pptx-viewer-shared';

// ── Core escape-hatch types ────────────────────────────────────────────
export type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
