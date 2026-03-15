import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTouchDistance,
  clampScale,
  SWIPE_THRESHOLD_PX,
  SWIPE_MAX_VERTICAL_PX,
  LONG_PRESS_DURATION_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
} from "./useTouchGestures";

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("getTouchDistance", () => {
  function makeTouch(clientX: number, clientY: number): Touch {
    return { clientX, clientY } as Touch;
  }

  it("returns 0 when both touches are at the same point", () => {
    expect(getTouchDistance(makeTouch(100, 100), makeTouch(100, 100))).toBe(0);
  });

  it("computes horizontal distance correctly", () => {
    expect(getTouchDistance(makeTouch(0, 0), makeTouch(100, 0))).toBe(100);
  });

  it("computes vertical distance correctly", () => {
    expect(getTouchDistance(makeTouch(0, 0), makeTouch(0, 50))).toBe(50);
  });

  it("computes diagonal distance (3-4-5 triangle)", () => {
    expect(getTouchDistance(makeTouch(0, 0), makeTouch(3, 4))).toBe(5);
  });

  it("is symmetric (order of touches does not matter)", () => {
    const t1 = makeTouch(10, 20);
    const t2 = makeTouch(30, 40);
    expect(getTouchDistance(t1, t2)).toBeCloseTo(
      getTouchDistance(t2, t1),
      10,
    );
  });

  it("handles negative coordinates", () => {
    const d = getTouchDistance(makeTouch(-10, -10), makeTouch(10, 10));
    const expected = Math.sqrt(20 * 20 + 20 * 20);
    expect(d).toBeCloseTo(expected, 5);
  });
});

