/**
 * Thin re-export shim. The native-animation timeline types now live in
 * `pptx-viewer-shared` (`render/animation-timeline-types`); this preserves the
 * historical `./animation-types` import path used across the React binding.
 */
export type { AnimationStep, EffectName } from 'pptx-viewer-shared';
