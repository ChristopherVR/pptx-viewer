/**
 * Animation types: presets, triggers, timing, native parsed animation data,
 * and the high-level {@link PptxElementAnimation} associated with each element.
 *
 * @module pptx-types/animation
 */

import type { XmlObject } from "./common";

// ==========================================================================
// Animation types
// ==========================================================================

/**
 * Built-in animation preset names used for entrance, exit, and emphasis effects.
 *
 * @example
 * ```ts
 * const preset: PptxAnimationPreset = "fadeIn";
 * // => "fadeIn" — one of: none | fadeIn | flyIn | zoomIn | fadeOut | flyOut | zoomOut | spin | pulse | ...
 * ```
 */
export type PptxAnimationPreset =
  | "none"
  // Entrance
  | "appear"
  | "fadeIn"
  | "flyIn"
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
  // Exit
  | "fadeOut"
  | "flyOut"
  | "zoomOut"
  | "bounceOut"
  | "wipeOut"
  | "shrinkOut"
  | "dissolveOut"
  | "disappear"
  // Emphasis
  | "spin"
  | "pulse"
  | "colorWave"
  | "bounce"
  | "flash"
  | "growShrink"
  | "teeter"
  | "transparency"
  | "boldFlash"
  | "wave";

/** Animation timing curve. */
export type PptxAnimationTimingCurve =
  | "ease"
  | "ease-in"
  | "ease-out"
  | "linear";

/** Repeat mode for animations. */
export type PptxAnimationRepeatMode = "untilNextClick" | "untilEndOfSlide";

/** Animation trigger type from OOXML `p:cTn`. */
export type PptxAnimationTrigger =
  | "onClick"
  | "onShapeClick"
  | "onHover"
  | "afterPrevious"
  | "withPrevious"
  | "afterDelay";

/**
 * Parsed native animation record from `p:timing / p:tnLst`.
 *
 * Represents a single animation node in the OOXML timing tree,
 * including motion paths, scale transforms, and text build settings.
 *
 * @example
 * ```ts
 * const anim: PptxNativeAnimation = {
 *   targetId: "shape_1",
 *   presetClass: "entr",
 *   presetId: 10,
 *   trigger: "afterPrevious",
 *   durationMs: 500,
 * };
 * // => { targetId: "shape_1", presetClass: "entr", presetId: 10, trigger: "afterPrevious", durationMs: 500 }
 * ```
 */
export interface PptxNativeAnimation {
  /** Target element/shape ID. */
  targetId?: string;
  /** Trigger type. */
  trigger?: PptxAnimationTrigger;
  /** Shape ID that triggers this animation when clicked (interactive sequence). */
  triggerShapeId?: string;
  /** Effect preset class (entr, exit, emph, path). */
  presetClass?: "entr" | "exit" | "emph" | "path";
  /** Effect preset sub-type identifier. */
  presetId?: number;
  /** Duration in milliseconds. */
  durationMs?: number;
  /** Delay in milliseconds. */
  delayMs?: number;
  /** Trigger delay in milliseconds (for afterDelay). */
  triggerDelayMs?: number;
  /** SVG path string for motion path animations (`p:animMotion/@path`). */
  motionPath?: string;
  /** Motion origin: "layout" or "parent". */
  motionOrigin?: string;
  /** Whether the element auto-rotates to follow the motion path tangent (`p:animMotion/@rAng` = "0"). */
  motionPathRotateAuto?: boolean;
  /** Rotation angle in degrees for `p:animRot` (converted from 60000ths). */
  rotationBy?: number;
  /** X scale factor (percentage / 100) for `p:animScale`. */
  scaleByX?: number;
  /** Y scale factor (percentage / 100) for `p:animScale`. */
  scaleByY?: number;
  /** Repeat count (e.g. `2`, `Infinity` for indefinite). */
  repeatCount?: number;
  /** Whether the animation plays in reverse after completion. */
  autoReverse?: boolean;
  /** Text build type from `p:bldP/@build` in `p:bldLst`. */
  buildType?: PptxTextBuildType;
  /** Build level for multi-level lists from `p:bldP/@bldLvl`. */
  buildLevel?: number;
  /** Group ID linking a `p:bldP` entry to its timing animation node. */
  groupId?: string;
  /** Sound relationship ID to play when animation triggers (`p:stSnd`). */
  soundRId?: string;
  /** Resolved sound file path from relationship. */
  soundPath?: string;
  /** Whether to stop any currently playing sound (`p:endSnd`). */
  stopSound?: boolean;
  /** Structured start conditions parsed from `p:stCondLst`. */
  startConditions?: AnimationCondition[];
  /** Structured end conditions parsed from `p:endCondLst`. */
  endConditions?: AnimationCondition[];
  /** Preserved raw `p:endCondLst` XML node for lossless round-trip. */
  rawEndCondLst?: XmlObject;
  /** Color animation data from `p:animClr`. */
  colorAnimation?: PptxColorAnimation;
  /** Text-level target: character range or paragraph range from `p:txEl`. */
  textTarget?: PptxTextAnimationTarget;
  /** Whether this animation is inside an exclusive container (`p:excl`). */
  exclusive?: boolean;
  /** Command type from `p:cmd` (@_type: call/evt/verb). */
  commandType?: string;
  /** Command string from `p:cmd` (@_cmd). */
  commandString?: string;
  /** Iteration configuration from `p:iterate`. */
  iterate?: PptxAnimationIterate;
}

