/**
 * Thin re-export shim: the type->`animation` slide-transition resolver now
 * lives in `pptx-viewer-shared` (`getSlideTransitionAnimations`). Kept so
 * existing importers (`slide-transitions` barrel, tests) resolve unchanged.
 */
export { getSlideTransitionAnimations } from 'pptx-viewer-shared';
