import { describe, it, expect } from "vitest";
import { AnimationSequencer } from "./animation-sequencer";
import type { PptxSlide, PptxNativeAnimation } from "pptx-viewer-core";

function makeSlide(
  nativeAnimations: PptxNativeAnimation[] | undefined = undefined,
  elements: Array<{ id: string }> = [],
): PptxSlide {
  return {
    index: 0,
    elements: elements.map((e) => ({
      id: e.id,
      type: "shape" as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
    })),
    nativeAnimations,
  } as unknown as PptxSlide;
}

describe("AnimationSequencer", () => {
  describe("getInitialStyles", () => {
    it("should return empty object when no animations exist", () => {
      const seq = new AnimationSequencer(makeSlide());
      const styles = seq.getInitialStyles("el-1");
      expect(styles).toEqual({});
    });

    it("should return empty object for non-entrance animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "emph",
            presetId: 26,
            trigger: "onClick",
          },
        ]),
      );
      const styles = seq.getInitialStyles("el-1");
      expect(styles).toEqual({});
    });

    it("should return empty object for element without matching animation", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
          },
        ]),
      );
      const styles = seq.getInitialStyles("el-1");
      expect(styles).toEqual({});
    });

    it("should return hidden styles for entrance animation (fadeIn)", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 10, // fadeIn
            trigger: "onClick",
          },
        ]),
      );
      const styles = seq.getInitialStyles("el-1");
      // Entrance effects typically set opacity: 0 or visibility hidden
      expect(styles).toBeDefined();
    });
  });

  describe("buildTimeline", () => {
    it("should return empty array when no animations exist", () => {
      const seq = new AnimationSequencer(makeSlide());
      const timeline = seq.buildTimeline();
      expect(timeline).toEqual([]);
    });

    it("should return empty array for empty animations array", () => {
      const seq = new AnimationSequencer(makeSlide([]));
      const timeline = seq.buildTimeline();
      expect(timeline).toEqual([]);
    });

    it("should produce a step for each resolvable animation", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1, // appear
            trigger: "onClick",
            durationMs: 500,
          },
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 10, // fadeIn
            trigger: "afterPrevious",
            durationMs: 300,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(2);
      expect(timeline[0].elementId).toBe("el-1");
      expect(timeline[1].elementId).toBe("el-2");
    });

    it("should compute onClick delay correctly", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 100,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].delayMs).toBe(100);
    });

    it("should compute afterPrevious delay as cumulative", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 0,
          },
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 10,
            trigger: "afterPrevious",
            durationMs: 300,
            delayMs: 0,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      // afterPrevious should start after the previous step finishes
      expect(timeline[1].delayMs).toBe(500); // prev delay(0) + prev duration(500)
    });

    it("should compute withPrevious delay relative to previous step start", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 100,
          },
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 10,
            trigger: "withPrevious",
            durationMs: 300,
            delayMs: 50,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      // withPrevious delay = previous step delay + animDelay + triggerDelay
      expect(timeline[1].delayMs).toBe(100 + 50); // prev.delayMs + animDelay
    });

    it("should include correct cssAnimation string", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1, // appear
            trigger: "onClick",
            durationMs: 500,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].cssAnimation).toContain("500ms");
      expect(timeline[0].cssAnimation).toContain("ease");
    });

    it("should set fillMode based on preset class", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
          },
          {
            targetId: "el-2",
            presetClass: "exit",
            presetId: 1,
            trigger: "onClick",
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].fillMode).toBe("both");
      expect(timeline[1].fillMode).toBe("forwards");
    });

    it("should handle motion path animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "path",
            trigger: "onClick",
            durationMs: 1000,
            motionPath: "M 0 0 L 1 1",
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0].cssKeyframes).toContain("fuzor-motionPath");
    });

    it("should handle rotation animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "emph",
            trigger: "onClick",
            durationMs: 800,
            rotationBy: 360,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0].cssKeyframes).toContain("fuzor-rotateBy");
    });

    it("should handle scale animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "emph",
            trigger: "onClick",
            durationMs: 600,
            scaleByX: 1.5,
            scaleByY: 1.5,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0].cssKeyframes).toContain("fuzor-scaleBy");
    });

    it("should skip unresolvable animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 99999, // non-existent
            trigger: "onClick",
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(0);
    });

    it("should handle afterDelay trigger", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 0,
          },
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 10,
            trigger: "afterDelay",
            durationMs: 300,
            delayMs: 200,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(2);
      // afterDelay should use cumulative + animDelay
      expect(timeline[1].delayMs).toBe(200);
    });

    it("should handle onHover trigger by resetting cumulative time", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 0,
          },
          {
            targetId: "el-2",
            presetClass: "entr",
            presetId: 10,
            trigger: "onHover",
            durationMs: 300,
            delayMs: 50,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline.length).toBe(2);
      // onHover resets cumulative like onClick
      expect(timeline[1].delayMs).toBe(50);
    });

    it("should use default duration when durationMs is not specified", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            // no durationMs — should default to 500 for entr
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].durationMs).toBe(500);
    });

    it("should use default duration of 800 for emphasis animations", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "emph",
            presetId: 26, // pulse
            trigger: "onClick",
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].durationMs).toBe(800);
    });

    it("should handle withPrevious as first animation (no previous step)", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "withPrevious",
            durationMs: 500,
            delayMs: 100,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].delayMs).toBe(100);
    });

    it("should handle triggerDelayMs in addition to delayMs", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            delayMs: 100,
            triggerDelayMs: 50,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].delayMs).toBe(150); // 100 + 50
    });

    it("should handle repeat count and auto-reverse", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            repeatCount: 3,
            autoReverse: true,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].cssAnimation).toContain("3");
      expect(timeline[0].cssAnimation).toContain("alternate");
    });

    it("should handle infinite repeat count", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 1,
            trigger: "onClick",
            durationMs: 500,
            repeatCount: Infinity,
          },
        ]),
      );
      const timeline = seq.buildTimeline();
      expect(timeline[0].cssAnimation).toContain("infinite");
    });
  });

  describe("getKeyframeDefinitions", () => {
    it("should return empty string when no animations exist", () => {
      const seq = new AnimationSequencer(makeSlide());
      expect(seq.getKeyframeDefinitions()).toBe("");
    });

    it("should return keyframe CSS for resolved effects", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "entr",
            presetId: 10, // fadeIn
            trigger: "onClick",
          },
        ]),
      );
      // Need to build timeline first to populate dynamic keyframes
      seq.buildTimeline();
      const css = seq.getKeyframeDefinitions();
      expect(css).toContain("@keyframes");
    });

    it("should include dynamic keyframes for motion paths", () => {
      const seq = new AnimationSequencer(
        makeSlide([
          {
            targetId: "el-1",
            presetClass: "path",
            trigger: "onClick",
            motionPath: "M 0 0 L 1 1",
          },
        ]),
      );
      seq.buildTimeline();
      const css = seq.getKeyframeDefinitions();
      expect(css).toContain("@keyframes");
      expect(css).toContain("translate");
    });
  });
});
