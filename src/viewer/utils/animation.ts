/**
 * Animation utilities — barrel re-export.
 *
 * Implementation split into sub-modules:
 *   animation-types.ts     — AnimationStep interface, EffectName type
 *   animation-presets.ts   — PRESET_ID_TO_EFFECT mapping
 *   animation-keyframes.ts — CSS @keyframes definitions
 *   animation-effects.ts   — entrance effects, initial style helpers
 *   animation-helpers.ts   — resolveEffect, dynamic keyframes, readFileAsDataUrl
 *   animation-sequencer.ts — AnimationSequencer class
 */
export type { AnimationStep } from "./animation-types";
export { PRESET_ID_TO_EFFECT } from "./animation-presets";
export { getEffectKeyframes } from "./animation-keyframes";
export {
  getInitialStyleForEffect,
  getAnimationInitialStyle,
} from "./animation-effects";
export { readFileAsDataUrl } from "./animation-helpers";
export { AnimationSequencer } from "./animation-sequencer";
