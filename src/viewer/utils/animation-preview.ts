/**
 * Animation Preview Engine
 *
 * Provides utilities for previewing animation effects on canvas elements.
 * When hovering over an animation in the panel, a short CSS animation is
 * applied to the target element in the canvas.
 */

import type {
  PptxAnimationPreset,
  PptxAnimationDirection,
  PptxAnimationTimingCurve,
} from "../../core";
import { getEffectKeyframes } from "./animation";

// ==========================================================================
// Preview keyframes generation
// ==========================================================================

/** Map editor-level animation presets to the internal effect names used by
 *  the keyframe definition table in `animation.ts`. */
const PRESET_TO_EFFECT: Record<string, string> = {
  fadeIn: "fadeIn",
  flyIn: "flyInBottom",
  zoomIn: "zoomIn",
  fadeOut: "fadeOut",
  flyOut: "flyOutBottom",
  zoomOut: "zoomOut",
  spin: "spin",
  pulse: "pulse",
  colorWave: "colorWave",
  bounce: "bounce",
  flash: "flash",
};

/** Direction-aware fly-in/out effect name overrides. */
const DIRECTION_FLY_MAP: Partial<
  Record<PptxAnimationDirection, { flyIn: string; flyOut: string }>
> = {
  fromLeft: { flyIn: "flyInLeft", flyOut: "flyOutLeft" },
  fromRight: { flyIn: "flyInRight", flyOut: "flyOutRight" },
  fromTop: { flyIn: "flyInTop", flyOut: "flyOutTop" },
  fromBottom: { flyIn: "flyInBottom", flyOut: "flyOutBottom" },
  fromTopLeft: { flyIn: "flyInTop", flyOut: "flyOutTop" },
  fromTopRight: { flyIn: "flyInTop", flyOut: "flyOutTop" },
  fromBottomLeft: { flyIn: "flyInBottom", flyOut: "flyOutBottom" },
  fromBottomRight: { flyIn: "flyInBottom", flyOut: "flyOutBottom" },
};

/**
 * Resolve the CSS @keyframes effect name for a given preset and direction.
 */
function resolvePreviewEffect(
  preset: PptxAnimationPreset,
  direction?: PptxAnimationDirection,
): string | undefined {
  if ((preset === "flyIn" || preset === "flyOut") && direction) {
    const dirMap = DIRECTION_FLY_MAP[direction];
    if (dirMap) {
      return preset === "flyIn" ? dirMap.flyIn : dirMap.flyOut;
    }
  }
  return PRESET_TO_EFFECT[preset];
}

/**
 * Map a timing curve name to a CSS easing string.
 * Supports the standard OOXML timing curves plus cubic-bezier extraction.
 */
export function timingCurveToCss(
  curve?: PptxAnimationTimingCurve,
  cubicBezierValues?: string,
): string {
  if (cubicBezierValues) {
    // Validate cubic-bezier format: "x1,y1,x2,y2"
    const parts = cubicBezierValues.split(",").map((s) => s.trim());
    if (parts.length === 4 && parts.every((p) => !Number.isNaN(Number(p)))) {
      return `cubic-bezier(${parts.join(", ")})`;
    }
  }
  switch (curve) {
    case "ease":
      return "ease";
    case "ease-in":
      return "ease-in";
    case "ease-out":
      return "ease-out";
    case "linear":
      return "linear";
    default:
      return "ease";
  }
}

// ==========================================================================
// Preview animation descriptor
// ==========================================================================

export interface AnimationPreviewDescriptor {
  /** CSS @keyframes name. */
  keyframeName: string;
  /** Full CSS @keyframes definition block. */
  keyframesCss: string;
  /** CSS animation shorthand value to apply. */
  cssAnimation: string;
  /** Duration in ms. */
  durationMs: number;
}

/**
 * Build a preview animation descriptor for a given preset.
 *
 * Returns `undefined` if the preset doesn't have a known effect.
 */
