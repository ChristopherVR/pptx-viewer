/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * The format-painter copy/apply logic was consolidated into
 * `pptx-viewer-shared` (`render/format-painter.ts`), shared by every binding.
 * This shim keeps the historical Angular import path for the component and its
 * tests.
 */
export * from '../internal/shared-src/render/format-painter';
