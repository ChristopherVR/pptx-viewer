import { describe, it, expect } from "vitest";
import { buildTimeline } from "./animation-timeline-builder";
import { TimelineEngine } from "./animation-timeline-engine";
import type { PptxNativeAnimation } from "pptx-viewer-core";
import type {
  AnimationTimeline,
  TimelineClickGroup,
  TimelineStep,
} from "./animation-timeline-types";

// ==========================================================================
// Test helpers
// ==========================================================================

function makeAnim(
  overrides: Partial<PptxNativeAnimation> = {},
): PptxNativeAnimation {
  return {
    targetId: "el1",
    presetClass: "entr",
    presetId: 10, // fadeIn
    trigger: "onClick",
    durationMs: 500,
    delayMs: 0,
    ...overrides,
  } as PptxNativeAnimation;
}

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
  return {
    elementId: "el-1",
    cssAnimation: "pptx-fadeIn 500ms ease 0ms 1 normal both",
    keyframeName: "pptx-fadeIn",
    trigger: "onClick",
    delayMs: 0,
    durationMs: 500,
    fillMode: "both",
    presetClass: "entr",
    ...overrides,
  };
}

function makeGroup(
  steps: TimelineStep[],
  options?: Partial<TimelineClickGroup>,
): TimelineClickGroup {
  let maxEnd = 0;
  for (const step of steps) {
    const end = step.delayMs + step.durationMs;
    if (end > maxEnd) maxEnd = end;
  }
  return { steps, totalDurationMs: maxEnd, ...options };
}

function makeTimeline(
  overrides: Partial<AnimationTimeline> = {},
): AnimationTimeline {
  return {
    clickGroups: [],
    entranceElementIds: new Set(),
    keyframesCss: "",
    interactiveSequences: new Map(),
    hoverSequences: new Map(),
    ...overrides,
  };
}

// ==========================================================================
// Hover sequences
// ==========================================================================

describe("buildTimeline - hover sequences", () => {
  it("separates onHover animations into hover sequences", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({
        targetId: "el2",
        trigger: "onHover",
      }),
    ]);
    // el1 goes to regular click-groups, el2 goes to hover sequences
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps[0].elementId).toBe("el1");
    expect(result.hoverSequences.size).toBe(1);
    // el2 is keyed by its targetId (the element that has the hover animation)
    expect(result.hoverSequences.has("el2")).toBe(true);
  });

  it("groups multiple onHover animations for the same target", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 26, // pulse
      }),
      makeAnim({
        targetId: "el1",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 8, // spin
      }),
    ]);
    expect(result.hoverSequences.has("el1")).toBe(true);
    const seqGroups = result.hoverSequences.get("el1")!;
    const totalSteps = seqGroups.reduce(
      (sum, g) => sum + g.steps.length,
      0,
    );
    expect(totalSteps).toBe(2);
  });

  it("tracks entrance elements in hover sequences", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onHover",
        presetClass: "entr",
        presetId: 10,
      }),
    ]);
    expect(result.entranceElementIds.has("el1")).toBe(true);
  });

  it("generates keyframes CSS for hover animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 26, // pulse
      }),
    ]);
    expect(result.keyframesCss).toContain("pptx-pulse");
  });

  it("returns empty hover sequences when no onHover animations exist", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
    ]);
    expect(result.hoverSequences.size).toBe(0);
  });
});

// ==========================================================================
// TimelineEngine - hover sequences
// ==========================================================================

