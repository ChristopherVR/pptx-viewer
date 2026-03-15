import { describe, it, expect } from "vitest";
import {
  cssKeyframeName,
  defaultDuration,
  fillModeForClass,
  finalizeClickGroup,
  buildDynamicKeyframe,
} from "./animation-timeline-helpers";
import type { PptxNativeAnimation } from "pptx-viewer-core";
import type { TimelineStep } from "./animation-timeline-types";

describe("cssKeyframeName", () => {
  it("prefixes effect name with pptx-", () => {
    expect(cssKeyframeName("fadeIn")).toBe("pptx-fadeIn");
  });

  it("handles multi-word effects", () => {
    expect(cssKeyframeName("flyIn")).toBe("pptx-flyIn");
  });

  it("handles empty string", () => {
    expect(cssKeyframeName("")).toBe("pptx-");
  });

  it("handles special characters", () => {
    expect(cssKeyframeName("zoom-in")).toBe("pptx-zoom-in");
  });

  it("preserves case", () => {
    expect(cssKeyframeName("FadeOut")).toBe("pptx-FadeOut");
  });

  it("handles long effect names", () => {
    const name = "superLongEffectNameThatGoesOnAndOn";
    expect(cssKeyframeName(name)).toBe(`pptx-${name}`);
  });
});

describe("defaultDuration", () => {
  it("returns 500 for entrance animations", () => {
    expect(defaultDuration("entr")).toBe(500);
  });

  it("returns 500 for exit animations", () => {
    expect(defaultDuration("exit")).toBe(500);
  });

  it("returns 800 for emphasis animations", () => {
    expect(defaultDuration("emph")).toBe(800);
  });

  it("returns 1000 for path animations", () => {
    expect(defaultDuration("path")).toBe(1000);
  });

  it("returns 500 for unknown class", () => {
    expect(defaultDuration(undefined)).toBe(500);
  });

  it("returns 500 for empty string class", () => {
    expect(defaultDuration("" as unknown as undefined)).toBe(500);
  });
});

describe("fillModeForClass", () => {
  it('returns "both" for entrance', () => {
    expect(fillModeForClass("entr")).toBe("both");
  });

  it('returns "forwards" for exit', () => {
    expect(fillModeForClass("exit")).toBe("forwards");
  });

  it('returns "both" for emphasis', () => {
    expect(fillModeForClass("emph")).toBe("both");
  });

  it('returns "both" for unknown class', () => {
    expect(fillModeForClass(undefined)).toBe("both");
  });

  it('returns "both" for path class', () => {
    expect(fillModeForClass("path")).toBe("both");
  });

  it('returns "both" for null-like values', () => {
    expect(fillModeForClass(null as unknown as undefined)).toBe("both");
  });
});

describe("finalizeClickGroup", () => {
  it("computes total duration from steps", () => {
    const steps: TimelineStep[] = [
      { delayMs: 0, durationMs: 500 } as TimelineStep,
      { delayMs: 200, durationMs: 800 } as TimelineStep,
    ];
    const group = finalizeClickGroup(steps);
    expect(group.totalDurationMs).toBe(1000); // max(500, 1000)
    expect(group.steps).toBe(steps);
  });

  it("returns 0 duration for empty steps", () => {
    const group = finalizeClickGroup([]);
    expect(group.totalDurationMs).toBe(0);
    expect(group.steps).toEqual([]);
  });

  it("handles single step", () => {
    const steps: TimelineStep[] = [
      { delayMs: 100, durationMs: 300 } as TimelineStep,
    ];
    const group = finalizeClickGroup(steps);
    expect(group.totalDurationMs).toBe(400);
  });

  it("picks the step with the latest end time", () => {
    const steps: TimelineStep[] = [
      { delayMs: 0, durationMs: 1000 } as TimelineStep,
      { delayMs: 500, durationMs: 200 } as TimelineStep, // ends at 700
      { delayMs: 900, durationMs: 200 } as TimelineStep, // ends at 1100
    ];
    const group = finalizeClickGroup(steps);
    expect(group.totalDurationMs).toBe(1100);
  });

  it("handles steps with zero duration", () => {
    const steps: TimelineStep[] = [
      { delayMs: 500, durationMs: 0 } as TimelineStep,
    ];
    const group = finalizeClickGroup(steps);
    expect(group.totalDurationMs).toBe(500);
  });

  it("handles overlapping steps", () => {
    const steps: TimelineStep[] = [
      { delayMs: 0, durationMs: 500 } as TimelineStep,
      { delayMs: 0, durationMs: 600 } as TimelineStep,
    ];
    const group = finalizeClickGroup(steps);
    expect(group.totalDurationMs).toBe(600);
  });
});

