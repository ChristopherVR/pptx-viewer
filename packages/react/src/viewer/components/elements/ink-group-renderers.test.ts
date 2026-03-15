import { describe, it, expect } from "vitest";
import type { InkPptxElement, ContentPartPptxElement } from "pptx-viewer-core";
import {
  hasPressureVariation,
  getInkReplayStyles,
  getContentPartReplayStyles,
  getTotalReplayDuration,
  extractPathPoints,
  generatePressureCircles,
} from "../../utils/ink-rendering";
import type { InkRenderOptions } from "./InkGroupRenderers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInkElement(
  overrides: Partial<InkPptxElement> = {},
): InkPptxElement {
  return {
    id: "ink_test",
    type: "ink",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    inkPaths: ["M 0 0 L 100 0 L 100 50"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pressure sensitivity auto-detection
// ---------------------------------------------------------------------------

describe("pressure sensitivity auto-detection", () => {
  it("should detect pressure variation when widths differ", () => {
    const el = makeInkElement({
      inkWidths: [1, 3, 5, 2, 4],
    });
    expect(hasPressureVariation(el.inkWidths!)).toBe(true);
  });

  it("should not detect pressure variation with uniform widths", () => {
    const el = makeInkElement({
      inkWidths: [3, 3, 3],
    });
    expect(hasPressureVariation(el.inkWidths!)).toBe(false);
  });

  it("should not detect pressure for missing widths", () => {
    const el = makeInkElement({});
    expect(el.inkWidths).toBeUndefined();
  });

  it("should generate pressure circles from path data", () => {
    const path = "M 0 0 L 50 0 L 100 0";
    const widths = [2, 4, 6];
    const points = extractPathPoints(path);
    const circles = generatePressureCircles(points, widths, {
      baseWidth: 3,
    });

    // Should create one circle per extracted point
    expect(circles).toHaveLength(points.length);

    // Each circle should have a valid radius > 0
    circles.forEach((c) => {
      expect(c.r).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Ink replay animation in presentation mode
// ---------------------------------------------------------------------------

describe("ink replay in presentation mode", () => {
  it("should generate replay styles for each stroke", () => {
    const el = makeInkElement({
      inkPaths: [
        "M 0 0 L 50 50",
        "M 10 10 L 60 60",
        "M 20 20 L 70 70",
      ],
    });
    const styles = getInkReplayStyles(el);

    expect(styles).toHaveLength(3);
    // First stroke starts immediately
    expect(styles[0].animationDelay).toBe("0ms");
    // Subsequent strokes have increasing delays
    expect(parseInt(styles[1].animationDelay)).toBeGreaterThan(0);
    expect(parseInt(styles[2].animationDelay)).toBeGreaterThan(
      parseInt(styles[1].animationDelay),
    );
  });

  it("should produce sequential non-overlapping stroke animations", () => {
    const el = makeInkElement({
      inkPaths: [
        "M 0 0 L 100 0",
        "M 0 25 L 100 25",
        "M 0 50 L 100 50",
      ],
    });
    const styles = getInkReplayStyles(el);

    // Each stroke should start after the previous one ends
    for (let i = 1; i < styles.length; i++) {
      const prevEnd =
        parseInt(styles[i - 1].animationDelay) +
        parseInt(styles[i - 1].animationDuration);
      const curStart = parseInt(styles[i].animationDelay);
      expect(curStart).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  it("should set strokeDasharray and strokeDashoffset for hidden initial state", () => {
    const el = makeInkElement({
      inkPaths: ["M 0 0 L 100 0"],
    });
    const styles = getInkReplayStyles(el);

    // Initially the stroke should be fully hidden (dashoffset = dasharray = pathLength)
    expect(styles[0].strokeDasharray).toBe(styles[0].strokeDashoffset);
    expect(parseFloat(styles[0].strokeDasharray)).toBeGreaterThan(0);
  });

  it("should include the animation shorthand with keyframe name", () => {
    const el = makeInkElement({
      inkPaths: ["M 0 0 L 50 50"],
    });
    const styles = getInkReplayStyles(el);

    expect(styles[0].animation).toContain("fuzor-ink-replay");
    expect(styles[0].animation).toContain("forwards");
  });

  it("should respect custom replay config", () => {
    const el = makeInkElement({
      inkPaths: ["M 0 0 L 30 30", "M 30 30 L 60 60"],
    });
    const config = { strokeDurationMs: 400, strokeDelayMs: 100 };
    const styles = getInkReplayStyles(el, config);

    expect(styles[0].animationDuration).toBe("400ms");
    // Second stroke delay = 1 * (400 + 100) = 500ms
    expect(styles[1].animationDelay).toBe("500ms");
  });
});

// ---------------------------------------------------------------------------
// Content part ink replay
// ---------------------------------------------------------------------------

describe("content part ink replay", () => {
  it("should generate replay styles for content part ink strokes", () => {
    const strokes = [
      { path: "M 0 0 L 40 40", color: "#f00", width: 2, opacity: 1 },
      { path: "M 10 10 L 50 50", color: "#00f", width: 3, opacity: 0.8 },
    ];
    const styles = getContentPartReplayStyles(strokes);

    expect(styles).toHaveLength(2);
    expect(styles[0].animationDelay).toBe("0ms");
    expect(parseInt(styles[1].animationDelay)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Replay duration calculation
// ---------------------------------------------------------------------------

describe("replay duration matches last stroke end time", () => {
  it("should match for default config", () => {
    const strokeCount = 4;
    const el = makeInkElement({
      inkPaths: Array(strokeCount).fill("M 0 0 L 50 50"),
    });
    const styles = getInkReplayStyles(el);
    const lastStyle = styles[styles.length - 1];
    const computedEnd =
      parseInt(lastStyle.animationDelay) +
      parseInt(lastStyle.animationDuration);

    expect(computedEnd).toBe(getTotalReplayDuration(strokeCount));
  });

  it("should match for custom config", () => {
    const strokeCount = 3;
    const config = { strokeDurationMs: 300, strokeDelayMs: 50 };
    const el = makeInkElement({
      inkPaths: Array(strokeCount).fill("M 0 0 L 20 20"),
    });
    const styles = getInkReplayStyles(el, config);
    const lastStyle = styles[styles.length - 1];
    const computedEnd =
      parseInt(lastStyle.animationDelay) +
      parseInt(lastStyle.animationDuration);

    expect(computedEnd).toBe(getTotalReplayDuration(strokeCount, config));
  });
});

// ---------------------------------------------------------------------------
// InkRenderOptions type contract
// ---------------------------------------------------------------------------

describe("InkRenderOptions", () => {
  it("should accept replay and pressureSensitive as optional booleans", () => {
    const opts: InkRenderOptions = {
      replay: true,
      pressureSensitive: true,
      replayConfig: { strokeDurationMs: 500 },
    };
    expect(opts.replay).toBe(true);
    expect(opts.pressureSensitive).toBe(true);
    expect(opts.replayConfig?.strokeDurationMs).toBe(500);
  });

  it("should allow empty options (all defaults)", () => {
    const opts: InkRenderOptions = {};
    expect(opts.replay).toBeUndefined();
    expect(opts.pressureSensitive).toBeUndefined();
  });
});
