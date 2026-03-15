/**
 * Tests for CSS preprocessing utilities.
 *
 * Tests focus on the pure transformation functions in
 * css-preprocessing.ts (parseBlurValue, has3dTransform,
 * flatten3dTransform). The DOM-dependent walk functions
 * (resolveCustomProperties, flattenBackdropFilter, etc.) rely on
 * `window.getComputedStyle` and `document.querySelectorAll`, which
 * require a full browser/jsdom environment. They follow the same
 * proven walk pattern used in canvas-export.ts.
 */
import { describe, it, expect } from "vitest";

import {
  parseBlurValue,
  has3dTransform,
  flatten3dTransform,
  type CssPreprocessingOptions,
} from "./css-preprocessing";

// ────────────────────────────────────────────────────────────────────
// parseBlurValue
// ────────────────────────────────────────────────────────────────────

describe("parseBlurValue", () => {
  it("extracts pixel value from blur(10px)", () => {
    expect(parseBlurValue("blur(10px)")).toBe(10);
  });

  it("extracts pixel value from blur(5.5px)", () => {
    expect(parseBlurValue("blur(5.5px)")).toBe(5.5);
  });

  it("extracts pixel value from blur( 20px )", () => {
    expect(parseBlurValue("blur( 20px )")).toBe(20);
  });

  it("returns 0 when no blur function is present", () => {
    expect(parseBlurValue("brightness(1.2)")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseBlurValue("")).toBe(0);
  });

  it("returns 0 for 'none'", () => {
    expect(parseBlurValue("none")).toBe(0);
  });

  it("extracts blur from combined filter string", () => {
    expect(parseBlurValue("saturate(1.5) blur(8px) brightness(1.1)")).toBe(8);
  });

  it("handles blur(0px)", () => {
    expect(parseBlurValue("blur(0px)")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(parseBlurValue("BLUR(15px)")).toBe(15);
  });

  it("handles large blur values", () => {
    expect(parseBlurValue("blur(100px)")).toBe(100);
  });

  it("handles blur with decimal precision", () => {
    expect(parseBlurValue("blur(3.14159px)")).toBeCloseTo(3.14159);
  });
});

// ────────────────────────────────────────────────────────────────────
// has3dTransform
// ────────────────────────────────────────────────────────────────────

describe("has3dTransform", () => {
  it("returns false for empty string", () => {
    expect(has3dTransform("")).toBe(false);
  });

  it("returns false for 'none'", () => {
    expect(has3dTransform("none")).toBe(false);
  });

  it("returns false for 2D transforms", () => {
    expect(has3dTransform("translate(10px, 20px)")).toBe(false);
    expect(has3dTransform("rotate(45deg)")).toBe(false);
    expect(has3dTransform("scale(2)")).toBe(false);
    expect(has3dTransform("matrix(1, 0, 0, 1, 0, 0)")).toBe(false);
    expect(has3dTransform("skew(10deg)")).toBe(false);
    expect(has3dTransform("translateX(10px)")).toBe(false);
    expect(has3dTransform("translateY(20px)")).toBe(false);
  });

  it("returns true for translate3d", () => {
    expect(has3dTransform("translate3d(10px, 20px, 30px)")).toBe(true);
  });

  it("returns true for translateZ", () => {
    expect(has3dTransform("translateZ(50px)")).toBe(true);
  });

  it("returns true for rotateX", () => {
    expect(has3dTransform("rotateX(45deg)")).toBe(true);
  });

  it("returns true for rotateY", () => {
    expect(has3dTransform("rotateY(45deg)")).toBe(true);
  });

  it("returns true for rotate3d", () => {
    expect(has3dTransform("rotate3d(1, 0, 0, 45deg)")).toBe(true);
  });

  it("returns true for scale3d", () => {
    expect(has3dTransform("scale3d(1, 1, 1)")).toBe(true);
  });

  it("returns true for scaleZ", () => {
    expect(has3dTransform("scaleZ(2)")).toBe(true);
  });

  it("returns true for perspective", () => {
    expect(has3dTransform("perspective(500px)")).toBe(true);
  });

  it("returns true for matrix3d", () => {
    expect(
      has3dTransform("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"),
    ).toBe(true);
  });

  it("returns true when 3D transform is mixed with 2D", () => {
    expect(has3dTransform("rotate(45deg) translateZ(10px)")).toBe(true);
  });

  it("handles consecutive calls correctly (no stale global state)", () => {
    expect(has3dTransform("translateZ(10px)")).toBe(true);
    expect(has3dTransform("translate(10px, 20px)")).toBe(false);
    expect(has3dTransform("perspective(100px)")).toBe(true);
    expect(has3dTransform("rotate(45deg)")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// flatten3dTransform
// ────────────────────────────────────────────────────────────────────

describe("flatten3dTransform", () => {
  it("returns empty string unchanged", () => {
    expect(flatten3dTransform("")).toBe("");
  });

  it("returns 'none' unchanged", () => {
    expect(flatten3dTransform("none")).toBe("none");
  });

  it("returns pure 2D transforms unchanged", () => {
    const val = "translate(10px, 20px) rotate(45deg)";
    expect(flatten3dTransform(val)).toBe(val);
  });

  it("converts translate3d to translate", () => {
    expect(flatten3dTransform("translate3d(10px, 20px, 30px)")).toBe(
      "translate(10px, 20px)",
    );
  });

  it("removes translateZ", () => {
    const result = flatten3dTransform("translateZ(50px)");
    expect(result).toBe("none");
  });

  it("converts scale3d to scale", () => {
    expect(flatten3dTransform("scale3d(2, 3, 1)")).toBe("scale(2, 3)");
  });

  it("removes scaleZ", () => {
    expect(flatten3dTransform("scaleZ(2)")).toBe("none");
  });

  it("removes rotateX", () => {
    expect(flatten3dTransform("rotateX(45deg)")).toBe("none");
  });

  it("removes rotateY", () => {
    expect(flatten3dTransform("rotateY(90deg)")).toBe("none");
  });

  it("removes rotate3d", () => {
    expect(flatten3dTransform("rotate3d(1, 0, 0, 45deg)")).toBe("none");
  });

  it("removes perspective", () => {
    expect(flatten3dTransform("perspective(500px)")).toBe("none");
  });

  it("removes matrix3d", () => {
    expect(
      flatten3dTransform(
        "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)",
      ),
    ).toBe("none");
  });

  it("preserves 2D transforms when removing 3D parts", () => {
    const result = flatten3dTransform("rotate(45deg) translateZ(10px) scale(2)");
    expect(result).toContain("rotate(45deg)");
    expect(result).toContain("scale(2)");
    expect(result).not.toContain("translateZ");
  });

  it("converts translate3d and preserves rotate", () => {
    const result = flatten3dTransform(
      "translate3d(10px, 20px, 0) rotate(90deg)",
    );
    expect(result).toContain("translate(10px, 20px)");
    expect(result).toContain("rotate(90deg)");
  });

  it("handles multiple 3D transforms", () => {
    const result = flatten3dTransform(
      "perspective(500px) translate3d(10px, 20px, 30px) rotateX(45deg)",
    );
    expect(result).toContain("translate(10px, 20px)");
    expect(result).not.toContain("perspective");
    expect(result).not.toContain("rotateX");
  });

  it("returns 'none' when all transforms are 3D-only", () => {
    expect(flatten3dTransform("perspective(500px) rotateX(45deg) translateZ(10px)")).toBe(
      "none",
    );
  });

  it("trims extra whitespace", () => {
    const result = flatten3dTransform("  translate3d(1px, 2px, 3px)  ");
    expect(result).toBe("translate(1px, 2px)");
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });

  it("handles translate3d with calc values", () => {
    const result = flatten3dTransform("translate3d(calc(50% - 10px), 20px, 0)");
    expect(result).toContain("translate(calc(50% - 10px), 20px)");
  });

  it("handles mixed case function names", () => {
    const result = flatten3dTransform("Translate3d(10px, 20px, 30px)");
    expect(result).toContain("translate(10px, 20px)");
  });

  it("preserves translateX and translateY (2D functions)", () => {
    const val = "translateX(10px) translateY(20px)";
    expect(flatten3dTransform(val)).toBe(val);
  });

  it("handles consecutive calls without interference from global regex", () => {
    expect(flatten3dTransform("translateZ(10px)")).toBe("none");
    expect(flatten3dTransform("translateZ(20px)")).toBe("none");
    expect(flatten3dTransform("translate(10px, 20px)")).toBe(
      "translate(10px, 20px)",
    );
    expect(flatten3dTransform("translate3d(1px, 2px, 3px)")).toBe(
      "translate(1px, 2px)",
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// CssPreprocessingOptions type
// ────────────────────────────────────────────────────────────────────

describe("CssPreprocessingOptions", () => {
  it("all options are optional", () => {
    const opts: CssPreprocessingOptions = {};
    expect(opts.resolveCustomProperties).toBeUndefined();
    expect(opts.flattenBackdropFilter).toBeUndefined();
    expect(opts.flattenMixBlendMode).toBeUndefined();
    expect(opts.flatten3dTransforms).toBeUndefined();
    expect(opts.removeUnsupportedFeatures).toBeUndefined();
  });

  it("accepts all boolean options", () => {
    const opts: CssPreprocessingOptions = {
      resolveCustomProperties: true,
      flattenBackdropFilter: false,
      flattenMixBlendMode: true,
      flatten3dTransforms: false,
      removeUnsupportedFeatures: true,
    };
    expect(opts.resolveCustomProperties).toBe(true);
    expect(opts.flattenBackdropFilter).toBe(false);
    expect(opts.flattenMixBlendMode).toBe(true);
    expect(opts.flatten3dTransforms).toBe(false);
    expect(opts.removeUnsupportedFeatures).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// Module exports
// ────────────────────────────────────────────────────────────────────

describe("module exports", () => {
  it("exports preprocessCssForCapture function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.preprocessCssForCapture).toBe("function");
  });

  it("exports resolveCustomProperties function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.resolveCustomProperties).toBe("function");
  });

  it("exports flattenBackdropFilter function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.flattenBackdropFilter).toBe("function");
  });

  it("exports flattenMixBlendMode function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.flattenMixBlendMode).toBe("function");
  });

  it("exports flatten3dTransforms function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.flatten3dTransforms).toBe("function");
  });

  it("exports removeUnsupportedFeatures function", async () => {
    const mod = await import("./css-preprocessing");
    expect(typeof mod.removeUnsupportedFeatures).toBe("function");
  });
});
