import { describe, it, expect, beforeEach } from "vitest";
import { TimelineEngine } from "./animation-timeline-engine";
import type {
  AnimationTimeline,
  TimelineClickGroup,
  TimelineStep,
} from "./animation-timeline-types";

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

function makeGroup(steps: TimelineStep[]): TimelineClickGroup {
  let maxEnd = 0;
  for (const step of steps) {
    const end = step.delayMs + step.durationMs;
    if (end > maxEnd) maxEnd = end;
  }
  return { steps, totalDurationMs: maxEnd };
}

function makeTimeline(overrides: Partial<AnimationTimeline> = {}): AnimationTimeline {
  return {
    clickGroups: [],
    entranceElementIds: new Set(),
    keyframesCss: "",
    interactiveSequences: new Map(),
    hoverSequences: new Map(),
    ...overrides,
  };
}

describe("TimelineEngine", () => {
  describe("initial state", () => {
    it("should start with currentGroup at -1", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.currentGroup).toBe(-1);
    });

    it("should report totalGroups as 0 for empty timeline", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.totalGroups).toBe(0);
    });

    it("should report hasMoreSteps as false for empty timeline", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.hasMoreSteps()).toBe(false);
    });

    it("should return the timeline via getTimeline", () => {
      const timeline = makeTimeline({ keyframesCss: "test-css" });
      const engine = new TimelineEngine(timeline);
      expect(engine.getTimeline()).toBe(timeline);
    });
  });

  describe("advance", () => {
    it("should return null when no groups exist", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.advance()).toBeNull();
    });

    it("should advance to the first group and return it", () => {
      const step = makeStep();
      const group = makeGroup([step]);
      const engine = new TimelineEngine(makeTimeline({ clickGroups: [group] }));

      const result = engine.advance();
      expect(result).toBe(group);
      expect(engine.currentGroup).toBe(0);
    });

    it("should advance through multiple groups sequentially", () => {
      const g1 = makeGroup([makeStep({ elementId: "a" })]);
      const g2 = makeGroup([makeStep({ elementId: "b" })]);
      const g3 = makeGroup([makeStep({ elementId: "c" })]);
      const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1, g2, g3] }));

      expect(engine.advance()).toBe(g1);
      expect(engine.currentGroup).toBe(0);
      expect(engine.advance()).toBe(g2);
      expect(engine.currentGroup).toBe(1);
      expect(engine.advance()).toBe(g3);
      expect(engine.currentGroup).toBe(2);
      expect(engine.advance()).toBeNull();
    });

    it("should return null once all groups are consumed", () => {
      const g = makeGroup([makeStep()]);
      const engine = new TimelineEngine(makeTimeline({ clickGroups: [g] }));
      engine.advance();
      expect(engine.advance()).toBeNull();
      expect(engine.advance()).toBeNull();
    });

    it("should track entrance animations after advance", () => {
      const step = makeStep({ elementId: "el-1", presetClass: "entr" });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([step])],
          entranceElementIds: new Set(["el-1"]),
        }),
      );

      expect(engine.isElementVisible("el-1")).toBe(false);
      engine.advance();
      expect(engine.isElementVisible("el-1")).toBe(true);
    });

    it("should track exit animations after advance", () => {
      const step = makeStep({ elementId: "el-1", presetClass: "exit" });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([step])],
        }),
      );

      expect(engine.isElementVisible("el-1")).toBe(true);
      engine.advance();
      expect(engine.isElementVisible("el-1")).toBe(false);
    });

    it("should store cssAnimation for the element", () => {
      const step = makeStep({
        elementId: "el-1",
        cssAnimation: "pptx-fadeIn 500ms ease",
      });
      const engine = new TimelineEngine(
        makeTimeline({ clickGroups: [makeGroup([step])] }),
      );

      expect(engine.getElementAnimation("el-1")).toBeUndefined();
      engine.advance();
      expect(engine.getElementAnimation("el-1")).toBe("pptx-fadeIn 500ms ease");
    });
  });

  describe("hasMoreSteps", () => {
    it("should return true when groups remain", () => {
      const engine = new TimelineEngine(
        makeTimeline({ clickGroups: [makeGroup([makeStep()]), makeGroup([makeStep()])] }),
      );
      expect(engine.hasMoreSteps()).toBe(true);
      engine.advance();
      expect(engine.hasMoreSteps()).toBe(true);
      engine.advance();
      expect(engine.hasMoreSteps()).toBe(false);
    });
  });

  describe("isElementVisible", () => {
    it("should return true for elements without entrance animations", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.isElementVisible("no-anim-element")).toBe(true);
    });

    it("should return false for entrance elements that haven't played", () => {
      const engine = new TimelineEngine(
        makeTimeline({ entranceElementIds: new Set(["el-1"]) }),
      );
      expect(engine.isElementVisible("el-1")).toBe(false);
    });

    it("should return true for entrance elements after their group plays", () => {
      const step = makeStep({ elementId: "el-1", presetClass: "entr" });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([step])],
          entranceElementIds: new Set(["el-1"]),
        }),
      );
      engine.advance();
      expect(engine.isElementVisible("el-1")).toBe(true);
    });

    it("should return false for exited elements even without entrance tracking", () => {
      const step = makeStep({ elementId: "el-1", presetClass: "exit" });
      const engine = new TimelineEngine(
        makeTimeline({ clickGroups: [makeGroup([step])] }),
      );
      engine.advance();
      expect(engine.isElementVisible("el-1")).toBe(false);
    });

    it("should prioritize exit over entrance", () => {
      // Element has both entrance and exit
      const entrStep = makeStep({ elementId: "el-1", presetClass: "entr" });
      const exitStep = makeStep({ elementId: "el-1", presetClass: "exit" });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([entrStep]), makeGroup([exitStep])],
          entranceElementIds: new Set(["el-1"]),
        }),
      );

      expect(engine.isElementVisible("el-1")).toBe(false); // entrance not played
      engine.advance(); // entrance
      expect(engine.isElementVisible("el-1")).toBe(true);
      engine.advance(); // exit
      expect(engine.isElementVisible("el-1")).toBe(false);
    });
  });

  describe("getElementStates", () => {
    it("should return states for all requested element IDs", () => {
      const engine = new TimelineEngine(
        makeTimeline({ entranceElementIds: new Set(["el-1"]) }),
      );

      const states = engine.getElementStates(["el-1", "el-2"]);
      expect(states.size).toBe(2);
      expect(states.get("el-1")!.visible).toBe(false);
      expect(states.get("el-1")!.cssAnimation).toBeUndefined();
      expect(states.get("el-2")!.visible).toBe(true);
      expect(states.get("el-2")!.cssAnimation).toBeUndefined();
    });

    it("should include css animation after advance", () => {
      const step = makeStep({
        elementId: "el-1",
        presetClass: "entr",
        cssAnimation: "pptx-fadeIn 500ms ease",
      });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([step])],
          entranceElementIds: new Set(["el-1"]),
        }),
      );
      engine.advance();

      const states = engine.getElementStates(["el-1"]);
      expect(states.get("el-1")!.visible).toBe(true);
      expect(states.get("el-1")!.cssAnimation).toBe("pptx-fadeIn 500ms ease");
    });
  });

  describe("interactive sequences", () => {
    it("should detect interactive sequence triggers", () => {
      const interactiveSequences = new Map<string, TimelineClickGroup[]>();
      interactiveSequences.set("shape-1", [makeGroup([makeStep()])]);

      const engine = new TimelineEngine(
        makeTimeline({ interactiveSequences }),
      );

      expect(engine.hasInteractiveSequence("shape-1")).toBe(true);
      expect(engine.hasInteractiveSequence("shape-2")).toBe(false);
    });

    it("should return interactive trigger shape IDs", () => {
      const interactiveSequences = new Map<string, TimelineClickGroup[]>();
      interactiveSequences.set("shape-1", [makeGroup([makeStep()])]);
      interactiveSequences.set("shape-2", [makeGroup([makeStep()])]);

      const engine = new TimelineEngine(
        makeTimeline({ interactiveSequences }),
      );

      const ids = engine.getInteractiveTriggerShapeIds();
      expect(ids.has("shape-1")).toBe(true);
      expect(ids.has("shape-2")).toBe(true);
      expect(ids.size).toBe(2);
    });

    it("should advance interactive sequences independently", () => {
      const iStep1 = makeStep({ elementId: "i-el-1", presetClass: "entr" });
      const iStep2 = makeStep({ elementId: "i-el-2", presetClass: "entr" });
      const interactiveSequences = new Map<string, TimelineClickGroup[]>();
      interactiveSequences.set("btn", [makeGroup([iStep1]), makeGroup([iStep2])]);

      const engine = new TimelineEngine(
        makeTimeline({
          entranceElementIds: new Set(["i-el-1", "i-el-2"]),
          interactiveSequences,
        }),
      );

      expect(engine.isElementVisible("i-el-1")).toBe(false);
      const g1 = engine.advanceInteractive("btn");
      expect(g1).not.toBeNull();
      expect(engine.isElementVisible("i-el-1")).toBe(true);
      expect(engine.isElementVisible("i-el-2")).toBe(false);

      const g2 = engine.advanceInteractive("btn");
      expect(g2).not.toBeNull();
      expect(engine.isElementVisible("i-el-2")).toBe(true);

      // No more groups
      expect(engine.advanceInteractive("btn")).toBeNull();
    });

    it("should return null for non-existent interactive trigger", () => {
      const engine = new TimelineEngine(makeTimeline());
      expect(engine.advanceInteractive("no-such-shape")).toBeNull();
    });
  });

  describe("reset", () => {
    it("should restore engine to initial state", () => {
      const step = makeStep({ elementId: "el-1", presetClass: "entr" });
      const engine = new TimelineEngine(
        makeTimeline({
          clickGroups: [makeGroup([step])],
          entranceElementIds: new Set(["el-1"]),
        }),
      );

      engine.advance();
      expect(engine.currentGroup).toBe(0);
      expect(engine.isElementVisible("el-1")).toBe(true);
      expect(engine.getElementAnimation("el-1")).toBeDefined();

      engine.reset();
      expect(engine.currentGroup).toBe(-1);
      expect(engine.isElementVisible("el-1")).toBe(false);
      expect(engine.getElementAnimation("el-1")).toBeUndefined();
      expect(engine.hasMoreSteps()).toBe(true);
    });

    it("should allow re-advancing after reset", () => {
      const g = makeGroup([makeStep()]);
      const engine = new TimelineEngine(makeTimeline({ clickGroups: [g] }));

      engine.advance();
      expect(engine.hasMoreSteps()).toBe(false);

      engine.reset();
      expect(engine.hasMoreSteps()).toBe(true);
      expect(engine.advance()).toBe(g);
    });

    it("should also reset interactive sequence state", () => {
      const iStep = makeStep({ elementId: "i-el", presetClass: "entr" });
      const interactiveSequences = new Map<string, TimelineClickGroup[]>();
      interactiveSequences.set("btn", [makeGroup([iStep])]);

      const engine = new TimelineEngine(
        makeTimeline({
          entranceElementIds: new Set(["i-el"]),
          interactiveSequences,
        }),
      );

      engine.advanceInteractive("btn");
      expect(engine.isElementVisible("i-el")).toBe(true);
      expect(engine.advanceInteractive("btn")).toBeNull();

      engine.reset();
      expect(engine.isElementVisible("i-el")).toBe(false);
      // Can advance again
      expect(engine.advanceInteractive("btn")).not.toBeNull();
    });
  });
});
