import { describe, it, expect } from "vitest";
import {
  shouldLoopContinuously,
  applyRehearsalTimings,
  sortEntranceAnimations,
  computeEntranceAnimationDelay,
  type AnimationEntry,
} from "./usePresentationSetup-helpers";
import type { PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(
  id: string,
  transition?: { type: string; advanceAfterMs?: number },
): PptxSlide {
  return {
    id,
    rId: `rId-${id}`,
    slideNumber: 1,
    elements: [],
    transition,
  } as unknown as PptxSlide;
}

// ---------------------------------------------------------------------------
// shouldLoopContinuously
// ---------------------------------------------------------------------------

describe("shouldLoopContinuously", () => {
  it("returns false when both loopContinuously is falsy and showType is not kiosk", () => {
    expect(shouldLoopContinuously({})).toBe(false);
  });

  it("returns true when loopContinuously is true", () => {
    expect(shouldLoopContinuously({ loopContinuously: true })).toBe(true);
  });

  it("returns true when showType is kiosk", () => {
    expect(shouldLoopContinuously({ showType: "kiosk" })).toBe(true);
  });

  it("returns true when both loopContinuously and kiosk", () => {
    expect(
      shouldLoopContinuously({ loopContinuously: true, showType: "kiosk" }),
    ).toBe(true);
  });

  it("returns false when showType is browsed", () => {
    expect(shouldLoopContinuously({ showType: "browsed" })).toBe(false);
  });

  it("returns false when loopContinuously is explicitly false", () => {
    expect(shouldLoopContinuously({ loopContinuously: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyRehearsalTimings
// ---------------------------------------------------------------------------

describe("applyRehearsalTimings", () => {
  it("sets advanceAfterMs for slides with recorded timings", () => {
    const slides = [makeSlide("s1"), makeSlide("s2"), makeSlide("s3")];
    const timings = { 0: 5000, 2: 8000 };
    const result = applyRehearsalTimings(slides, timings);
    expect(result[0].transition?.advanceAfterMs).toBe(5000);
    expect(result[1].transition).toBeUndefined();
    expect(result[2].transition?.advanceAfterMs).toBe(8000);
  });

  it("preserves existing transition type", () => {
    const slides = [makeSlide("s1", { type: "fade", advanceAfterMs: 1000 })];
    const timings = { 0: 3000 };
    const result = applyRehearsalTimings(slides, timings);
    expect(result[0].transition?.type).toBe("fade");
    expect(result[0].transition?.advanceAfterMs).toBe(3000);
  });

  it("defaults transition type to 'none' when no transition exists", () => {
    const slides = [makeSlide("s1")];
    const timings = { 0: 2000 };
    const result = applyRehearsalTimings(slides, timings);
    expect(result[0].transition?.type).toBe("none");
  });

  it("does not mutate the original slides array", () => {
    const slides = [makeSlide("s1")];
    const timings = { 0: 5000 };
    applyRehearsalTimings(slides, timings);
    expect(slides[0].transition).toBeUndefined();
  });

  it("returns same slide references for slides without timings", () => {
    const slides = [makeSlide("s1"), makeSlide("s2")];
    const timings = { 0: 1000 };
    const result = applyRehearsalTimings(slides, timings);
    expect(result[1]).toBe(slides[1]);
  });

  it("handles empty timings object", () => {
    const slides = [makeSlide("s1"), makeSlide("s2")];
    const result = applyRehearsalTimings(slides, {});
    expect(result[0]).toBe(slides[0]);
    expect(result[1]).toBe(slides[1]);
  });

  it("handles empty slides array", () => {
    const result = applyRehearsalTimings([], { 0: 1000 });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sortEntranceAnimations
// ---------------------------------------------------------------------------

describe("sortEntranceAnimations", () => {
  it("filters out non-entrance animations", () => {
    const animations: AnimationEntry[] = [
      { elementId: "e1", entrance: true, order: 1 },
      { elementId: "e2", entrance: false, order: 2 },
      { elementId: "e3", order: 3 },
    ];
    const result = sortEntranceAnimations(animations);
    expect(result).toHaveLength(1);
    expect(result[0].elementId).toBe("e1");
  });

  it("sorts by order ascending", () => {
    const animations: AnimationEntry[] = [
      { elementId: "e3", entrance: true, order: 3 },
      { elementId: "e1", entrance: true, order: 1 },
      { elementId: "e2", entrance: true, order: 2 },
    ];
    const result = sortEntranceAnimations(animations);
    expect(result.map((a) => a.elementId)).toEqual(["e1", "e2", "e3"]);
  });

  it("pushes animations without order to the end", () => {
    const animations: AnimationEntry[] = [
      { elementId: "e2", entrance: true },
      { elementId: "e1", entrance: true, order: 1 },
    ];
    const result = sortEntranceAnimations(animations);
    expect(result[0].elementId).toBe("e1");
    expect(result[1].elementId).toBe("e2");
  });

  it("does not mutate the original array", () => {
    const animations: AnimationEntry[] = [
      { elementId: "e2", entrance: true, order: 2 },
      { elementId: "e1", entrance: true, order: 1 },
    ];
    sortEntranceAnimations(animations);
    expect(animations[0].elementId).toBe("e2");
  });

  it("returns empty array when no entrance animations exist", () => {
    const animations: AnimationEntry[] = [
      { elementId: "e1", entrance: false },
    ];
    expect(sortEntranceAnimations(animations)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(sortEntranceAnimations([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeEntranceAnimationDelay
// ---------------------------------------------------------------------------

describe("computeEntranceAnimationDelay", () => {
  it("adds index * 60 to delayMs", () => {
    expect(computeEntranceAnimationDelay(100, 0)).toBe(100);
    expect(computeEntranceAnimationDelay(100, 1)).toBe(160);
    expect(computeEntranceAnimationDelay(100, 2)).toBe(220);
  });

  it("clamps negative delayMs to 0", () => {
    expect(computeEntranceAnimationDelay(-50, 0)).toBe(0);
    expect(computeEntranceAnimationDelay(-50, 1)).toBe(60);
  });

  it("treats undefined delayMs as 0", () => {
    expect(computeEntranceAnimationDelay(undefined, 0)).toBe(0);
    expect(computeEntranceAnimationDelay(undefined, 3)).toBe(180);
  });

  it("returns 0 for index 0 and delayMs 0", () => {
    expect(computeEntranceAnimationDelay(0, 0)).toBe(0);
  });

  it("handles large index values", () => {
    expect(computeEntranceAnimationDelay(0, 100)).toBe(6000);
  });
});
