/**
 * Public API surface for `pptx-angular-viewer`.
 *
 * Angular counterpart of the React `pptx-viewer` and Vue `pptx-vue-viewer`
 * packages. Wraps the framework-agnostic `pptx-viewer-core` engine and shares
 * cross-framework logic via `pptx-viewer-shared`.
 */
export * from './viewer';
export * from './theme';
export { cn, type ClassValue } from './utils';
export { keyToLabel, translationsEn, LOCALE_CATALOG } from './internal/shared-src/i18n';
export type { TranslationKey, LocaleCatalogEntry } from './internal/shared-src/i18n';

// ── AI assistant host-facing types (for typing the viewer's `ai` input). ──
// The stable root surface; the panel/service internals stay in `./viewer`.
export type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiElementUpdate,
	PptxAiToolName,
	PptxAiUIMessage,
	PptxAiWritePolicy,
	ProposalView,
	StagedProposal,
} from './internal/shared-ai';

// ── Internal building blocks. Not covered by semver; prefer the stable root exports. ──
// Every internal service, component, and helper that composes
// `PowerPointViewerComponent` but isn't part of the curated surface above.
// Import these from the `pptx-angular-viewer/internals` subpath, which is the
// uniform internal entry point across every binding. ng-packagr builds this
// package as a single compilation unit whose `rootDir` cannot span a separate
// secondary entry point without physically relocating ~150 source files, so
// `pptx-angular-viewer/internals` is an alias of the same bundle rather than an
// isolated one; as a consequence these symbols also remain importable from the
// package root. See `docs/angular/services.md` and
// `docs/angular/services-reference.md`.
export * from './internals';

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
} from './internal/shared';
export type { SavedPresentationFormat } from './internal/shared';