describe("TimelineEngine - hover sequences", () => {
  it("should detect hover sequence triggers", () => {
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("shape-hover", [makeGroup([makeStep()])]);

    const engine = new TimelineEngine(
      makeTimeline({ hoverSequences }),
    );

    expect(engine.hasHoverSequence("shape-hover")).toBe(true);
    expect(engine.hasHoverSequence("shape-other")).toBe(false);
  });

  it("should return hover trigger shape IDs", () => {
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("shape-1", [makeGroup([makeStep()])]);
    hoverSequences.set("shape-2", [makeGroup([makeStep()])]);

    const engine = new TimelineEngine(
      makeTimeline({ hoverSequences }),
    );

    const ids = engine.getHoverTriggerShapeIds();
    expect(ids.has("shape-1")).toBe(true);
    expect(ids.has("shape-2")).toBe(true);
    expect(ids.size).toBe(2);
  });

  it("should advance hover sequences", () => {
    const hStep = makeStep({ elementId: "h-el", presetClass: "emph" });
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("btn", [makeGroup([hStep])]);

    const engine = new TimelineEngine(
      makeTimeline({ hoverSequences }),
    );

    const g = engine.advanceHover("btn");
    expect(g).not.toBeNull();
    expect(g!.steps[0].elementId).toBe("h-el");
  });

  it("should return null for non-existent hover trigger", () => {
    const engine = new TimelineEngine(makeTimeline());
    expect(engine.advanceHover("no-such-shape")).toBeNull();
  });

  it("should reset hover sequence for replay", () => {
    const hStep = makeStep({ elementId: "h-el", presetClass: "emph" });
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("btn", [makeGroup([hStep])]);

    const engine = new TimelineEngine(
      makeTimeline({ hoverSequences }),
    );

    // First hover
    expect(engine.advanceHover("btn")).not.toBeNull();
    expect(engine.advanceHover("btn")).toBeNull(); // No more groups

    // Reset and hover again
    engine.resetHover("btn");
    expect(engine.advanceHover("btn")).not.toBeNull();
  });

  it("should reset hover sequences on full reset", () => {
    const hStep = makeStep({ elementId: "h-el", presetClass: "emph" });
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("btn", [makeGroup([hStep])]);

    const engine = new TimelineEngine(
      makeTimeline({ hoverSequences }),
    );

    engine.advanceHover("btn");
    expect(engine.advanceHover("btn")).toBeNull();

    engine.reset();
    expect(engine.advanceHover("btn")).not.toBeNull();
  });

  it("should track entrance elements from hover sequences", () => {
    const hStep = makeStep({ elementId: "h-el", presetClass: "entr" });
    const hoverSequences = new Map<string, TimelineClickGroup[]>();
    hoverSequences.set("btn", [makeGroup([hStep])]);

    const engine = new TimelineEngine(
      makeTimeline({
        entranceElementIds: new Set(["h-el"]),
        hoverSequences,
      }),
    );

    expect(engine.isElementVisible("h-el")).toBe(false);
    engine.advanceHover("btn");
    expect(engine.isElementVisible("h-el")).toBe(true);
  });
});

// ==========================================================================
// Auto-advance groups
// ==========================================================================

describe("buildTimeline - auto-advance groups", () => {
  it("marks afterPrevious groups after onClick as auto-advance", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick", durationMs: 500 }),
      makeAnim({ targetId: "el2", trigger: "onClick", durationMs: 300 }),
      makeAnim({ targetId: "el3", trigger: "afterPrevious", durationMs: 200 }),
    ]);
    // el1 = click group 0, el2 = click group 1, el3 = click group 1 (same group as el2)
    // el3 afterPrevious is in the same group as el2 (both in group 1)
    expect(result.clickGroups).toHaveLength(2);
    // The second group has both el2 and el3
    expect(result.clickGroups[1].steps).toHaveLength(2);
  });

  it("marks standalone afterPrevious groups as auto-advance when they follow onClick", () => {
    // Simulates: onClick el1, then afterPrevious group that starts after el1
    // Since afterPrevious stays in the same click-group, this all goes in one group
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 500,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterPrevious",
        durationMs: 300,
      }),
    ]);
    // Both should be in the same click-group
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps).toHaveLength(2);
    expect(result.clickGroups[0].steps[1].delayMs).toBe(500);
  });

  it("does not mark the first group as auto-advance", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "afterPrevious" }),
    ]);
    // First group is never auto-advance (even if trigger is afterPrevious)
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].autoAdvance).toBeUndefined();
  });

  it("sets autoAdvanceDelayMs to 0 for auto-advance groups", () => {
    // Create a scenario where auto-advance is triggered:
    // onClick -> onClick -> afterPrevious (separate group)
    // Actually, afterPrevious stays in the same group as onClick.
    // We need a case where afterPrevious has no preceding step in its group.
    // This happens when there's a withPrevious at the start of a new "logical" group
    // followed by afterPrevious, but those stay in the same click-group.
    //
    // The auto-advance scenario happens when *all* animations after the first
    // click-group use afterPrevious/withPrevious triggers.
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick", durationMs: 300 }),
      makeAnim({ targetId: "el2", trigger: "withPrevious", durationMs: 500 }),
    ]);
    expect(result.clickGroups).toHaveLength(1);
    // All in one group, no auto-advance needed
  });
});

