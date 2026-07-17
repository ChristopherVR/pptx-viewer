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

// ── Unstable / internal: no compatibility guarantees ──────────────────────
// Every internal service, component, and helper that composes
// `PowerPointViewerComponent` but isn't part of the curated surface above.
// ng-packagr builds this package as a single entry point, so there is no
// separate `pptx-angular-viewer/hooks-unstable` subpath the way React has
// `pptx-react-viewer/hooks-unstable`; these are exported from the package
// root instead. See `docs/angular/services.md` and
// `docs/angular/services-reference.md` for the full picture. Names,
// signatures, and behavior here can change or be removed in ANY release,
// including a patch release, without a deprecation period.
export * from './services-unstable';