/** Color animation data parsed from `p:animClr`. */
export interface PptxColorAnimation {
  /** Color interpolation space: "hsl" or "rgb". */
  colorSpace: "hsl" | "rgb";
  /** Direction for HSL interpolation: "cw" (clockwise) or "ccw". */
  direction?: "cw" | "ccw";
  /** Starting color as hex string. */
  fromColor?: string;
  /** Ending color as hex string. */
  toColor?: string;
  /** Color delta (for "by" animations) as hex string. */
  byColor?: string;
  /**
   * Target attribute from `p:attrNameLst` (e.g. "fillcolor", "style.color",
   * "stroke.color"). Used to determine which CSS property to animate.
   */
  targetAttribute?: string;
}

/** Text-level animation target from `p:txEl`. */
export interface PptxTextAnimationTarget {
  /** Target type: character range or paragraph range. */
  type: "charRg" | "pRg";
  /** Start index (0-based). */
  start: number;
  /** End index (exclusive). */
  end: number;
}

/**
 * Event types for animation conditions from `p:cond/@evt`.
 *
 * These map directly to OOXML condition event attribute values
 * (ISO/IEC 29500-1 S19.5.28 CT_TLTimeCondition).
 */
export type AnimationConditionEvent =
  | "onBegin"
  | "onEnd"
  | "begin"
  | "end"
  | "onClick"
  | "onMouseOver"
  | "onMouseOut"
  | "onNext"
  | "onPrev"
  | "onStopAudio";

/**
 * Structured representation of a single OOXML animation condition
 * from `p:cond` elements inside `p:stCondLst` or `p:endCondLst`.
 *
 * Conditions control when an animation starts or ends, and can reference
 * events, time delays, and target time node IDs.
 *
 * @example
 * ```ts
 * const cond: AnimationCondition = {
 *   event: "onClick",
 *   delay: 0,
 *   targetShapeId: "shape_5",
 * };
 * ```
 */
export interface AnimationCondition {
  /** Event that triggers the condition. */
  event?: AnimationConditionEvent;
  /** Delay in milliseconds (from `@_delay`). "indefinite" is represented as -1. */
  delay?: number;
  /** Target time node ID reference (from `@_tn`). */
  targetTimeNodeId?: number;
  /** Target shape ID from `p:tgtEl/p:spTgt/@spid`. */
  targetShapeId?: string;
  /** Whether the condition targets a slide (from `p:tgtEl/p:sldTgt`). */
  targetSlide?: boolean;
}

/** Iteration configuration from `p:iterate`. */
export interface PptxAnimationIterate {
  /** Iteration type: el (element), lt (letter), wd (word). */
  type: "el" | "lt" | "wd";
  /** Whether to iterate backwards. */
  backwards?: boolean;
  /** Timing interval (percentage of total duration, in 1000ths). */
  tmPct?: number;
  /** Absolute timing interval in ms. */
  tmAbs?: number;
}

/** Build type for text build (paragraph/word/letter) animations from `p:bldP/@build`. */
export type PptxTextBuildType =
  | "allAtOnce"
  | "byParagraph"
  | "byWord"
  | "byChar";

/** Direction for fly-in / fly-out / wipe effects. */
export type PptxAnimationDirection =
  | "fromLeft"
  | "fromRight"
  | "fromTop"
  | "fromBottom"
  | "fromTopLeft"
  | "fromTopRight"
  | "fromBottomLeft"
  | "fromBottomRight";

/** Sequence mode for paragraph-level animations. */
export type PptxAnimationSequence =
  | "asOne"
  | "byParagraph"
  | "byWord"
  | "byLetter";

/** Behavior after animation finishes. */
export type PptxAfterAnimationAction =
  | "none"
  | "hideOnNextClick"
  | "hideAfterAnimation"
  | "dimToColor";

/**
 * High-level animation data associated with a slide element.
 *
 * Combines entrance, exit, and emphasis presets with timing and
 * trigger configuration. Used by the editor’s animation panel
 * and the `setPptxElementAnimation` tool.
 *
 * @example
 * ```ts
 * const anim: PptxElementAnimation = {
 *   elementId: "title_1",
 *   entrance: "fadeIn",
 *   durationMs: 600,
 *   order: 1,
 *   trigger: "afterPrevious",
 * };
 * // => { elementId: "title_1", entrance: "fadeIn", durationMs: 600, order: 1, trigger: "afterPrevious" }
 * ```
 */
export interface PptxElementAnimation {
  elementId: string;
  entrance?: PptxAnimationPreset;
  exit?: PptxAnimationPreset;
  emphasis?: PptxAnimationPreset;
  durationMs?: number;
  delayMs?: number;
  order?: number;
  trigger?: PptxAnimationTrigger;
  /** Shape ID that triggers this animation when clicked (interactive sequence). */
  triggerShapeId?: string;
  timingCurve?: PptxAnimationTimingCurve;
  repeatCount?: number;
  repeatMode?: PptxAnimationRepeatMode;
  /** Direction for directional effects (fly in/out, wipe, etc.). */
  direction?: PptxAnimationDirection;
  /** Sequence mode — animate as one object or by paragraph/word/letter. */
  sequence?: PptxAnimationSequence;
  /** What happens after the animation finishes playing. */
  afterAnimation?: PptxAfterAnimationAction;
  /** Dim-to color hex (used when afterAnimation is "dimToColor"). */
  afterAnimationColor?: string;
  /** SVG motion path string for custom motion path animations. */
  motionPath?: string;
  /** Sound relationship ID to play when animation triggers (`p:stSnd`). */
  soundRId?: string;
  /** Resolved sound file path from relationship. */
  soundPath?: string;
  /** Whether to stop any currently playing sound (`p:endSnd`). */
  stopSound?: boolean;
}
