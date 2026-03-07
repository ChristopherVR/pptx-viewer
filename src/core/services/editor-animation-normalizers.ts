/**
 * Pure normalizer functions for editor animation attribute values.
 * Extracted from PptxEditorAnimationService to keep file sizes manageable.
 */
import type {
  PptxElementAnimation,
  PptxAnimationTimingCurve,
  PptxAnimationRepeatMode,
  PptxAnimationTrigger,
  PptxAnimationDirection,
  PptxAnimationSequence,
  PptxAfterAnimationAction,
} from "../types";

export function normalizeAnimationPreset(
  value: unknown,
): PptxElementAnimation["entrance"] | undefined {
  const token = String(value || "")
    .trim()
    .toLowerCase();
  if (!token) return undefined;

  const presetMap: Record<string, PptxElementAnimation["entrance"]> = {
    none: "none",
    // Entrance
    appear: "appear",
    fadein: "fadeIn",
    flyin: "flyIn",
    zoomin: "zoomIn",
    blindsin: "blindsIn",
    boxin: "boxIn",
    checkerboardin: "checkerboardIn",
    expandin: "expandIn",
    dissolvein: "dissolveIn",
    flashin: "flashIn",
    peekin: "peekIn",
    randombarsin: "randomBarsIn",
    wipein: "wipeIn",
    riseup: "riseUp",
    bouncein: "bounceIn",
    floatin: "floatIn",
    swivel: "swivel",
    spinnerin: "spinnerIn",
    growturnin: "growTurnIn",
    splitin: "splitIn",
    wheelin: "wheelIn",
    // Exit
    fadeout: "fadeOut",
    flyout: "flyOut",
    zoomout: "zoomOut",
    disappear: "disappear",
    bounceout: "bounceOut",
    wipeout: "wipeOut",
    shrinkout: "shrinkOut",
    dissolveout: "dissolveOut",
    // Emphasis
    spin: "spin",
    pulse: "pulse",
    colorwave: "colorWave",
    bounce: "bounce",
    flash: "flash",
    growshrink: "growShrink",
    teeter: "teeter",
    transparency: "transparency",
    boldflash: "boldFlash",
    wave: "wave",
  };
  return presetMap[token];
}

export function normalizeTrigger(
  value: unknown,
): PptxAnimationTrigger | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAnimationTrigger> = {
    onClick: "onClick",
    onHover: "onHover",
    afterPrevious: "afterPrevious",
    withPrevious: "withPrevious",
    afterDelay: "afterDelay",
  };
  return map[token];
}

export function normalizeTimingCurve(
  value: unknown,
): PptxAnimationTimingCurve | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAnimationTimingCurve> = {
    ease: "ease",
    "ease-in": "ease-in",
    "ease-out": "ease-out",
    linear: "linear",
  };
  return map[token];
}

export function normalizeRepeatMode(
  value: unknown,
): PptxAnimationRepeatMode | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAnimationRepeatMode> = {
    untilNextClick: "untilNextClick",
    untilEndOfSlide: "untilEndOfSlide",
  };
  return map[token];
}

export function normalizeDirection(
  value: unknown,
): PptxAnimationDirection | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAnimationDirection> = {
    fromLeft: "fromLeft",
    fromRight: "fromRight",
    fromTop: "fromTop",
    fromBottom: "fromBottom",
    fromTopLeft: "fromTopLeft",
    fromTopRight: "fromTopRight",
    fromBottomLeft: "fromBottomLeft",
    fromBottomRight: "fromBottomRight",
  };
  return map[token];
}

export function normalizeSequence(
  value: unknown,
): PptxAnimationSequence | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAnimationSequence> = {
    asOne: "asOne",
    byParagraph: "byParagraph",
    byWord: "byWord",
    byLetter: "byLetter",
  };
  return map[token];
}

export function normalizeAfterAnimation(
  value: unknown,
): PptxAfterAnimationAction | undefined {
  const token = String(value || "").trim();
  if (!token) return undefined;
  const map: Record<string, PptxAfterAnimationAction> = {
    none: "none",
    hideOnNextClick: "hideOnNextClick",
    hideAfterAnimation: "hideAfterAnimation",
    dimToColor: "dimToColor",
  };
  return map[token];
}
