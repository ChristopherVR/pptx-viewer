import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic extracted from useRehearsalTimings for testing.
// ---------------------------------------------------------------------------

/**
 * Compute the elapsed time for a slide, accounting for paused time.
 * Mirrors the calculation in recordCurrentSlideTime.
 */
function computeElapsedTime(
  slideStartTime: number,
  now: number,
  pauseAccumulated: number,
  pauseStartTime: number | null,
): number {
  let pausedMs = pauseAccumulated;
  if (pauseStartTime !== null) {
    pausedMs += now - pauseStartTime;
  }
  const elapsed = now - slideStartTime - pausedMs;
  return Math.max(0, elapsed);
}

/**
 * Merge recorded timing for a slide index into existing timings.
 */
function mergeRecordedTiming(
  existing: Record<number, number>,
  slideIdx: number,
  elapsedMs: number,
): Record<number, number> {
  return { ...existing, [slideIdx]: elapsedMs };
}

/**
 * Compute pause state after toggling.
 * Returns the new pauseAccumulated and pauseStart values.
 */
function togglePauseState(
  currentlyPaused: boolean,
  pauseAccumulated: number,
  pauseStartTime: number | null,
  now: number,
): { pauseAccumulated: number; pauseStartTime: number | null; paused: boolean } {
  if (currentlyPaused) {
    // Resuming: accumulate paused time
    let newAccumulated = pauseAccumulated;
    if (pauseStartTime !== null) {
      newAccumulated += now - pauseStartTime;
    }
    return {
      pauseAccumulated: newAccumulated,
      pauseStartTime: null,
      paused: false,
    };
  } else {
    // Pausing: mark start of pause
    return {
      pauseAccumulated,
      pauseStartTime: now,
      paused: true,
    };
  }
}

/**
 * Compute the next per-slide timer state after recording a slide.
 * After recording, the pause accumulator resets and a new slideStartTime
 * is set.
 */
function computeResetTimerState(
  rehearsalPaused: boolean,
  now: number,
): { pauseAccumulated: number; pauseStartTime: number | null; slideStartTime: number } {
  return {
    pauseAccumulated: 0,
    pauseStartTime: rehearsalPaused ? now : null,
    slideStartTime: now,
  };
}

/**
 * Format elapsed milliseconds as "M:SS" for display.
 * This is a common operation for rehearsal timings.
 */
function formatTimingDisplay(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Tests: computeElapsedTime
// ---------------------------------------------------------------------------

describe("computeElapsedTime", () => {
  it("should compute simple elapsed time without pauses", () => {
    // start=1000, now=6000 => 5000ms elapsed
    expect(computeElapsedTime(1000, 6000, 0, null)).toBe(5000);
  });

  it("should subtract accumulated pause time", () => {
    // start=1000, now=6000, pauseAccumulated=2000 => 3000ms
    expect(computeElapsedTime(1000, 6000, 2000, null)).toBe(3000);
  });

  it("should account for currently active pause", () => {
    // start=1000, now=6000, pauseAccumulated=1000, pauseStart=4000
    // pausedMs = 1000 + (6000 - 4000) = 3000
    // elapsed = 6000 - 1000 - 3000 = 2000
    expect(computeElapsedTime(1000, 6000, 1000, 4000)).toBe(2000);
  });

  it("should return 0 when pause exceeds elapsed time", () => {
    // start=1000, now=2000, pauseAccumulated=5000 => would be -4000, clamped to 0
    expect(computeElapsedTime(1000, 2000, 5000, null)).toBe(0);
  });

  it("should return 0 for zero elapsed time", () => {
    expect(computeElapsedTime(1000, 1000, 0, null)).toBe(0);
  });

  it("should handle only active pause (no accumulated)", () => {
    // start=1000, now=5000, pauseAccumulated=0, pauseStart=3000
    // pausedMs = 0 + (5000 - 3000) = 2000
    // elapsed = 5000 - 1000 - 2000 = 2000
    expect(computeElapsedTime(1000, 5000, 0, 3000)).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Tests: mergeRecordedTiming
// ---------------------------------------------------------------------------

describe("mergeRecordedTiming", () => {
  it("should add a new timing entry", () => {
    const result = mergeRecordedTiming({}, 0, 5000);
    expect(result).toEqual({ 0: 5000 });
  });

  it("should overwrite existing timing for the same slide", () => {
    const result = mergeRecordedTiming({ 0: 3000 }, 0, 5000);
    expect(result).toEqual({ 0: 5000 });
  });

  it("should preserve other timings", () => {
    const result = mergeRecordedTiming({ 0: 3000, 1: 4000 }, 2, 5000);
    expect(result).toEqual({ 0: 3000, 1: 4000, 2: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: togglePauseState
// ---------------------------------------------------------------------------

describe("togglePauseState", () => {
  it("should start pausing when currently not paused", () => {
    const result = togglePauseState(false, 0, null, 5000);
    expect(result.paused).toBe(true);
    expect(result.pauseStartTime).toBe(5000);
    expect(result.pauseAccumulated).toBe(0);
  });

  it("should resume when currently paused", () => {
    const result = togglePauseState(true, 1000, 3000, 5000);
    expect(result.paused).toBe(false);
    expect(result.pauseStartTime).toBe(null);
    // accumulated = 1000 + (5000 - 3000) = 3000
    expect(result.pauseAccumulated).toBe(3000);
  });

  it("should handle resume with null pauseStartTime", () => {
    const result = togglePauseState(true, 1000, null, 5000);
    expect(result.paused).toBe(false);
    expect(result.pauseAccumulated).toBe(1000); // no change
  });

  it("should not modify accumulated when starting pause", () => {
    const result = togglePauseState(false, 2000, null, 5000);
    expect(result.pauseAccumulated).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeResetTimerState
// ---------------------------------------------------------------------------

describe("computeResetTimerState", () => {
  it("should reset timer with fresh start when not paused", () => {
    const result = computeResetTimerState(false, 10000);
    expect(result.pauseAccumulated).toBe(0);
    expect(result.pauseStartTime).toBe(null);
    expect(result.slideStartTime).toBe(10000);
  });

  it("should set pauseStartTime to now when currently paused", () => {
    const result = computeResetTimerState(true, 10000);
    expect(result.pauseAccumulated).toBe(0);
    expect(result.pauseStartTime).toBe(10000);
    expect(result.slideStartTime).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatTimingDisplay
// ---------------------------------------------------------------------------

describe("formatTimingDisplay", () => {
  it("should format zero milliseconds", () => {
    expect(formatTimingDisplay(0)).toBe("0:00");
  });

  it("should format exact seconds", () => {
    expect(formatTimingDisplay(5000)).toBe("0:05");
  });

  it("should format minutes and seconds", () => {
    expect(formatTimingDisplay(65000)).toBe("1:05");
  });

  it("should format large values", () => {
    expect(formatTimingDisplay(3661000)).toBe("61:01");
  });

  it("should round fractional seconds", () => {
    expect(formatTimingDisplay(1500)).toBe("0:02"); // rounds to 2
    expect(formatTimingDisplay(1499)).toBe("0:01"); // rounds to 1
  });

  it("should pad seconds with leading zero", () => {
    expect(formatTimingDisplay(3000)).toBe("0:03");
  });

  it("should handle exactly one minute", () => {
    expect(formatTimingDisplay(60000)).toBe("1:00");
  });
});
