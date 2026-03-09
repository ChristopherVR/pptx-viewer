import { describe, it, expect } from "vitest";
import { getPresentationTransitionStyle } from "./style-transitions";

describe("getPresentationTransitionStyle", () => {
  // ---------------------------------------------------------------------------
  // Visible (enter) state
  // ---------------------------------------------------------------------------

  describe("visible = true (enter state)", () => {
    it("returns opacity 1 for any transition type when visible", () => {
      const style = getPresentationTransitionStyle(true, "fade", 500, undefined);
      expect(style.opacity).toBe(1);
    });

    it("includes a CSS transition string", () => {
      const style = getPresentationTransitionStyle(true, "fade", 500, undefined);
      expect(style.transition).toBeDefined();
      expect(style.transition).toContain("opacity");
      expect(style.transition).toContain("500ms");
    });

    it("sets transform to identity for enter state", () => {
      const style = getPresentationTransitionStyle(
        true,
        "push",
        300,
        "l",
      );
      expect(style.transform).toContain("translate(0, 0)");
      expect(style.transform).toContain("scale(1)");
    });

    it("sets clipPath for circle transition on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "circle",
        500,
        undefined,
      );
      expect(style.clipPath).toContain("circle(100%");
    });

    it("sets clipPath for diamond transition on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "diamond",
        500,
        undefined,
      );
      expect(style.clipPath).toContain("polygon");
    });

    it("sets clipPath for split transition on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "split",
        500,
        undefined,
      );
      expect(style.clipPath).toBe("inset(0 0 0 0)");
    });

    it("sets clipPath for wedge transition on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "wedge",
        500,
        undefined,
      );
      expect(style.clipPath).toContain("polygon");
    });

    it("sets clipPath for wipe transition on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "wipe",
        500,
        undefined,
      );
      expect(style.clipPath).toBe("inset(0 0 0 0)");
    });

    it("sets filter to none on enter", () => {
      const style = getPresentationTransitionStyle(
        true,
        "dissolve",
        500,
        undefined,
      );
      expect(style.filter).toBe("none");
    });
  });

  // ---------------------------------------------------------------------------
  // Hidden (exit) state
  // ---------------------------------------------------------------------------

  describe("visible = false (exit state)", () => {
    it("fade: sets opacity to 0", () => {
      const style = getPresentationTransitionStyle(
        false,
        "fade",
        500,
        undefined,
      );
      expect(style.opacity).toBe(0);
    });

    it("push left: translates to the right (100%)", () => {
      const style = getPresentationTransitionStyle(false, "push", 500, "l");
      expect(style.opacity).toBe(0);
      expect(style.transform).toContain("100%, 0");
    });

    it("push right: translates to the left (-100%)", () => {
      const style = getPresentationTransitionStyle(false, "push", 500, "r");
      expect(style.transform).toContain("-100%, 0");
    });

    it("push up: translates down (100%)", () => {
      const style = getPresentationTransitionStyle(false, "push", 500, "u");
      expect(style.transform).toContain("0, 100%");
    });

    it("push down: translates up (-100%)", () => {
      const style = getPresentationTransitionStyle(false, "push", 500, "d");
      expect(style.transform).toContain("0, -100%");
    });

    it("cover: partially translates and fades", () => {
      const style = getPresentationTransitionStyle(
        false,
        "cover",
        400,
        "l",
      );
      expect(style.opacity).toBe(0.2);
      expect(style.transform).toContain("-30%, 0");
    });

    it("uncover: fully translates out", () => {
      const style = getPresentationTransitionStyle(
        false,
        "uncover",
        400,
        "l",
      );
      expect(style.opacity).toBe(0);
      expect(style.transform).toContain("100%, 0");
    });

    it("wipe left: clips via inset", () => {
      const style = getPresentationTransitionStyle(
        false,
        "wipe",
        400,
        "l",
      );
      expect(style.opacity).toBe(1);
      expect(style.clipPath).toContain("inset(0 100% 0 0)");
    });

    it("wipe right: clips from left", () => {
      const style = getPresentationTransitionStyle(
        false,
        "wipe",
        400,
        "r",
      );
      expect(style.clipPath).toContain("inset(0 0 0 100%)");
    });

    it("circle: clips to zero radius circle", () => {
      const style = getPresentationTransitionStyle(
        false,
        "circle",
        400,
        undefined,
      );
      expect(style.clipPath).toContain("circle(0%");
    });

    it("diamond: clips to collapsed polygon", () => {
      const style = getPresentationTransitionStyle(
        false,
        "diamond",
        400,
        undefined,
      );
      expect(style.clipPath).toContain("polygon");
    });

    it("zoom: scales to 0.01", () => {
      const style = getPresentationTransitionStyle(
        false,
        "zoom",
        400,
        undefined,
      );
      expect(style.transform).toContain("scale(0.01)");
    });

    it("morph: scales to 0.85 with blur", () => {
      const style = getPresentationTransitionStyle(
        false,
        "morph",
        400,
        undefined,
      );
      expect(style.transform).toContain("scale(0.85)");
      expect(style.filter).toContain("blur");
    });

    it("newsflash: rotates 720deg and scales to 0", () => {
      const style = getPresentationTransitionStyle(
        false,
        "newsflash",
        400,
        undefined,
      );
      expect(style.transform).toContain("rotate(720deg)");
      expect(style.transform).toContain("scale(0)");
    });

    it("dissolve: applies blur filter", () => {
      const style = getPresentationTransitionStyle(
        false,
        "dissolve",
        400,
        undefined,
      );
      expect(style.opacity).toBe(0);
      expect(style.filter).toContain("blur");
    });

    it("blinds horizontal: uses stepped opacity transition", () => {
      const style = getPresentationTransitionStyle(
        false,
        "blinds",
        400,
        "horz",
      );
      expect(style.opacity).toBe(0);
      expect(style.transition).toContain("steps(6)");
    });

    it("blinds vertical: clips from right", () => {
      const style = getPresentationTransitionStyle(
        false,
        "blinds",
        400,
        "vert",
      );
      expect(style.opacity).toBe(0);
      expect(style.clipPath).toContain("inset(0 0 0 100%)");
    });

    it("split horizontal: clips inward", () => {
      const style = getPresentationTransitionStyle(
        false,
        "split",
        400,
        "horz",
      );
      expect(style.clipPath).toContain("inset(0 50% 0 50%)");
    });

    it("split vertical: clips inward vertically", () => {
      const style = getPresentationTransitionStyle(
        false,
        "split",
        400,
        "vert",
      );
      expect(style.clipPath).toContain("inset(50% 0 50% 0)");
    });

    it("checker: applies grayscale filter", () => {
      const style = getPresentationTransitionStyle(
        false,
        "checker",
        400,
        undefined,
      );
      expect(style.filter).toContain("grayscale");
    });

    it("randomBar: uses stepped opacity", () => {
      const style = getPresentationTransitionStyle(
        false,
        "randomBar",
        400,
        undefined,
      );
      expect(style.transition).toContain("steps(12)");
    });
  });

  // ---------------------------------------------------------------------------
  // Duration handling
  // ---------------------------------------------------------------------------

  describe("duration handling", () => {
    it("enforces minimum duration of 120ms", () => {
      const style = getPresentationTransitionStyle(true, "fade", 50, undefined);
      expect(style.transition).toContain("120ms");
    });

    it("uses default duration of 320ms when undefined", () => {
      const style = getPresentationTransitionStyle(
        true,
        "fade",
        undefined,
        undefined,
      );
      expect(style.transition).toContain("320ms");
    });

    it("uses the specified duration when above minimum", () => {
      const style = getPresentationTransitionStyle(
        true,
        "fade",
        1000,
        undefined,
      );
      expect(style.transition).toContain("1000ms");
    });
  });

  // ---------------------------------------------------------------------------
  // Default direction fallbacks
  // ---------------------------------------------------------------------------

  describe("default direction fallback", () => {
    it("push defaults to 'l' direction", () => {
      const style = getPresentationTransitionStyle(
        false,
        "push",
        400,
        undefined,
      );
      // Default "l" → exit: translate(100%, 0)
      expect(style.transform).toContain("100%, 0");
    });

    it("unknown transition type falls through to fade", () => {
      const style = getPresentationTransitionStyle(
        false,
        undefined,
        400,
        undefined,
      );
      expect(style.opacity).toBe(0);
    });
  });
});
