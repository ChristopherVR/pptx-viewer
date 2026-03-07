import type React from "react";

import type {
  PptxAnimationPreset,
  PptxNativeAnimation,
} from "../../core";
import type { EffectName } from "./animation-types";
import { resolveEffect } from "./animation-helpers";

// ==========================================================================
// Entrance effects that should initially hide elements
// ==========================================================================

const ENTRANCE_EFFECTS: ReadonlySet<EffectName> = new Set<EffectName>([
  "appear",
  "fadeIn",
  "flyInLeft",
  "flyInRight",
  "flyInTop",
  "flyInBottom",
  "zoomIn",
  "bounceIn",
  "wipeIn",
  "splitIn",
  "dissolveIn",
  "wheelIn",
  "blindsIn",
  "boxIn",
  "floatIn",
  "riseUp",
  "swivel",
  "expandIn",
  "checkerboardIn",
  "flashIn",
  "peekIn",
  "randomBarsIn",
  "spinnerIn",
  "growTurnIn",
]);

/**
 * Returns the initial CSS styles for an element before its entrance animation
 * plays. For clip-path-based animations the element is visible but fully
 * clipped; for all other entrances it starts fully transparent.
 */
export function getInitialStyleForEffect(
  effect: EffectName,
): React.CSSProperties {
  switch (effect) {
    case "flyInLeft":
      return { opacity: 0, transform: "translateX(-100%)" };
    case "flyInRight":
      return { opacity: 0, transform: "translateX(100%)" };
    case "flyInTop":
      return { opacity: 0, transform: "translateY(-100%)" };
    case "flyInBottom":
      return { opacity: 0, transform: "translateY(100%)" };
    case "zoomIn":
      return { opacity: 0, transform: "scale(0.3)" };
    case "bounceIn":
      return { opacity: 0, transform: "scale(0.3)" };
    case "expandIn":
      return { opacity: 0, transform: "scale(0, 0)" };
    case "wheelIn":
      return { opacity: 0, transform: "rotate(-360deg) scale(0.5)" };
    case "spinnerIn":
      return { opacity: 0, transform: "rotate(-720deg) scale(0.4)" };
    case "growTurnIn":
      return { opacity: 0, transform: "rotate(-90deg) scale(0.4)" };
    case "swivel":
      return { opacity: 0, transform: "rotateY(-90deg)" };
    case "floatIn":
      return { opacity: 0, transform: "translateY(40px)" };
    case "riseUp":
      return { opacity: 0, transform: "translateY(60px)" };
    case "dissolveIn":
      return { opacity: 0, filter: "blur(8px)" };
    case "wipeIn":
      return { clipPath: "inset(0 100% 0 0)", opacity: 1 };
    case "splitIn":
      return { clipPath: "inset(50% 0 50% 0)", opacity: 1 };
    case "blindsIn":
      return { clipPath: "inset(0 0 100% 0)", opacity: 1 };
    case "boxIn":
      return { clipPath: "inset(50% 50% 50% 50%)", opacity: 1 };
    case "peekIn":
      return { clipPath: "inset(100% 0 0 0)", opacity: 1 };
    case "randomBarsIn":
      return { clipPath: "inset(0 100% 0 0)", opacity: 1 };
    case "appear":
    case "fadeIn":
    case "checkerboardIn":
    case "flashIn":
    default:
      return { opacity: 0 };
  }
}

// ==========================================================================
// getAnimationInitialStyle (updated to handle all presets + native effects)
// ==========================================================================

export function getAnimationInitialStyle(
  preset: PptxAnimationPreset | undefined,
  nativeAnimation?: PptxNativeAnimation,
): React.CSSProperties {
  // If a native animation is supplied, derive the initial style from its
  // preset class and preset ID.
  if (nativeAnimation) {
    const effect = resolveEffect(nativeAnimation);
    if (effect && ENTRANCE_EFFECTS.has(effect)) {
      return getInitialStyleForEffect(effect);
    }
    // Exit / emphasis effects don't change initial visibility.
    return {};
  }

  // Legacy PptxAnimationPreset path — kept for backwards compatibility.
  switch (preset) {
    case "flyIn":
      return { opacity: 0, transform: "translateX(42px)" };
    case "flyOut":
      return { opacity: 0, transform: "translateX(42px)" };
    case "zoomIn":
      return { opacity: 0, transform: "scale(0.72)" };
    case "zoomOut":
      return { opacity: 0, transform: "scale(0.72)" };
    case "fadeIn":
    case "fadeOut":
      return { opacity: 0 };
    default:
      return {};
  }
}