// ==========================================================================
// TimelineEngine - auto-advance
// ==========================================================================

describe("TimelineEngine - auto-advance", () => {
  it("shouldAutoAdvance returns false for empty timeline", () => {
    const engine = new TimelineEngine(makeTimeline());
    expect(engine.shouldAutoAdvance()).toBe(false);
  });

  it("shouldAutoAdvance returns false when next group is a click group", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const g2 = makeGroup([makeStep({ elementId: "b" })]);
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1, g2] }),
    );
    expect(engine.shouldAutoAdvance()).toBe(false);
  });

  it("shouldAutoAdvance returns true when next group has autoAdvance", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const g2 = makeGroup([makeStep({ elementId: "b" })], {
      autoAdvance: true,
      autoAdvanceDelayMs: 0,
    });
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1, g2] }),
    );
    // Before advancing, next is g1 which is not auto-advance
    expect(engine.shouldAutoAdvance()).toBe(false);
    // Advance to g1, now next is g2 which is auto-advance
    engine.advance();
    expect(engine.shouldAutoAdvance()).toBe(true);
  });

  it("getAutoAdvanceDelay returns the delay from next auto-advance group", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const g2 = makeGroup([makeStep({ elementId: "b" })], {
      autoAdvance: true,
      autoAdvanceDelayMs: 250,
    });
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1, g2] }),
    );
    engine.advance();
    expect(engine.getAutoAdvanceDelay()).toBe(250);
  });

  it("getAutoAdvanceDelay returns 0 when next group is not auto-advance", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const g2 = makeGroup([makeStep({ elementId: "b" })]);
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1, g2] }),
    );
    expect(engine.getAutoAdvanceDelay()).toBe(0);
  });

  it("peekNext returns next group without advancing", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const g2 = makeGroup([makeStep({ elementId: "b" })]);
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1, g2] }),
    );

    const peeked = engine.peekNext();
    expect(peeked).toBe(g1);
    expect(engine.currentGroup).toBe(-1); // Did not advance
  });

  it("peekNext returns null when no more groups", () => {
    const g1 = makeGroup([makeStep({ elementId: "a" })]);
    const engine = new TimelineEngine(
      makeTimeline({ clickGroups: [g1] }),
    );
    engine.advance();
    expect(engine.peekNext()).toBeNull();
  });
});

// ==========================================================================
// Repeat count and auto-reverse
// ==========================================================================

describe("buildTimeline - repeat and auto-reverse", () => {
  it("generates CSS animation with repeat count", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        repeatCount: 3,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("3");
  });

  it("generates CSS animation with infinite repeat", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        repeatCount: Infinity,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("infinite");
  });

  it("generates CSS animation with auto-reverse (alternate direction)", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        autoReverse: true,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("alternate");
  });

  it("generates CSS animation with normal direction when autoReverse is false", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        autoReverse: false,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("normal");
  });

  it("combines repeat count and auto-reverse correctly", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        repeatCount: 5,
        autoReverse: true,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("5");
    expect(step.cssAnimation).toContain("alternate");
  });
});

