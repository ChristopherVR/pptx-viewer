import { describe, it, expect } from "vitest";
import { buildTimeline } from "./animation-timeline-builder";
import type { PptxNativeAnimation } from "pptx-viewer-core";

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

describe("buildTimeline", () => {
  // -------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------
  it("returns empty timeline for no animations", () => {
    const result = buildTimeline([]);
    expect(result.clickGroups).toEqual([]);
    expect(result.entranceElementIds.size).toBe(0);
    expect(result.keyframesCss).toBe("");
    expect(result.interactiveSequences.size).toBe(0);
    expect(result.hoverSequences.size).toBe(0);
  });

  // -------------------------------------------------------------------
  // Single animation
  // -------------------------------------------------------------------
  it("creates a single click-group from one onClick animation", () => {
    const result = buildTimeline([makeAnim()]);
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps).toHaveLength(1);
    expect(result.clickGroups[0].steps[0].elementId).toBe("el1");
  });

  it("tracks entrance element IDs", () => {
    const result = buildTimeline([makeAnim({ presetClass: "entr" })]);
    expect(result.entranceElementIds.has("el1")).toBe(true);
  });

  it("does not track exit elements as entrance", () => {
    const result = buildTimeline([
      makeAnim({ presetClass: "exit", presetId: 10 }),
    ]);
    expect(result.entranceElementIds.has("el1")).toBe(false);
  });

  it("does not track emphasis elements as entrance", () => {
    const result = buildTimeline([
      makeAnim({ presetClass: "emph", presetId: 26 }),
    ]);
    expect(result.entranceElementIds.has("el1")).toBe(false);
  });

  // -------------------------------------------------------------------
  // Multiple onClick animations create separate click-groups
  // -------------------------------------------------------------------
  it("creates separate click-groups for multiple onClick animations", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({ targetId: "el2", trigger: "onClick" }),
      makeAnim({ targetId: "el3", trigger: "onClick" }),
    ]);
    expect(result.clickGroups).toHaveLength(3);
  });

  // -------------------------------------------------------------------
  // withPrevious stays in same click-group
  // -------------------------------------------------------------------
  it("keeps withPrevious animations in the same click-group", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({ targetId: "el2", trigger: "withPrevious" }),
    ]);
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps).toHaveLength(2);
  });

  it("computes withPrevious delay relative to previous step delay", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick", delayMs: 100 }),
      makeAnim({ targetId: "el2", trigger: "withPrevious", delayMs: 50 }),
    ]);
    const steps = result.clickGroups[0].steps;
    // withPrevious delay = prev.delayMs + animDelay + triggerDelay
    // = 100 + 50 + 0 = 150
    expect(steps[1].delayMs).toBe(150);
  });

  // -------------------------------------------------------------------
  // afterPrevious stays in same click-group, delayed
  // -------------------------------------------------------------------
  it("keeps afterPrevious animations in the same click-group", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({ targetId: "el2", trigger: "afterPrevious" }),
    ]);
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps).toHaveLength(2);
  });

  it("computes afterPrevious delay as prev.delay + prev.duration", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        delayMs: 0,
        durationMs: 500,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterPrevious",
        delayMs: 0,
      }),
    ]);
    const steps = result.clickGroups[0].steps;
    // afterPrevious delay = prev.delayMs + prev.durationMs + animDelay + triggerDelay
    // = 0 + 500 + 0 + 0 = 500
    expect(steps[1].delayMs).toBe(500);
  });

  // -------------------------------------------------------------------
  // First animation starts implicit click-group regardless of trigger
  // -------------------------------------------------------------------
  it("creates implicit click-group for first withPrevious animation", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "withPrevious" }),
    ]);
    expect(result.clickGroups).toHaveLength(1);
    expect(result.clickGroups[0].steps).toHaveLength(1);
  });

  it("creates implicit click-group for first afterPrevious animation", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "afterPrevious" }),
    ]);
    expect(result.clickGroups).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // afterDelay trigger
  // -------------------------------------------------------------------
  it("handles afterDelay trigger with triggerDelayMs", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        delayMs: 0,
        durationMs: 500,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterDelay",
        triggerDelayMs: 200,
        delayMs: 0,
      } as PptxNativeAnimation),
    ]);
    const steps = result.clickGroups[0].steps;
    // afterDelay delay = prev.delayMs + prev.durationMs + animDelay + triggerDelay
    // = 0 + 500 + 0 + 200 = 700
    expect(steps[1].delayMs).toBe(700);
  });

  // -------------------------------------------------------------------
  // CSS animation string format
  // -------------------------------------------------------------------
  it("generates correct CSS animation shorthand", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 1000,
        delayMs: 0,
      }),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("pptx-fadeIn");
    expect(step.cssAnimation).toContain("1000ms");
    expect(step.cssAnimation).toContain("ease");
    expect(step.cssAnimation).toContain("both");
  });

  it("includes iteration count and direction in CSS animation", () => {
    const result = buildTimeline([
      makeAnim({
        repeatCount: 3,
        autoReverse: true,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("3");
    expect(step.cssAnimation).toContain("alternate");
  });

  it("uses 'infinite' for infinite repeat count", () => {
    const result = buildTimeline([
      makeAnim({
        repeatCount: Infinity,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.cssAnimation).toContain("infinite");
  });

  // -------------------------------------------------------------------
  // Keyframes CSS generation
  // -------------------------------------------------------------------
  it("generates keyframesCss for known effects", () => {
    const result = buildTimeline([makeAnim({ presetId: 10 })]);
    expect(result.keyframesCss).toContain("@keyframes");
    expect(result.keyframesCss).toContain("pptx-fadeIn");
  });

  it("generates unique keyframes CSS without duplicates", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", presetId: 10 }),
      makeAnim({ targetId: "el2", presetId: 10, trigger: "onClick" }),
    ]);
    const matches = result.keyframesCss.match(/@keyframes pptx-fadeIn/g);
    // Should only have one definition even though two animations use it
    expect(matches).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // Click-group totalDurationMs
  // -------------------------------------------------------------------
  it("computes totalDurationMs for click-group correctly", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        durationMs: 500,
        delayMs: 0,
      }),
      makeAnim({
        targetId: "el2",
        trigger: "afterPrevious",
        durationMs: 300,
        delayMs: 0,
      }),
    ]);
    // el1: ends at 500, el2: starts at 500, ends at 800
    expect(result.clickGroups[0].totalDurationMs).toBe(800);
  });

  // -------------------------------------------------------------------
  // Fill mode
  // -------------------------------------------------------------------
  it("sets fill mode to 'both' for entrance animations", () => {
    const result = buildTimeline([makeAnim({ presetClass: "entr" })]);
    expect(result.clickGroups[0].steps[0].fillMode).toBe("both");
  });

  it("sets fill mode to 'forwards' for exit animations", () => {
    const result = buildTimeline([
      makeAnim({ presetClass: "exit", presetId: 10 }),
    ]);
    expect(result.clickGroups[0].steps[0].fillMode).toBe("forwards");
  });

  // -------------------------------------------------------------------
  // Interactive sequences (onShapeClick)
  // -------------------------------------------------------------------
  it("separates onShapeClick animations into interactive sequences", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({
        targetId: "el2",
        trigger: "onShapeClick",
        triggerShapeId: "shape1",
      } as PptxNativeAnimation),
    ]);
    expect(result.clickGroups).toHaveLength(1);
    expect(result.interactiveSequences.has("shape1")).toBe(true);
    const seqGroups = result.interactiveSequences.get("shape1")!;
    expect(seqGroups.length).toBeGreaterThanOrEqual(1);
    expect(seqGroups[0].steps[0].elementId).toBe("el2");
  });

  it("groups multiple interactive animations under same trigger shape", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onShapeClick",
        triggerShapeId: "btn1",
      } as PptxNativeAnimation),
      makeAnim({
        targetId: "el2",
        trigger: "onShapeClick",
        triggerShapeId: "btn1",
      } as PptxNativeAnimation),
    ]);
    expect(result.interactiveSequences.has("btn1")).toBe(true);
    const seqGroups = result.interactiveSequences.get("btn1")!;
    // Both animations should be in the same sequence
    const totalSteps = seqGroups.reduce(
      (sum, g) => sum + g.steps.length,
      0,
    );
    expect(totalSteps).toBe(2);
  });

  // -------------------------------------------------------------------
  // Dynamic keyframes (motion path)
  // -------------------------------------------------------------------
  it("generates dynamic keyframes for motion path animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        motionPath: "M 0 0 L 1 1",
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-motion-");
    expect(result.keyframesCss).toContain("translate(");
  });

  it("generates dynamic keyframes for rotation animations", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        trigger: "onClick",
        presetClass: undefined,
        presetId: undefined,
        rotationBy: 360,
      } as PptxNativeAnimation),
    ]);
    expect(result.keyframesCss).toContain("@keyframes pptx-tl-rotate-");
    expect(result.keyframesCss).toContain("rotate(360deg)");
  });

  // -------------------------------------------------------------------
  // onHover trigger goes to hover sequences (not click-groups)
  // -------------------------------------------------------------------
  it("separates onHover animations into hover sequences", () => {
    const result = buildTimeline([
      makeAnim({ targetId: "el1", trigger: "onClick" }),
      makeAnim({ targetId: "el2", trigger: "onHover" as any }),
    ]);
    // el1 in click-groups, el2 in hover sequences
    expect(result.clickGroups).toHaveLength(1);
    expect(result.hoverSequences.has("el2")).toBe(true);
  });

  // -------------------------------------------------------------------
  // Sound properties
  // -------------------------------------------------------------------
  it("passes through sound properties on timeline steps", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        soundPath: "media/click.wav",
        stopSound: true,
      } as PptxNativeAnimation),
    ]);
    const step = result.clickGroups[0].steps[0];
    expect(step.soundPath).toBe("media/click.wav");
    expect(step.stopSound).toBe(true);
  });

  // -------------------------------------------------------------------
  // Default duration when durationMs is not specified
  // -------------------------------------------------------------------
  it("uses default duration when durationMs is not provided", () => {
    const result = buildTimeline([
      makeAnim({
        targetId: "el1",
        presetClass: "emph",
        presetId: 26, // pulse
        durationMs: undefined,
      } as PptxNativeAnimation),
    ]);
    // default for emph is 800ms
    expect(result.clickGroups[0].steps[0].durationMs).toBe(800);
  });
});
