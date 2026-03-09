import { describe, it, expect } from "vitest";
import { P14_TRANSITION_KEYFRAMES_2 } from "./p14-transition-keyframes-2";

describe("P14_TRANSITION_KEYFRAMES_2", () => {
  // -------------------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------------------
  describe("basic structure", () => {
    it("is a non-empty string", () => {
      expect(typeof P14_TRANSITION_KEYFRAMES_2).toBe("string");
      expect(P14_TRANSITION_KEYFRAMES_2.length).toBeGreaterThan(0);
    });

    it("contains @keyframes declarations", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("@keyframes");
    });

    it('contains "from" and "to" keywords for CSS animation blocks', () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("from");
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("to");
    });
  });

  // -------------------------------------------------------------------
  // Prism keyframes (3D perspective transforms)
  // -------------------------------------------------------------------
  describe("prism keyframes", () => {
    it("contains pptx-tr-prism-in-from-right", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-prism-in-from-right",
      );
    });

    it("contains pptx-tr-prism-out-to-left", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-prism-out-to-left",
      );
    });

    it("contains pptx-tr-prism-in-from-left", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-prism-in-from-left",
      );
    });

    it("contains pptx-tr-prism-in-from-bottom", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-prism-in-from-bottom",
      );
    });

    it("contains pptx-tr-prism-in-from-top", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-prism-in-from-top",
      );
    });

    it("uses perspective() transforms for 3D prism effect", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("perspective(800px)");
    });

    it("uses rotateY for horizontal prism variants", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("rotateY(");
    });

    it("uses rotateX for vertical prism variants", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("rotateX(");
    });
  });

  // -------------------------------------------------------------------
  // Reveal keyframes
  // -------------------------------------------------------------------
  describe("reveal keyframes", () => {
    it("contains pptx-tr-reveal-out-to-right", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-reveal-out-to-right",
      );
    });

    it("contains pptx-tr-reveal-out-to-left", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-reveal-out-to-left",
      );
    });

    it("contains pptx-tr-reveal-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-reveal-in",
      );
    });
  });

  // -------------------------------------------------------------------
  // Ripple keyframes (clip-path circle)
  // -------------------------------------------------------------------
  describe("ripple keyframes", () => {
    it("contains pptx-tr-ripple-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-ripple-in",
      );
    });

    it("uses clip-path circle for ripple effect", () => {
      // Ripple uses clip-path: circle(...)
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("clip-path: circle(");
    });
  });

  // -------------------------------------------------------------------
  // Shred keyframes (clip-path fragmentation)
  // -------------------------------------------------------------------
  describe("shred keyframes", () => {
    it("contains pptx-tr-shred-strips-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-shred-strips-in",
      );
    });

    it("contains pptx-tr-shred-rectangles-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-shred-rectangles-in",
      );
    });

    it("contains pptx-tr-shred-out", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-shred-out",
      );
    });

    it("uses clip-path for shred fragmentation", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("clip-path: inset(");
    });
  });

  // -------------------------------------------------------------------
  // Vortex keyframes (rotate + scale)
  // -------------------------------------------------------------------
  describe("vortex keyframes", () => {
    it("contains pptx-tr-vortex-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-vortex-in",
      );
    });

    it("contains pptx-tr-vortex-out", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-vortex-out",
      );
    });

    it("uses rotate(720deg) for vortex spiral effect", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("rotate(720deg)");
    });
  });

  // -------------------------------------------------------------------
  // Warp keyframes (skew distortion)
  // -------------------------------------------------------------------
  describe("warp keyframes", () => {
    it("contains pptx-tr-warp-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-warp-in",
      );
    });

    it("contains pptx-tr-warp-out", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-warp-out",
      );
    });

    it("contains pptx-tr-warp-reverse-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-warp-reverse-in",
      );
    });

    it("contains pptx-tr-warp-reverse-out", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-warp-reverse-out",
      );
    });

    it("uses skewX and skewY for warp distortion", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("skewX(");
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("skewY(");
    });
  });

  // -------------------------------------------------------------------
  // Window keyframes
  // -------------------------------------------------------------------
  describe("window keyframes", () => {
    it("contains pptx-tr-window-horz", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-window-horz",
      );
    });

    it("contains pptx-tr-window-vert", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-window-vert",
      );
    });

    it("contains pptx-tr-window-out", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-window-out",
      );
    });
  });

  // -------------------------------------------------------------------
  // Switch keyframes
  // -------------------------------------------------------------------
  describe("switch keyframes", () => {
    it("contains pptx-tr-switch-in-from-right", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-switch-in-from-right",
      );
    });

    it("contains pptx-tr-switch-out-to-left", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-switch-out-to-left",
      );
    });
  });

  // -------------------------------------------------------------------
  // WheelReverse keyframe
  // -------------------------------------------------------------------
  describe("wheelReverse keyframe", () => {
    it("contains pptx-tr-wheel-reverse-in", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain(
        "@keyframes pptx-tr-wheel-reverse-in",
      );
    });
  });

  // -------------------------------------------------------------------
  // CSS property coverage
  // -------------------------------------------------------------------
  describe("CSS property coverage", () => {
    it("contains opacity properties", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("opacity");
    });

    it("contains transform properties", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("transform:");
    });

    it("contains filter properties for blur effects", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("filter:");
    });

    it("contains scale() transforms", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("scale(");
    });

    it("contains translateX and translateY", () => {
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("translateX(");
      expect(P14_TRANSITION_KEYFRAMES_2).toContain("translateY(");
    });
  });
});