// ==========================================================================
// Trigger delay
// ==========================================================================

describe("buildTimeline - trigger delay", () => {
  it("respects trigger delay for afterDelay animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 500,
        delayMs: 0,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterDelay",
        triggerDelayMs: 1000,
        delayMs: 0,
      } as PptxNativeAnimation),
    ]);
    const steps = result.clickGroups[0].steps;
    // afterDelay delay = prev.delay + prev.duration + animDelay + triggerDelay
    // = 0 + 500 + 0 + 1000 = 1500
    expect(steps[1].delayMs).toBe(1500);
  });

  it("respects trigger delay combined with animation delay", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 500,
        delayMs: 0,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterDelay",
        triggerDelayMs: 300,
        delayMs: 200,
      } as PptxNativeAnimation),
    ]);
    const steps = result.clickGroups[0].steps;
    // = 0 + 500 + 200 + 300 = 1000
    expect(steps[1].delayMs).toBe(1000);
  });

  it("respects delay for withPrevious animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 500,
        delayMs: 100,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "withPrevious",
        delayMs: 200,
        triggerDelayMs: 50,
      } as PptxNativeAnimation),
    ]);
    const steps = result.clickGroups[0].steps;
    // withPrevious delay = prev.delayMs + animDelay + triggerDelay
    // = 100 + 200 + 50 = 350
    expect(steps[1].delayMs).toBe(350);
  });
});

// ==========================================================================
// Complex animation sequences
// ==========================================================================

describe("buildTimeline - complex sequences", () => {
  it("handles mixed onClick, afterPrevious, and withPrevious in sequence", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick", durationMs: 500 }),
      makeAnim({ targetId: "el2", trigger: "withPrevious", durationMs: 300 }),
      makeAnim({ targetId: "el3", trigger: "afterPrevious", durationMs: 200 }),
      makeAnim({ targetId: "el4", trigger: "onClick", durationMs: 400 }),
    ]);

    expect(result.clickGroups).toHaveLength(2);

    // First group: el1 (onClick), el2 (withPrevious), el3 (afterPrevious)
    const g1 = result.clickGroups[0];
    expect(g1.steps).toHaveLength(3);
    expect(g1.steps[0].elementId).toBe("el1");
    expect(g1.steps[0].delayMs).toBe(0);
    expect(g1.steps[1].elementId).toBe("el2");
    expect(g1.steps[1].delayMs).toBe(0); // withPrevious = prev.delay + 0 = 0
    expect(g1.steps[2].elementId).toBe("el3");
    // afterPrevious: prev(el2).delayMs + prev(el2).durationMs = 0 + 300 = 300
    expect(g1.steps[2].delayMs).toBe(300);

    // Second group: el4 (onClick)
    const g2 = result.clickGroups[1];
    expect(g2.steps).toHaveLength(1);
    expect(g2.steps[0].elementId).toBe("el4");
  });

  it("computes totalDurationMs correctly for complex groups", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick", durationMs: 500, delayMs: 0 }),
      makeAnim({ targetId: "el2", trigger: "withPrevious", durationMs: 800, delayMs: 0 }),
      makeAnim({ targetId: "el3", trigger: "afterPrevious", durationMs: 200, delayMs: 0 }),
    ]);

    const g = result.clickGroups[0];
    // el1: 0 + 500 = 500
    // el2: 0 + 800 = 800
    // el3: afterPrevious from el2: delay = 0 + 800 = 800, end = 800 + 200 = 1000
    expect(g.totalDurationMs).toBe(1000);
  });

  it("handles interactive and hover sequences alongside regular animations", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({
        targetId: "el2",
        trigger: "onShapeClick",
        triggerShapeId: "btn1",
      } as PptxNativeAnimation),
      makeAnim({
        targetId: "el3",
        trigger: "onHover",
      }),
    ]);

    expect(result.clickGroups).toHaveLength(1);
    expect(result.interactiveSequences.has("btn1")).toBe(true);
    expect(result.hoverSequences.has("el3")).toBe(true);
  });
});