describe("buildDynamicKeyframe", () => {
  it("builds motion path keyframes from SVG path data", () => {
    const anim = {
      motionPath: "M 0,0 L 0.5,0.5",
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 42);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toBe("pptx-tl-motion-42");
    expect(result!.css).toContain("@keyframes pptx-tl-motion-42");
    expect(result!.css).toContain("translate(");
  });

  it("builds rotation keyframes", () => {
    const anim = {
      rotationBy: 360,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 7);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toBe("pptx-tl-rotate-7");
    expect(result!.css).toContain("rotate(360deg)");
  });

  it("builds scale keyframes", () => {
    const anim = {
      scaleByX: 1.5,
      scaleByY: 2.0,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 3);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toBe("pptx-tl-scale-3");
    expect(result!.css).toContain("scale(1.5, 2)");
  });

  it("returns undefined when no motion/rotation/scale", () => {
    const anim = {} as PptxNativeAnimation;
    expect(buildDynamicKeyframe(anim, 1)).toBeUndefined();
  });

  it("returns undefined for motion path with fewer than 2 points", () => {
    const anim = {
      motionPath: "M 0,0",
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 1);
    expect(result).toBeUndefined();
  });

  it("defaults scale Y to 1 when only X is provided", () => {
    const anim = {
      scaleByX: 2.0,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 5);
    expect(result).toBeDefined();
    expect(result!.css).toContain("scale(2, 1)");
  });

  it("adds rotate() to motion path keyframes when motionPathRotateAuto is true", () => {
    const anim = {
      motionPath: "M 0,0 L 1,0 L 1,1",
      motionPathRotateAuto: true,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 10);
    expect(result).toBeDefined();
    expect(result!.css).toContain("rotate(");
    // First point (0,0) → next (100,0): angle = 0 degrees (moving right)
    expect(result!.css).toContain("translate(0.00%, 0.00%) rotate(0.00deg)");
    // Second point (100,0) → next (100,100): angle = 90 degrees (moving down)
    expect(result!.css).toContain("translate(100.00%, 0.00%) rotate(90.00deg)");
    // Last point (100,100) uses direction from previous: same as prev→current = 90 degrees
    expect(result!.css).toContain("translate(100.00%, 100.00%) rotate(90.00deg)");
  });

  it("does not add rotate() to motion path keyframes when motionPathRotateAuto is false", () => {
    const anim = {
      motionPath: "M 0,0 L 1,0 L 1,1",
      motionPathRotateAuto: false,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 11);
    expect(result).toBeDefined();
    expect(result!.css).not.toContain("rotate(");
  });

  it("does not add rotate() to motion path keyframes when motionPathRotateAuto is undefined", () => {
    const anim = {
      motionPath: "M 0,0 L 1,0 L 1,1",
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 12);
    expect(result).toBeDefined();
    expect(result!.css).not.toContain("rotate(");
  });

  it("computes correct angle for diagonal motion path with auto-rotate", () => {
    const anim = {
      motionPath: "M 0,0 L 1,1",
      motionPathRotateAuto: true,
    } as unknown as PptxNativeAnimation;
    const result = buildDynamicKeyframe(anim, 13);
    expect(result).toBeDefined();
    // Diagonal (1,1) direction = 45 degrees
    expect(result!.css).toContain("rotate(45.00deg)");
  });
});
