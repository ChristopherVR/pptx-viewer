import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic extracted from useSlideNavigation for testing.
// These mirror the navigation calculations inside movePresentationSlide.
// ---------------------------------------------------------------------------

/**
 * Determine available slide indexes (visible or all).
 */
function resolveAvailableIndexes(
  visibleSlideIndexes: number[],
  totalSlideCount: number,
): number[] {
  return visibleSlideIndexes.length > 0
    ? visibleSlideIndexes
    : Array.from({ length: totalSlideCount }, (_, i) => i);
}

/**
 * Compute the next slide position given the current state.
 * Returns the resolved slide index, or null if navigation should be skipped.
 */
function computeNextSlidePosition(
  availableSlideIndexes: number[],
  presentationSlideIndex: number,
  direction: 1 | -1,
  options: {
    loopContinuously?: boolean;
    rehearsing?: boolean;
  } = {},
): {
  nextSlideIndex: number | null;
  endRehearsal: boolean;
} {
  if (availableSlideIndexes.length === 0) {
    return { nextSlideIndex: null, endRehearsal: false };
  }

  const currentVisiblePosition =
    availableSlideIndexes.indexOf(presentationSlideIndex);
  const normalizedCurrentPosition =
    currentVisiblePosition >= 0 ? currentVisiblePosition : 0;
  const nextPosition = normalizedCurrentPosition + direction;

  // Rehearsal: advancing past last slide ends rehearsal
  if (
    options.rehearsing &&
    direction === 1 &&
    nextPosition >= availableSlideIndexes.length
  ) {
    return { nextSlideIndex: null, endRehearsal: true };
  }

  // Loop wrap
  let resolvedPosition: number;
  if (
    options.loopContinuously &&
    !options.rehearsing &&
    direction === 1 &&
    nextPosition >= availableSlideIndexes.length
  ) {
    resolvedPosition = 0;
  } else {
    resolvedPosition = Math.min(
      availableSlideIndexes.length - 1,
      Math.max(0, nextPosition),
    );
  }

  const nextSlideIndex = availableSlideIndexes[resolvedPosition];
  if (
    nextSlideIndex === undefined ||
    nextSlideIndex === presentationSlideIndex
  ) {
    return { nextSlideIndex: null, endRehearsal: false };
  }

  return { nextSlideIndex, endRehearsal: false };
}

/**
 * Validate whether direct navigation to a target index is valid.
 */
function isValidNavigationTarget(
  targetIndex: number,
  slidesLength: number,
  currentIndex: number,
): boolean {
  return (
    targetIndex >= 0 &&
    targetIndex < slidesLength &&
    targetIndex !== currentIndex
  );
}

/**
 * Determine if auto-advance should be scheduled.
 */
function shouldScheduleAutoAdvance(
  advanceAfterMs: number | undefined | null,
): boolean {
  return (
    typeof advanceAfterMs === "number" &&
    Number.isFinite(advanceAfterMs) &&
    advanceAfterMs >= 0
  );
}

// ---------------------------------------------------------------------------
// Tests: resolveAvailableIndexes
// ---------------------------------------------------------------------------

