import { describe, it, expect } from "vitest";
import { SLIDE_TRANSITION_KEYFRAMES } from "./transition-keyframes";

describe("SLIDE_TRANSITION_KEYFRAMES", () => {
  // -------------------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------------------
  describe("basic structure", () => {
    it("is a non-empty string", () => {
      expect(typeof SLIDE_TRANSITION_KEYFRAMES).toBe("string");
      expect(SLIDE_TRANSITION_KEYFRAMES.length).toBeGreaterThan(0);
    });

    it('contains "from" and "to" keywords', () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("from");
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("to");
    });

    it("contains @keyframes declarations", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("@keyframes");
    });
  });

  // -------------------------------------------------------------------
  // Fade keyframes
  // -------------------------------------------------------------------
  describe("fade keyframes", () => {
    it("contains pptx-tr-fade-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-fade-in",
      );
    });

    it("contains pptx-tr-fade-out keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-fade-out",
      );
    });
  });

  // -------------------------------------------------------------------
  // Push keyframes
  // -------------------------------------------------------------------
  describe("push keyframes", () => {
    it("contains pptx-tr-push-in-from-right", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-push-in-from-right",
      );
    });

    it("contains pptx-tr-push-out-to-left", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-push-out-to-left",
      );
    });

    it("contains pptx-tr-push-in-from-left", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-push-in-from-left",
      );
    });

    it("contains pptx-tr-push-in-from-bottom", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-push-in-from-bottom",
      );
    });

    it("contains pptx-tr-push-in-from-top", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-push-in-from-top",
      );
    });
  });

  // -------------------------------------------------------------------
  // Cover keyframes
  // -------------------------------------------------------------------
  describe("cover keyframes", () => {
    it("contains pptx-tr-cover-from-right", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-right",
      );
    });

    it("contains pptx-tr-cover-from-left", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-left",
      );
    });

    it("contains pptx-tr-cover-from-bottom", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-bottom",
      );
    });

    it("contains pptx-tr-cover-from-top", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-top",
      );
    });

    it("contains diagonal cover variants", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-lu",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-ld",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-ru",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-cover-from-rd",
      );
    });
  });

  // -------------------------------------------------------------------
  // Transform properties
  // -------------------------------------------------------------------
  describe("CSS transform properties", () => {
    it("contains translateX transforms", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("translateX");
    });

    it("contains translateY transforms", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("translateY");
    });

    it("contains translate() for diagonal cover/uncover", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("translate(");
    });

    it("contains scale transforms for zoom", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("scale(");
    });

    it("contains rotate transforms for newsflash/wheel", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("rotate(");
    });
  });

  // -------------------------------------------------------------------
  // Opacity properties
  // -------------------------------------------------------------------
  describe("opacity properties", () => {
    it("contains opacity declarations", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("opacity");
    });

    it("contains opacity: 0 for fade-out start states", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("opacity: 0");
    });

    it("contains opacity: 1 for fade-in end states", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("opacity: 1");
    });
  });

  // -------------------------------------------------------------------
  // Uncover keyframes
  // -------------------------------------------------------------------
  describe("uncover keyframes", () => {
    it("contains uncover directional keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-left",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-right",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-top",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-bottom",
      );
    });

    it("contains diagonal uncover variants", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-lu",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-uncover-to-rd",
      );
    });
  });

  // -------------------------------------------------------------------
  // Wipe / split / clip-path based keyframes
  // -------------------------------------------------------------------
  describe("wipe and split keyframes", () => {
    it("contains wipe keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-wipe-from-left",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-wipe-from-right",
      );
    });

    it("contains split keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-split-h-out",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-split-v-out",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-split-h-in",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-split-v-in",
      );
    });

    it("contains clip-path for wipe/split animations", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain("clip-path");
    });
  });

  // -------------------------------------------------------------------
  // Shape-based keyframes (circle, diamond, plus, wedge)
  // -------------------------------------------------------------------
  describe("shape-based keyframes", () => {
    it("contains circle-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-circle-in",
      );
    });

    it("contains diamond-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-diamond-in",
      );
    });

    it("contains plus-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-plus-in",
      );
    });

    it("contains wedge-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-wedge-in",
      );
    });
  });

  // -------------------------------------------------------------------
  // Zoom, dissolve, blinds, checker, comb, etc.
  // -------------------------------------------------------------------
  describe("additional transition keyframes", () => {
    it("contains zoom keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-zoom-in",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-zoom-out",
      );
    });

    it("contains dissolve-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-dissolve-in",
      );
    });

    it("contains blinds keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-blinds-h",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-blinds-v",
      );
    });

    it("contains checker-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-checker-in",
      );
    });

    it("contains comb keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-comb-h",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-comb-v",
      );
    });

    it("contains strips keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-strips-lu",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-strips-rd",
      );
    });

    it("contains randombar keyframes", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-randombar-h",
      );
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-randombar-v",
      );
    });

    it("contains newsflash-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-newsflash-in",
      );
    });

    it("contains wheel-in keyframe", () => {
      expect(SLIDE_TRANSITION_KEYFRAMES).toContain(
        "@keyframes pptx-tr-wheel-in",
      );
    });
  });
});