describe("clampScale", () => {
  it("returns value when within range", () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
  });

  it("clamps below minimum to MIN_ZOOM_SCALE (0.2)", () => {
    expect(clampScale(0.1)).toBe(0.2);
    expect(clampScale(-1)).toBe(0.2);
    expect(clampScale(0)).toBe(0.2);
  });

  it("clamps above maximum to MAX_ZOOM_SCALE (5)", () => {
    expect(clampScale(6)).toBe(5);
    expect(clampScale(100)).toBe(5);
  });

  it("returns boundary values exactly", () => {
    expect(clampScale(0.2)).toBe(0.2);
    expect(clampScale(5)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Constant tests
// ---------------------------------------------------------------------------

describe("gesture constants", () => {
  it("SWIPE_THRESHOLD_PX is a positive number", () => {
    expect(SWIPE_THRESHOLD_PX).toBeGreaterThan(0);
    expect(typeof SWIPE_THRESHOLD_PX).toBe("number");
  });

  it("SWIPE_MAX_VERTICAL_PX is a positive number", () => {
    expect(SWIPE_MAX_VERTICAL_PX).toBeGreaterThan(0);
  });

  it("LONG_PRESS_DURATION_MS is 500ms", () => {
    expect(LONG_PRESS_DURATION_MS).toBe(500);
  });

  it("LONG_PRESS_MOVE_TOLERANCE_PX is 10px", () => {
    expect(LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Swipe detection logic tests (extracted algorithm)
// ---------------------------------------------------------------------------

describe("swipe detection logic", () => {
  function detectSwipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): -1 | 1 | null {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    if (
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaY) < SWIPE_MAX_VERTICAL_PX
    ) {
      return deltaX > 0 ? 1 : -1;
    }
    return null;
  }

  it("detects a rightward swipe", () => {
    expect(detectSwipe(100, 200, 200, 200)).toBe(1);
  });

  it("detects a leftward swipe", () => {
    expect(detectSwipe(200, 200, 100, 200)).toBe(-1);
  });

  it("rejects a swipe that is too short", () => {
    expect(detectSwipe(100, 200, 130, 200)).toBeNull();
  });

  it("rejects a swipe with too much vertical movement", () => {
    expect(detectSwipe(100, 200, 200, 400)).toBeNull();
  });

  it("accepts diagonal swipe within vertical tolerance", () => {
    // 60px horizontal, 30px vertical — within tolerance
    expect(detectSwipe(100, 200, 160, 230)).toBe(1);
  });

  it("exact threshold values — at threshold is accepted", () => {
    // deltaX = exactly SWIPE_THRESHOLD_PX
    expect(detectSwipe(0, 0, SWIPE_THRESHOLD_PX, 0)).toBe(1);
  });

  it("exact threshold values — just below threshold is rejected", () => {
    expect(detectSwipe(0, 0, SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
  });

  it("vertical at threshold — exactly at max vertical is rejected", () => {
    // deltaY = exactly SWIPE_MAX_VERTICAL_PX → not less than, so rejected
    expect(
      detectSwipe(0, 0, SWIPE_THRESHOLD_PX, SWIPE_MAX_VERTICAL_PX),
    ).toBeNull();
  });

  it("vertical just below threshold is accepted", () => {
    expect(
      detectSwipe(0, 0, SWIPE_THRESHOLD_PX, SWIPE_MAX_VERTICAL_PX - 1),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pinch zoom ratio logic tests
// ---------------------------------------------------------------------------

describe("pinch zoom ratio logic", () => {
  function computePinchScale(
    initialDistance: number,
    currentDistance: number,
    baseScale: number,
  ): number {
    if (initialDistance <= 0) return baseScale;
    const ratio = currentDistance / initialDistance;
    return clampScale(baseScale * ratio);
  }

  it("no change when distance is unchanged", () => {
    expect(computePinchScale(100, 100, 1)).toBe(1);
  });

  it("doubles scale when distance doubles", () => {
    expect(computePinchScale(100, 200, 1)).toBe(2);
  });

  it("halves scale when distance halves", () => {
    expect(computePinchScale(100, 50, 1)).toBe(0.5);
  });

  it("respects base scale", () => {
    expect(computePinchScale(100, 200, 1.5)).toBe(3);
  });

  it("clamps to minimum", () => {
    expect(computePinchScale(100, 10, 1)).toBe(0.2); // 1 * 0.1 = 0.1 → clamped to 0.2
  });

  it("clamps to maximum", () => {
    expect(computePinchScale(100, 1000, 1)).toBe(5); // 1 * 10 = 10 → clamped to 5
  });

  it("handles zero initial distance gracefully", () => {
    expect(computePinchScale(0, 100, 1.5)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Long-press cancellation logic tests
// ---------------------------------------------------------------------------

describe("long-press movement cancellation", () => {
  function shouldCancelLongPress(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
  ): boolean {
    const dx = currentX - startX;
    const dy = currentY - startY;
    return (
      Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX ||
      Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX
    );
  }

  it("no cancellation when finger stays still", () => {
    expect(shouldCancelLongPress(100, 100, 100, 100)).toBe(false);
  });

  it("no cancellation within tolerance", () => {
    expect(shouldCancelLongPress(100, 100, 105, 105)).toBe(false);
  });

  it("cancels when finger moves beyond tolerance horizontally", () => {
    expect(shouldCancelLongPress(100, 100, 111, 100)).toBe(true);
  });

  it("cancels when finger moves beyond tolerance vertically", () => {
    expect(shouldCancelLongPress(100, 100, 100, 111)).toBe(true);
  });

  it("exactly at tolerance is not cancelled", () => {
    expect(
      shouldCancelLongPress(
        100,
        100,
        100 + LONG_PRESS_MOVE_TOLERANCE_PX,
        100,
      ),
    ).toBe(false);
  });

  it("just beyond tolerance is cancelled", () => {
    expect(
      shouldCancelLongPress(
        100,
        100,
        100 + LONG_PRESS_MOVE_TOLERANCE_PX + 1,
        100,
      ),
    ).toBe(true);
  });
});
