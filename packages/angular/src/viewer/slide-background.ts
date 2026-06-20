/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The slide-background style cascade (resolved background fields -> CSS map)
 * was extracted to `pptx-viewer-shared` (`render/slide-background`) and is
 * consumed by every binding. This shim preserves the historical Angular import
 * surface so `slide-canvas.component.ts` and the colocated test are unchanged.
 * Angular imports shared from `../internal/shared` (the vendored barrel), never
 * the bare `'pptx-viewer-shared'` specifier (which ng-packagr would externalize).
 */
export { DEFAULT_SLIDE_BACKGROUND, getSlideBackgroundStyle } from '../internal/shared';
