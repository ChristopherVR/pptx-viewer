import type React from "react";
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
} from "react-icons/lu";

import type {
  PptxAnimationDirection,
  PptxAnimationRepeatMode,
  PptxAnimationSequence,
  PptxAnimationTimingCurve,
  PptxAnimationTrigger,
} from "../../../core";
import { ANIMATION_PRESET_OPTIONS } from "../../constants";

// ==========================================================================
// CSS classes
// ==========================================================================

export const INPUT_CLS =
  "bg-muted border border-border rounded px-2 py-1 w-full text-[11px]";
export const SELECT_CLS =
  "bg-muted border border-border rounded px-2 py-1 w-full text-[11px]";

// ==========================================================================
// Preset groups
// ==========================================================================

export const ENTRANCE_PRESETS = ANIMATION_PRESET_OPTIONS.filter(
  (o) => o.value === "fadeIn" || o.value === "flyIn" || o.value === "zoomIn",
);
export const EXIT_PRESETS = ANIMATION_PRESET_OPTIONS.filter(
  (o) => o.value === "fadeOut" || o.value === "flyOut" || o.value === "zoomOut",
);
export const EMPHASIS_PRESETS = ANIMATION_PRESET_OPTIONS.filter(
  (o) =>
    o.value === "spin" ||
    o.value === "pulse" ||
    o.value === "colorWave" ||
    o.value === "bounce" ||
    o.value === "flash" ||
    o.value === "growShrink" ||
    o.value === "teeter",
);

// ==========================================================================
// Option arrays
// ==========================================================================

export const TRIGGER_OPTIONS: ReadonlyArray<{
  value: PptxAnimationTrigger;
  labelKey: string;
}> = [
  { value: "onClick", labelKey: "pptx.animation.trigger.onClick" },
  { value: "onShapeClick", labelKey: "pptx.animation.trigger.onShapeClick" },
  { value: "onHover", labelKey: "pptx.animation.trigger.onHover" },
  { value: "afterPrevious", labelKey: "pptx.animation.trigger.afterPrevious" },
  { value: "withPrevious", labelKey: "pptx.animation.trigger.withPrevious" },
];

export const TIMING_CURVE_OPTIONS: ReadonlyArray<{
  value: PptxAnimationTimingCurve;
  labelKey: string;
}> = [
  { value: "ease", labelKey: "pptx.animation.timingCurve.ease" },
  { value: "ease-in", labelKey: "pptx.animation.timingCurve.easeIn" },
  { value: "ease-out", labelKey: "pptx.animation.timingCurve.easeOut" },
  { value: "linear", labelKey: "pptx.animation.timingCurve.linear" },
];

export const REPEAT_MODE_OPTIONS: ReadonlyArray<{
  value: "none" | PptxAnimationRepeatMode;
  labelKey: string;
}> = [
  { value: "none", labelKey: "pptx.animation.repeatUntil.none" },
  {
    value: "untilNextClick",
    labelKey: "pptx.animation.repeatUntil.untilNextClick",
  },
  {
    value: "untilEndOfSlide",
    labelKey: "pptx.animation.repeatUntil.untilEndOfSlide",
  },
];

export const DIRECTION_OPTIONS: ReadonlyArray<{
  value: PptxAnimationDirection;
  labelKey: string;
  icon: React.ElementType;
}> = [
  {
    value: "fromTop",
    labelKey: "pptx.animation.direction.fromTop",
    icon: LuArrowDown,
  },
  {
    value: "fromBottom",
    labelKey: "pptx.animation.direction.fromBottom",
    icon: LuArrowUp,
  },
  {
    value: "fromLeft",
    labelKey: "pptx.animation.direction.fromLeft",
    icon: LuArrowRight,
  },
  {
    value: "fromRight",
    labelKey: "pptx.animation.direction.fromRight",
    icon: LuArrowLeft,
  },
];

export const SEQUENCE_OPTIONS: ReadonlyArray<{
  value: PptxAnimationSequence;
  labelKey: string;
}> = [
  { value: "asOne", labelKey: "pptx.animation.sequence.asOne" },
  { value: "byParagraph", labelKey: "pptx.animation.sequence.byParagraph" },
  { value: "byWord", labelKey: "pptx.animation.sequence.byWord" },
  { value: "byLetter", labelKey: "pptx.animation.sequence.byLetter" },
];

/** Presets that support direction picking (fly-in/out). */
export const DIRECTIONAL_PRESETS = new Set<string>(["flyIn", "flyOut"]);
