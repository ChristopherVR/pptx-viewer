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

// ── Export (PNG / PDF) ──────────────────────────────────────────────────
export type { ExportPdfOptions, ExportProgress } from './viewer';

// ── i18n / styles ──────────────────────────────────────────────────────
export type { TranslationMessages, Translator } from './viewer';
export { createTranslator, getViewerCss } from './viewer';
export { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
export type { TranslationKey } from 'pptx-viewer-shared/i18n';

// ── Theme (re-exported from pptx-viewer-shared for host configuration) ─
export type { ViewerTheme, ViewerThemeColors } from 'pptx-viewer-shared';
export {
	defaultCssVars,
	defaultRadius,
	defaultThemeColors,
	themeToCssVars,
	vermilionDarkTheme,
	vermilionLightTheme,
} from 'pptx-viewer-shared';

// ── Core escape-hatch types ────────────────────────────────────────────
export type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
