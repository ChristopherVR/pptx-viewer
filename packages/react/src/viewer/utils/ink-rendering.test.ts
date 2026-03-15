import { describe, it, expect } from "vitest";
import type { InkPptxElement, ContentPartInkStroke } from "pptx-viewer-core";
import {
  extractPathPoints,
  interpolateWidth,
  generatePressureCircles,
  hasPressureVariation,
  pressuresToWidths,
  estimatePathLength,
  getInkStrokeReplayStyle,
  getInkReplayStyles,
  getContentPartReplayStyles,
  getTotalReplayDuration,
  resolveInkOpacity,
  resolveInkColor,
  resolveInkWidth,
  INK_REPLAY_KEYFRAME_NAME,
  INK_REPLAY_KEYFRAMES,
} from "./ink-rendering";

// ==========================================================================
// extractPathPoints
// ==========================================================================

describe("extractPathPoints", () => {
  it("should extract points from a simple M-L path", () => {
    const points = extractPathPoints("M 10 20 L 30 40 L 50 60");
    expect(points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it("should handle negative coordinates", () => {
    const points = extractPathPoints("M -5 -10 L 15 -20");
    expect(points).toEqual([
      { x: -5, y: -10 },
      { x: 15, y: -20 },
    ]);
  });

  it("should handle decimal coordinates", () => {
    const points = extractPathPoints("M 1.5 2.75 L 3.125 4.5");
    expect(points).toEqual([
      { x: 1.5, y: 2.75 },
      { x: 3.125, y: 4.5 },
    ]);
  });

  it("should return empty array for empty path", () => {
    expect(extractPathPoints("")).toEqual([]);
  });

  it("should handle single point path", () => {
    const points = extractPathPoints("M 100 200");
    expect(points).toEqual([{ x: 100, y: 200 }]);
  });
});

// ==========================================================================
// interpolateWidth
// ==========================================================================

describe("interpolateWidth", () => {
  it("should return 1 for empty widths array", () => {
    expect(interpolateWidth([], 0.5)).toBe(1);
  });

  it("should return the single value for single-element array", () => {
    expect(interpolateWidth([5], 0)).toBe(5);
    expect(interpolateWidth([5], 0.5)).toBe(5);
    expect(interpolateWidth([5], 1)).toBe(5);
  });

  it("should interpolate linearly between two values", () => {
    expect(interpolateWidth([2, 8], 0)).toBe(2);
    expect(interpolateWidth([2, 8], 0.5)).toBe(5);
    expect(interpolateWidth([2, 8], 1)).toBe(8);
  });

  it("should interpolate at 0.25 for three values", () => {
    // [1, 3, 5] at t=0.25 -> index = 0.5 -> lerp(1, 3, 0.5) = 2
    expect(interpolateWidth([1, 3, 5], 0.25)).toBe(2);
  });

  it("should clamp t to [0, 1]", () => {
    expect(interpolateWidth([2, 8], -1)).toBe(2);
    expect(interpolateWidth([2, 8], 2)).toBe(8);
  });
});

// ==========================================================================
// generatePressureCircles
// ==========================================================================

describe("generatePressureCircles", () => {
  it("should return empty array for no points", () => {
    const circles = generatePressureCircles([], [3, 5], { baseWidth: 4 });
    expect(circles).toEqual([]);
  });

  it("should generate one circle for one point", () => {
    const circles = generatePressureCircles(
      [{ x: 10, y: 20 }],
      [4],
      { baseWidth: 4 },
    );
    expect(circles).toHaveLength(1);
    expect(circles[0].cx).toBe(10);
    expect(circles[0].cy).toBe(20);
    expect(circles[0].r).toBeGreaterThan(0);
  });

  it("should vary radius based on width data", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    // widths go from thin (1) to thick (6)
    const circles = generatePressureCircles(points, [1, 6], { baseWidth: 3 });
    expect(circles).toHaveLength(3);
    // First circle should have smallest radius, last should be largest
    expect(circles[2].r).toBeGreaterThan(circles[0].r);
  });

  it("should respect minRadius", () => {
    const circles = generatePressureCircles(
      [{ x: 0, y: 0 }],
      [0.01],
      { baseWidth: 10, minRadius: 2 },
    );
    expect(circles[0].r).toBeGreaterThanOrEqual(2);
  });

  it("should respect maxRadius", () => {
    const circles = generatePressureCircles(
      [{ x: 0, y: 0 }],
      [100],
      { baseWidth: 4, maxRadius: 5 },
    );
    expect(circles[0].r).toBeLessThanOrEqual(5);
  });
});

// ==========================================================================
// hasPressureVariation
// ==========================================================================

describe("hasPressureVariation", () => {
  it("should return false for empty array", () => {
    expect(hasPressureVariation([])).toBe(false);
  });

  it("should return false for single element", () => {
    expect(hasPressureVariation([3])).toBe(false);
  });

  it("should return false for uniform widths", () => {
    expect(hasPressureVariation([3, 3, 3, 3])).toBe(false);
  });

  it("should return true when widths vary", () => {
    expect(hasPressureVariation([2, 4, 6])).toBe(true);
  });

  it("should treat very small differences as uniform", () => {
    expect(hasPressureVariation([3.0, 3.005, 3.001])).toBe(false);
  });
});

// ==========================================================================
// estimatePathLength
// ==========================================================================

describe("estimatePathLength", () => {
  it("should return 0 for fewer than 2 points", () => {
    expect(estimatePathLength([])).toBe(0);
    expect(estimatePathLength([{ x: 5, y: 5 }])).toBe(0);
  });

  it("should compute length of a horizontal line", () => {
    const length = estimatePathLength([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(length).toBeCloseTo(10, 5);
  });

  it("should compute length of a diagonal line", () => {
    const length = estimatePathLength([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(length).toBeCloseTo(5, 5);
  });

  it("should sum lengths of multi-segment path", () => {
    const length = estimatePathLength([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(length).toBeCloseTo(20, 5);
  });
});

// ==========================================================================
// getInkStrokeReplayStyle
// ==========================================================================

describe("getInkStrokeReplayStyle", () => {
  it("should use default duration and delay for first stroke", () => {
    const style = getInkStrokeReplayStyle(0, 100);
    expect(style.animationDelay).toBe("0ms");
    expect(style.animationDuration).toBe("600ms");
    expect(style.strokeDasharray).toBe("100");
    expect(style.strokeDashoffset).toBe("100");
    expect(style.pathLength).toBe(100);
  });

  it("should apply cumulative delay for subsequent strokes", () => {
    const style = getInkStrokeReplayStyle(2, 50);
    // delay = 2 * (600 + 200) = 1600
    expect(style.animationDelay).toBe("1600ms");
  });

  it("should use custom config values", () => {
    const style = getInkStrokeReplayStyle(1, 80, {
      strokeDurationMs: 400,
      strokeDelayMs: 100,
      easing: "linear",
    });
    // delay = 1 * (400 + 100) = 500
    expect(style.animationDelay).toBe("500ms");
    expect(style.animationDuration).toBe("400ms");
    expect(style.animation).toContain("linear");
    expect(style.animation).toContain("500ms");
  });

  it("should use pathLength of at least 1 for zero-length paths", () => {
    const style = getInkStrokeReplayStyle(0, 0);
    expect(style.pathLength).toBe(1);
    expect(style.strokeDasharray).toBe("1");
  });

  it("should include the keyframe name in the animation shorthand", () => {
    const style = getInkStrokeReplayStyle(0, 50);
    expect(style.animation).toContain(INK_REPLAY_KEYFRAME_NAME);
  });
});

// ==========================================================================
// getInkReplayStyles
// ==========================================================================

describe("getInkReplayStyles", () => {
  it("should return one style per ink path", () => {
    const el: InkPptxElement = {
      type: "ink",
      id: "ink-1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      inkPaths: [
        "M 0 0 L 50 50",
        "M 10 10 L 60 60",
        "M 20 20 L 70 70",
      ],
    };
    const styles = getInkReplayStyles(el);
    expect(styles).toHaveLength(3);
    // Each subsequent stroke should have a greater delay
    expect(parseInt(styles[1].animationDelay)).toBeGreaterThan(
      parseInt(styles[0].animationDelay),
    );
    expect(parseInt(styles[2].animationDelay)).toBeGreaterThan(
      parseInt(styles[1].animationDelay),
    );
  });

  it("should return empty array for element with no paths", () => {
    const el: InkPptxElement = {
      type: "ink",
      id: "ink-2",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      inkPaths: [],
    };
    expect(getInkReplayStyles(el)).toEqual([]);
  });
});

// ==========================================================================
// getContentPartReplayStyles
// ==========================================================================

describe("getContentPartReplayStyles", () => {
  it("should generate replay styles for content part strokes", () => {
    const strokes: ContentPartInkStroke[] = [
      { path: "M 0 0 L 30 30", color: "#f00", width: 2, opacity: 1 },
      { path: "M 5 5 L 35 35", color: "#0f0", width: 3, opacity: 0.8 },
    ];
    const styles = getContentPartReplayStyles(strokes);
    expect(styles).toHaveLength(2);
    expect(styles[0].animationDelay).toBe("0ms");
    expect(parseInt(styles[1].animationDelay)).toBeGreaterThan(0);
  });

  it("should return empty array for empty strokes", () => {
    expect(getContentPartReplayStyles([])).toEqual([]);
  });
});

// ==========================================================================
// getTotalReplayDuration
// ==========================================================================

describe("getTotalReplayDuration", () => {
  it("should return 0 for zero strokes", () => {
    expect(getTotalReplayDuration(0)).toBe(0);
  });

  it("should return just the duration for a single stroke", () => {
    // 1 stroke: (1-1)*(600+200) + 600 = 600
    expect(getTotalReplayDuration(1)).toBe(600);
  });

  it("should compute correct total for multiple strokes", () => {
    // 3 strokes: (3-1)*(600+200) + 600 = 1600 + 600 = 2200
    expect(getTotalReplayDuration(3)).toBe(2200);
  });

  it("should use custom config", () => {
    // 2 strokes, duration=400, delay=100: (2-1)*(400+100) + 400 = 500 + 400 = 900
    expect(
      getTotalReplayDuration(2, { strokeDurationMs: 400, strokeDelayMs: 100 }),
    ).toBe(900);
  });
});

// ==========================================================================
// resolveInkOpacity
// ==========================================================================

describe("resolveInkOpacity", () => {
  it("should return 1 when opacities is undefined", () => {
    expect(resolveInkOpacity(undefined, 0)).toBe(1);
  });

  it("should return 1 when index is out of range", () => {
    expect(resolveInkOpacity([0.5], 5)).toBe(1);
  });

  it("should return the value at the given index", () => {
    expect(resolveInkOpacity([0.3, 0.7, 0.9], 1)).toBe(0.7);
  });

  it("should clamp values below 0 to 0", () => {
    expect(resolveInkOpacity([-0.5], 0)).toBe(0);
  });

  it("should clamp values above 1 to 1", () => {
    expect(resolveInkOpacity([1.5], 0)).toBe(1);
  });
});

// ==========================================================================
// resolveInkColor
// ==========================================================================

describe("resolveInkColor", () => {
  it("should return fallback when colors is undefined", () => {
    expect(resolveInkColor(undefined, 0)).toBe("#000");
  });

  it("should return fallback when index is out of range", () => {
    expect(resolveInkColor(["#f00"], 5)).toBe("#000");
  });

  it("should return the color at the given index", () => {
    expect(resolveInkColor(["#f00", "#0f0", "#00f"], 2)).toBe("#00f");
  });

  it("should use a custom fallback", () => {
    expect(resolveInkColor(undefined, 0, "#999")).toBe("#999");
  });

  it("should return fallback for empty string color", () => {
    expect(resolveInkColor([""], 0)).toBe("#000");
  });
});

// ==========================================================================
// resolveInkWidth
// ==========================================================================

describe("resolveInkWidth", () => {
  it("should return fallback when widths is undefined", () => {
    expect(resolveInkWidth(undefined, 0)).toBe(3);
  });

  it("should return fallback when index is out of range", () => {
    expect(resolveInkWidth([5], 3)).toBe(3);
  });

  it("should return the width at the given index", () => {
    expect(resolveInkWidth([1, 4, 7], 1)).toBe(4);
  });

  it("should return fallback for zero width", () => {
    expect(resolveInkWidth([0], 0)).toBe(3);
  });

  it("should use a custom fallback", () => {
    expect(resolveInkWidth(undefined, 0, 5)).toBe(5);
  });
});

// ==========================================================================
// INK_REPLAY_KEYFRAMES constant
// ==========================================================================

describe("INK_REPLAY_KEYFRAMES", () => {
  it("should contain the correct keyframe name", () => {
    expect(INK_REPLAY_KEYFRAMES).toContain(INK_REPLAY_KEYFRAME_NAME);
  });

  it("should define stroke-dashoffset animation from var to 0", () => {
    expect(INK_REPLAY_KEYFRAMES).toContain("stroke-dashoffset");
    expect(INK_REPLAY_KEYFRAMES).toContain("var(--ink-path-length)");
    expect(INK_REPLAY_KEYFRAMES).toContain("stroke-dashoffset: 0");
  });

  it("should be a valid @keyframes block", () => {
    expect(INK_REPLAY_KEYFRAMES).toMatch(/^@keyframes\s+\S+\s*\{/);
    expect(INK_REPLAY_KEYFRAMES).toContain("from");
    expect(INK_REPLAY_KEYFRAMES).toContain("to");
  });
});

// ==========================================================================
// Replay timing: sequential stagger calculation
// ==========================================================================

describe("replay sequential stagger timing", () => {
  it("should stagger stroke start times so they draw one after another", () => {
    const el: InkPptxElement = {
      type: "ink",
      id: "ink-stagger",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      inkPaths: [
        "M 0 0 L 100 0",
        "M 0 50 L 100 50",
        "M 0 100 L 100 100",
        "M 0 150 L 100 150",
      ],
    };
    const styles = getInkReplayStyles(el);

    // Verify each stroke starts after the previous one finishes
    for (let i = 1; i < styles.length; i++) {
      const prevDelay = parseInt(styles[i - 1].animationDelay);
      const prevDuration = parseInt(styles[i - 1].animationDuration);
      const curDelay = parseInt(styles[i].animationDelay);
      // Current stroke's delay should be >= previous stroke's delay + duration
      // (it can be equal or greater depending on the inter-stroke gap)
      expect(curDelay).toBeGreaterThanOrEqual(prevDelay + prevDuration);
    }
  });

  it("should produce total replay duration matching getTotalReplayDuration", () => {
    const strokeCount = 5;
    const config = { strokeDurationMs: 500, strokeDelayMs: 150 };
    const el: InkPptxElement = {
      type: "ink",
      id: "ink-total",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      inkPaths: Array(strokeCount).fill("M 0 0 L 50 50"),
    };
    const styles = getInkReplayStyles(el, config);
    const lastStyle = styles[styles.length - 1];
    const lastEndTime =
      parseInt(lastStyle.animationDelay) + parseInt(lastStyle.animationDuration);

    expect(lastEndTime).toBe(getTotalReplayDuration(strokeCount, config));
  });

  it("should assign monotonically increasing delays across strokes", () => {
    const el: InkPptxElement = {
      type: "ink",
      id: "ink-mono",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      inkPaths: [
        "M 0 0 L 10 10",
        "M 10 10 L 80 80",
        "M 80 80 L 90 90",
      ],
    };
    const styles = getInkReplayStyles(el);
    const delays = styles.map((s) => parseInt(s.animationDelay));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

// ==========================================================================
// Pressure rendering: auto-detection helpers
// ==========================================================================

describe("pressure rendering auto-detection", () => {
  it("hasPressureVariation detects varying widths in realistic data", () => {
    // Simulate stylus pressure data (typical range 0.1 to 1.0)
    const pressureWidths = [1.2, 2.5, 3.8, 3.2, 2.1, 1.5, 2.8, 4.0, 3.5];
    expect(hasPressureVariation(pressureWidths)).toBe(true);
  });

  it("hasPressureVariation rejects uniform pressure data", () => {
    const uniformWidths = [3.0, 3.0, 3.0, 3.0, 3.0];
    expect(hasPressureVariation(uniformWidths)).toBe(false);
  });

  it("generatePressureCircles produces circles at each extracted point", () => {
    const pathD = "M 0 0 L 50 0 L 100 0";
    const points = extractPathPoints(pathD);
    const widths = [2, 4, 6];
    const circles = generatePressureCircles(points, widths, { baseWidth: 3 });
    expect(circles).toHaveLength(points.length);
    // Verify coordinates match
    circles.forEach((c, i) => {
      expect(c.cx).toBe(points[i].x);
      expect(c.cy).toBe(points[i].y);
    });
  });

  it("pressure circles vary in radius when widths differ", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    // Widths increasing from 1 to 5
    const circles = generatePressureCircles(points, [1, 5], { baseWidth: 3 });
    // The radius at the end (high width) should differ from the start (low width)
    expect(circles[0].r).not.toEqual(circles[2].r);
  });
});

// ==========================================================================
// pressuresToWidths
// ==========================================================================

describe("pressuresToWidths", () => {
  it("should return baseWidth * minScale at zero pressure", () => {
    const widths = pressuresToWidths([0], 10);
    // Default minScale = 0.3 => 10 * 0.3 = 3
    expect(widths[0]).toBeCloseTo(3);
  });

  it("should return baseWidth * maxScale at full pressure", () => {
    const widths = pressuresToWidths([1], 10);
    // Default maxScale = 1.8 => 10 * 1.8 = 18
    expect(widths[0]).toBeCloseTo(18);
  });

  it("should linearly interpolate at mid pressure", () => {
    const widths = pressuresToWidths([0.5], 10);
    // 0.5 => 10 * (0.3 + 0.5 * 1.5) = 10 * 1.05 = 10.5
    expect(widths[0]).toBeCloseTo(10.5);
  });

  it("should produce varying widths for varying pressures", () => {
    const pressures = [0.1, 0.5, 0.9];
    const widths = pressuresToWidths(pressures, 4);
    expect(widths).toHaveLength(3);
    // Each subsequent width should be larger
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
  });

  it("should accept custom min/max scale", () => {
    const widths = pressuresToWidths([0, 1], 10, 0.5, 2.0);
    expect(widths[0]).toBeCloseTo(5); // 10 * 0.5
    expect(widths[1]).toBeCloseTo(20); // 10 * 2.0
  });

  it("should clamp pressure values outside [0, 1]", () => {
    const widths = pressuresToWidths([-0.5, 1.5], 10);
    // Clamped to 0 and 1
    expect(widths[0]).toBeCloseTo(3); // 10 * 0.3
    expect(widths[1]).toBeCloseTo(18); // 10 * 1.8
  });

  it("should return empty array for empty pressures", () => {
    expect(pressuresToWidths([], 10)).toEqual([]);
  });
});
