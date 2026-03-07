/**
 * OOXML animation preset mappings and helper functions for the animation
 * write service.
 */
import type {
  PptxAnimationTrigger,
  PptxElementAnimation,
  XmlObject,
} from "../types";

/**
 * Maps editor animation presets to OOXML preset class + presetID pairs.
 */
export interface OoxmlPresetMapping {
  presetClass: "entr" | "exit" | "emph" | "path";
  presetId: number;
  /** Default OOXML preset subtype (direction variant). */
  defaultSubtype: number;
}

export const PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
  // ---- Entrance effects ----
  appear: { presetClass: "entr", presetId: 1, defaultSubtype: 0 },
  fadeIn: { presetClass: "entr", presetId: 10, defaultSubtype: 0 },
  flyIn: { presetClass: "entr", presetId: 2, defaultSubtype: 4 },
  zoomIn: { presetClass: "entr", presetId: 23, defaultSubtype: 0 },
  blindsIn: { presetClass: "entr", presetId: 3, defaultSubtype: 0 },
  boxIn: { presetClass: "entr", presetId: 4, defaultSubtype: 0 },
  checkerboardIn: { presetClass: "entr", presetId: 5, defaultSubtype: 0 },
  expandIn: { presetClass: "entr", presetId: 6, defaultSubtype: 0 },
  dissolveIn: { presetClass: "entr", presetId: 9, defaultSubtype: 0 },
  flashIn: { presetClass: "entr", presetId: 12, defaultSubtype: 0 },
  peekIn: { presetClass: "entr", presetId: 16, defaultSubtype: 0 },
  randomBarsIn: { presetClass: "entr", presetId: 17, defaultSubtype: 0 },
  wipeIn: { presetClass: "entr", presetId: 22, defaultSubtype: 0 },
  riseUp: { presetClass: "entr", presetId: 26, defaultSubtype: 0 },
  bounceIn: { presetClass: "entr", presetId: 37, defaultSubtype: 0 },
  floatIn: { presetClass: "entr", presetId: 42, defaultSubtype: 0 },
  swivel: { presetClass: "entr", presetId: 47, defaultSubtype: 0 },
  spinnerIn: { presetClass: "entr", presetId: 49, defaultSubtype: 0 },
  growTurnIn: { presetClass: "entr", presetId: 53, defaultSubtype: 0 },
  splitIn: { presetClass: "entr", presetId: 31, defaultSubtype: 0 },
  wheelIn: { presetClass: "entr", presetId: 21, defaultSubtype: 1 },
  // ---- Exit effects ----
  disappear: { presetClass: "exit", presetId: 1, defaultSubtype: 0 },
  flyOut: { presetClass: "exit", presetId: 2, defaultSubtype: 4 },
  shrinkOut: { presetClass: "exit", presetId: 6, defaultSubtype: 0 },
  dissolveOut: { presetClass: "exit", presetId: 9, defaultSubtype: 0 },
  fadeOut: { presetClass: "exit", presetId: 10, defaultSubtype: 0 },
  wipeOut: { presetClass: "exit", presetId: 22, defaultSubtype: 0 },
  zoomOut: { presetClass: "exit", presetId: 23, defaultSubtype: 0 },
  bounceOut: { presetClass: "exit", presetId: 37, defaultSubtype: 0 },
  // ---- Emphasis effects ----
  boldFlash: { presetClass: "emph", presetId: 1, defaultSubtype: 0 },
  wave: { presetClass: "emph", presetId: 2, defaultSubtype: 0 },
  colorWave: { presetClass: "emph", presetId: 2, defaultSubtype: 0 },
  growShrink: { presetClass: "emph", presetId: 6, defaultSubtype: 0 },
  spin: { presetClass: "emph", presetId: 8, defaultSubtype: 0 },
  transparency: { presetClass: "emph", presetId: 9, defaultSubtype: 0 },
  teeter: { presetClass: "emph", presetId: 14, defaultSubtype: 0 },
  pulse: { presetClass: "emph", presetId: 26, defaultSubtype: 0 },
  bounce: { presetClass: "emph", presetId: 26, defaultSubtype: 0 },
  flash: { presetClass: "emph", presetId: 1, defaultSubtype: 0 },
};

/**
 * Maps editor direction values to OOXML presetSubtype values for fly effects.
 */
export const DIRECTION_TO_SUBTYPE: Record<string, number> = {
  fromBottom: 4,
  fromLeft: 8,
  fromRight: 2,
  fromTop: 1,
  fromTopLeft: 9,
  fromTopRight: 3,
  fromBottomLeft: 12,
  fromBottomRight: 6,
};

/**
 * Maps editor trigger names to OOXML nodeType attribute values.
 */
export function triggerToNodeType(trigger: PptxAnimationTrigger): string {
  switch (trigger) {
    case "afterPrevious":
      return "afterEffect";
    case "withPrevious":
      return "withEffect";
    case "afterDelay":
      return "afterEffect";
    case "onHover":
      return "mouseOver";
    case "onShapeClick":
      return "clickEffect";
    case "onClick":
    default:
      return "clickEffect";
  }
}

/**
 * Maps editor timing curve to OOXML animation formula filter values.
 */
export function timingCurveToAccelDecel(curve: string | undefined): {
  accel: number;
  decel: number;
} {
  switch (curve) {
    case "ease-in":
      return { accel: 100000, decel: 0 };
    case "ease-out":
      return { accel: 0, decel: 100000 };
    case "ease":
      return { accel: 50000, decel: 50000 };
    case "linear":
    default:
      return { accel: 0, decel: 0 };
  }
}

export interface IPptxAnimationWriteService {
  buildTimingXml(
    animations: PptxElementAnimation[],
    existingRawTiming: XmlObject | undefined,
  ): XmlObject | undefined;
}
