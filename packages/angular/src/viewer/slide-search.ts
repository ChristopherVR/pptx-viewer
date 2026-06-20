/**
 * Thin re-export shim → vendored `pptx-viewer-shared` (`render/slide-search`).
 *
 * The pure slide text-search helpers were extracted to shared and are consumed
 * by every binding. This shim preserves the historical Angular import surface.
 */

export type { SlideSearchMatch } from '../internal/shared';
export { collectElementText, collectSlideText, searchSlides } from '../internal/shared';
