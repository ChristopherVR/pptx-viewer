/**
 * CSS-based slide transition definitions for PowerPoint presentation mode.
 *
 * Barrel re-export — implementation split into:
 *   - transition-keyframes.ts  (CSS @keyframes + types)
 *   - transition-helpers.ts    (direction resolvers + constants)
 *   - transition-resolver.ts   (main resolver function)
 */
export type { SlideTransitionAnimations } from "./transition-keyframes";
export { SLIDE_TRANSITION_KEYFRAMES } from "./transition-keyframes";
export { getSlideTransitionAnimations } from "./transition-resolver";