// ==========================================================================
// Motion path with cubic bezier curves
// ==========================================================================

describe("buildTimeline - motion path cubic bezier", () => {
  it("parses cubic bezier (C) commands in motion paths", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        motionPath: "M 0 0 C 0.25 0.1 0.25 1 1 1",
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-motion-");
    expect(result.keyframesCss).toContain("translate(");
  });

  it("handles motion path with Z (close path) command", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        motionPath: "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-motion-");
    // Z is skipped, so we have 4 points (M, 3x L)
  });
});

// ==========================================================================
// Color animations
// ==========================================================================

describe("buildTimeline - color animations", () => {
  it("generates dynamic keyframes for color animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        colorAnimation: {
          colorSpace: "rgb",
          fromColor: "#ff0000",
          toColor: "#0000ff",
          targetAttribute: "fillcolor",
        },
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-color-");
    expect(result.keyframesCss).toContain("backgroundColor");
  });
});

// ==========================================================================
// Property animations (scale, rotation)
// ==========================================================================

describe("buildTimeline - property animations", () => {
  it("generates scale keyframes", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        scaleByX: 2.0,
        scaleByY: 1.5,
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-scale-");
    expect(result.keyframesCss).toContain("scale(2, 1.5)");
  });

  it("generates rotation keyframes", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        rotationBy: 180,
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-rotate-");
    expect(result.keyframesCss).toContain("rotate(180deg)");
  });
});

// ==========================================================================
// Empty timeline edge cases
// ==========================================================================

describe("buildTimeline - edge cases", () => {
  it("returns empty timeline with hoverSequences for empty input", () => {
    const result = buildTimeline([]);
    expect(result.clickGroups).toEqual([]);
    expect(result.entranceElementIds.size).toBe(0);
    expect(result.keyframesCss).toBe("");
    expect(result.interactiveSequences.size).toBe(0);
    expect(result.hoverSequences.size).toBe(0);
  });

  it("handles animation with undefined targetId", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: undefined,
        trigger: "onClick",
      } as PptxNativeAnimation),
    ]);
    // Should still create a group (targetId defaults to "")
    expect(result.clickGroups).toHaveLength(1);
  });

  it("handles animation with undefined duration", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: undefined,
      } as PptxNativeAnimation),
    ]);
    // Should use default duration
    expect(result.clickGroups[0].steps[0].durationMs).toBe(500);
  });

  it("handles all-hover animation slide (no click groups)", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 26,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 8,
      }),
    ]);
    expect(result.clickGroups).toHaveLength(0);
    expect(result.hoverSequences.size).toBe(2);
  });
});

// ==========================================================================
// TimelineEngine - integration with buildTimeline
// ==========================================================================

describe("TimelineEngine.fromAnimations - integration", () => {
  it("builds engine with hover sequences", () => {
    const engine = TimelineEngine.fromAnimations([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({
        targetId: "el2",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 26,
      }),
    ]);

    expect(engine.totalGroups).toBe(1);
    expect(engine.hasHoverSequence("el2")).toBe(true);
    expect(engine.hasInteractiveSequence("el2")).toBe(false);
  });

  it("builds engine with interactive and hover sequences", () => {
    const engine = TimelineEngine.fromAnimations([
      makeAnim({
        targetId: "el1",
        trigger: "onShapeClick",
        triggerShapeId: "btn1",
      } as PptxNativeAnimation),
      makeAnim({
        targetId: "el2",
        trigger: "onHover",
        presetClass: "emph",
        presetId: 26,
      }),
    ]);

    expect(engine.hasInteractiveSequence("btn1")).toBe(true);
    expect(engine.hasHoverSequence("el2")).toBe(true);
  });
});