describe("resolveAvailableIndexes", () => {
  it("should return visible indexes when provided", () => {
    const result = resolveAvailableIndexes([0, 2, 4], 5);
    expect(result).toEqual([0, 2, 4]);
  });

  it("should return all indexes when visible is empty", () => {
    const result = resolveAvailableIndexes([], 5);
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("should return empty for zero slides", () => {
    const result = resolveAvailableIndexes([], 0);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeNextSlidePosition
// ---------------------------------------------------------------------------

describe("computeNextSlidePosition", () => {
  const allIndexes = [0, 1, 2, 3, 4];

  it("should advance to next slide", () => {
    const result = computeNextSlidePosition(allIndexes, 2, 1);
    expect(result.nextSlideIndex).toBe(3);
    expect(result.endRehearsal).toBe(false);
  });

  it("should go to previous slide", () => {
    const result = computeNextSlidePosition(allIndexes, 2, -1);
    expect(result.nextSlideIndex).toBe(1);
    expect(result.endRehearsal).toBe(false);
  });

  it("should clamp at the last slide when no loop", () => {
    const result = computeNextSlidePosition(allIndexes, 4, 1);
    expect(result.nextSlideIndex).toBe(null); // same as current, so null
  });

  it("should clamp at the first slide going backward", () => {
    const result = computeNextSlidePosition(allIndexes, 0, -1);
    expect(result.nextSlideIndex).toBe(null); // same as current
  });

  it("should wrap around with loopContinuously", () => {
    const result = computeNextSlidePosition(allIndexes, 4, 1, {
      loopContinuously: true,
    });
    expect(result.nextSlideIndex).toBe(0);
  });

  it("should not wrap when direction is backward even with loop", () => {
    const result = computeNextSlidePosition(allIndexes, 0, -1, {
      loopContinuously: true,
    });
    expect(result.nextSlideIndex).toBe(null);
  });

  it("should end rehearsal when advancing past last slide", () => {
    const result = computeNextSlidePosition(allIndexes, 4, 1, {
      rehearsing: true,
    });
    expect(result.nextSlideIndex).toBe(null);
    expect(result.endRehearsal).toBe(true);
  });

  it("should not end rehearsal when going backward", () => {
    const result = computeNextSlidePosition(allIndexes, 0, -1, {
      rehearsing: true,
    });
    expect(result.endRehearsal).toBe(false);
  });

  it("should return null for empty available indexes", () => {
    const result = computeNextSlidePosition([], 0, 1);
    expect(result.nextSlideIndex).toBe(null);
  });

  it("should handle non-sequential visible indexes", () => {
    const visible = [0, 3, 7]; // slides 0, 3, 7 are visible
    const result = computeNextSlidePosition(visible, 3, 1);
    expect(result.nextSlideIndex).toBe(7);
  });

  it("should handle current index not in available list", () => {
    const visible = [0, 3, 7];
    // presentationSlideIndex=5 is not in the list, normalized to position 0
    const result = computeNextSlidePosition(visible, 5, 1);
    expect(result.nextSlideIndex).toBe(3); // position 0 + 1 = position 1 = index 3
  });

  it("should not loop in rehearsal mode", () => {
    const result = computeNextSlidePosition(allIndexes, 4, 1, {
      rehearsing: true,
      loopContinuously: true,
    });
    // rehearsing takes priority: should end rehearsal, not loop
    expect(result.endRehearsal).toBe(true);
    expect(result.nextSlideIndex).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Tests: isValidNavigationTarget
// ---------------------------------------------------------------------------

describe("isValidNavigationTarget", () => {
  it("should return true for valid different index", () => {
    expect(isValidNavigationTarget(3, 10, 5)).toBe(true);
  });

  it("should return false for negative index", () => {
    expect(isValidNavigationTarget(-1, 10, 5)).toBe(false);
  });

  it("should return false for index beyond slides", () => {
    expect(isValidNavigationTarget(10, 10, 5)).toBe(false);
  });

  it("should return false for same index as current", () => {
    expect(isValidNavigationTarget(5, 10, 5)).toBe(false);
  });

  it("should return true for first slide", () => {
    expect(isValidNavigationTarget(0, 10, 5)).toBe(true);
  });

  it("should return true for last slide", () => {
    expect(isValidNavigationTarget(9, 10, 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: shouldScheduleAutoAdvance
// ---------------------------------------------------------------------------

describe("shouldScheduleAutoAdvance", () => {
  it("should return true for positive number", () => {
    expect(shouldScheduleAutoAdvance(5000)).toBe(true);
  });

  it("should return true for zero", () => {
    expect(shouldScheduleAutoAdvance(0)).toBe(true);
  });

  it("should return false for undefined", () => {
    expect(shouldScheduleAutoAdvance(undefined)).toBe(false);
  });

  it("should return false for null", () => {
    expect(shouldScheduleAutoAdvance(null)).toBe(false);
  });

  it("should return false for NaN", () => {
    expect(shouldScheduleAutoAdvance(NaN)).toBe(false);
  });

  it("should return false for Infinity", () => {
    expect(shouldScheduleAutoAdvance(Infinity)).toBe(false);
  });

  it("should return false for negative number", () => {
    expect(shouldScheduleAutoAdvance(-100)).toBe(false);
  });
});
