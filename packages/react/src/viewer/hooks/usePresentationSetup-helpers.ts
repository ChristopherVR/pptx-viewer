/**
 * Pure helper functions extracted from usePresentationSetup for testability.
 */
import type { PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Loop-continuously determination
// ---------------------------------------------------------------------------

export interface PresentationLoopInput {
  loopContinuously?: boolean;
  showType?: string;
}

/**
 * Determine whether the presentation should loop continuously.
 * True when `loopContinuously` is truthy OR showType is "kiosk".
 */
export function shouldLoopContinuously(input: PresentationLoopInput): boolean {
  return Boolean(input.loopContinuously) || input.showType === "kiosk";
}

// ---------------------------------------------------------------------------
// Rehearsal timing application
// ---------------------------------------------------------------------------

/**
 * Apply recorded rehearsal timings (slideIndex -> ms) to slides,
 * setting each slide's `transition.advanceAfterMs` to the recorded value.
 * Preserves existing transition type or defaults to "none".
 * Returns a new array (immutable).
 */
export function applyRehearsalTimings(
  slides: PptxSlide[],
  timings: Record<number, number>,
): PptxSlide[] {
  return slides.map((slide, idx) => {
    const ms = timings[idx];
    if (typeof ms !== "number") return slide;
    return {
      ...slide,
      transition: {
        ...slide.transition,
        type: slide.transition?.type ?? "none",
        advanceAfterMs: ms,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Entrance animation sorting
// ---------------------------------------------------------------------------

export interface AnimationEntry {
  entrance?: boolean;
  order?: number;
  elementId: string;
  delayMs?: number;
  [key: string]: unknown;
}

/**
 * Filter and sort entrance animations from a slide's animation array.
 * Entrance animations are those with `entrance === true`,
 * sorted by `order` ascending (with undefined/missing order pushed to end).
 */
export function sortEntranceAnimations(
  animations: AnimationEntry[],
): AnimationEntry[] {
  return [...animations]
    .filter((a) => Boolean(a.entrance))
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    );
}

/**
 * Compute the delay for an entrance animation at a given index.
 * Formula: max(0, delayMs) + index * 60
 */
export function computeEntranceAnimationDelay(
  delayMs: number | undefined,
  animationIndex: number,
): number {
  return Math.max(0, delayMs || 0) + animationIndex * 60;
}