export function buildPreviewAnimation(
  preset: PptxAnimationPreset,
  options?: {
    direction?: PptxAnimationDirection;
    durationMs?: number;
    timingCurve?: PptxAnimationTimingCurve;
    cubicBezier?: string;
  },
): AnimationPreviewDescriptor | undefined {
  if (preset === "none") return undefined;

  const effectName = resolvePreviewEffect(preset, options?.direction);
  if (!effectName) return undefined;

  const keyframeName = `fuzor-${effectName}`;
  const keyframesCss = getEffectKeyframes(
    effectName as Parameters<typeof getEffectKeyframes>[0],
  );
  if (!keyframesCss) return undefined;

  const duration = options?.durationMs ?? 600;
  const easing = timingCurveToCss(options?.timingCurve, options?.cubicBezier);

  return {
    keyframeName,
    keyframesCss,
    cssAnimation: `${keyframeName} ${duration}ms ${easing} 0ms 1 normal both`,
    durationMs: duration,
  };
}

// ==========================================================================
// DOM-based preview player
// ==========================================================================

/** Tracks an active preview so it can be cancelled. */
interface ActivePreview {
  elementId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  styleEl: HTMLStyleElement;
  originalAnimation: string;
  originalVisibility: string;
}

let activePreview: ActivePreview | null = null;

/**
 * Start a preview animation on a specific element in the canvas.
 *
 * If a preview is already playing, it is cancelled first.
 * The preview automatically cleans up after the animation completes.
 */
export function startPreviewAnimation(
  elementId: string,
  preset: PptxAnimationPreset,
  options?: {
    direction?: PptxAnimationDirection;
    durationMs?: number;
    timingCurve?: PptxAnimationTimingCurve;
    cubicBezier?: string;
  },
): void {
  // Cancel any existing preview
  stopPreviewAnimation();

  const descriptor = buildPreviewAnimation(preset, options);
  if (!descriptor) return;

  // Find the DOM element
  const domEl = document.querySelector(
    `[data-element-id="${elementId}"]`,
  ) as HTMLElement | null;
  if (!domEl) return;

  // Inject keyframes
  const styleEl = document.createElement("style");
  styleEl.textContent = descriptor.keyframesCss;
  document.head.appendChild(styleEl);

  // Store original state
  const originalAnimation = domEl.style.animation;
  const originalVisibility = domEl.style.visibility;

  // Apply preview animation
  domEl.style.visibility = "visible";
  domEl.style.animation = descriptor.cssAnimation;

  // Schedule cleanup
  const timeoutId = setTimeout(() => {
    domEl.style.animation = originalAnimation;
    domEl.style.visibility = originalVisibility;
    styleEl.remove();
    if (activePreview?.elementId === elementId) {
      activePreview = null;
    }
  }, descriptor.durationMs + 100);

  activePreview = {
    elementId,
    timeoutId,
    styleEl,
    originalAnimation,
    originalVisibility,
  };
}

/**
 * Stop any currently playing preview animation and restore original state.
 */
export function stopPreviewAnimation(): void {
  if (!activePreview) return;

  clearTimeout(activePreview.timeoutId);
  activePreview.styleEl.remove();

  const domEl = document.querySelector(
    `[data-element-id="${activePreview.elementId}"]`,
  ) as HTMLElement | null;
  if (domEl) {
    domEl.style.animation = activePreview.originalAnimation;
    domEl.style.visibility = activePreview.originalVisibility;
  }

  activePreview = null;
}

// ==========================================================================
// Timing curve extraction from OOXML bezier values
// ==========================================================================

/**
 * Parse OOXML timing curve bezier values from `a:cTn/a:timing/a:curve`.
 *
 * OOXML stores bezier control points as attributes:
 * - `x1`, `y1` — first control point (0..100000 range)
 * - `x2`, `y2` — second control point (0..100000 range)
 *
 * Returns a CSS `cubic-bezier()` string, or undefined if not parseable.
 */
export function parseOoxmlBezierCurve(
  x1: number | undefined,
  y1: number | undefined,
  x2: number | undefined,
  y2: number | undefined,
): string | undefined {
  if (
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined
  ) {
    return undefined;
  }

  // OOXML values are in 0..100000 range, CSS cubic-bezier uses 0..1
  const cx1 = Math.max(0, Math.min(1, x1 / 100000));
  const cy1 = y1 / 100000; // y can exceed 0..1 range for overshoot
  const cx2 = Math.max(0, Math.min(1, x2 / 100000));
  const cy2 = y2 / 100000;

  return `${cx1.toFixed(4)},${cy1.toFixed(4)},${cx2.toFixed(4)},${cy2.toFixed(4)}`;
}
