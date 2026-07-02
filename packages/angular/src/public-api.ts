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
export { keyToLabel, translationsEn } from './internal/shared-src/i18n';
