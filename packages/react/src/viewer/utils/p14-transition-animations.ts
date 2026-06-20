/**
 * Thin re-export shim: the Office 2010 (p14) transition resolver now lives in
 * `pptx-viewer-shared` (`getP14TransitionAnimations`). Kept so existing
 * importers/tests resolve unchanged.
 */
export { getP14TransitionAnimations } from 'pptx-viewer-shared';
