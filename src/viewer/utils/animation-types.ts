import type { PptxAnimationTrigger } from "../../core";

// ==========================================================================
// Animation step interface
// ==========================================================================

export interface AnimationStep {
  elementId: string;
  trigger: PptxAnimationTrigger;
  delayMs: number;
  durationMs: number;
  cssKeyframes: string;
  cssAnimation: string;
  fillMode: "forwards" | "backwards" | "both";
}

// ==========================================================================
// Effect name type
// ==========================================================================

export type EffectName =
  | "appear"
  | "fadeIn"
  | "flyInLeft"
  | "flyInRight"
  | "flyInTop"
  | "flyInBottom"
  | "zoomIn"
  | "bounceIn"
  | "wipeIn"
  | "splitIn"
  | "dissolveIn"
  | "wheelIn"
  | "blindsIn"
  | "boxIn"
  | "floatIn"
  | "riseUp"
  | "swivel"
  | "expandIn"
  | "checkerboardIn"
  | "flashIn"
  | "peekIn"
  | "randomBarsIn"
  | "spinnerIn"
  | "growTurnIn"
  | "disappear"
  | "fadeOut"
  | "flyOutLeft"
  | "flyOutRight"
  | "flyOutTop"
  | "flyOutBottom"
  | "zoomOut"
  | "bounceOut"
  | "wipeOut"
  | "shrinkOut"
  | "dissolveOut"
  | "pulse"
  | "spin"
  | "teeter"
  | "growShrink"
  | "transparency"
  | "boldFlash"
  | "wave"
  | "colorWave"
  | "bounce"
  | "flash";
