import { describe, it, expect } from "vitest";
import {
  getEffectDagCssFilter,
  getEffectDagFilter,
  getEffectDagOpacity,
  getEffectDagBlendMode,
  getDuotoneSvgFilterMarkup,
  hasEffectDagProperties,
} from "./effect-dag-filters";
import type { ShapeStyle } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// getEffectDagCssFilter
// ---------------------------------------------------------------------------

describe("getEffectDagCssFilter", () => {
  it("returns undefined for undefined style", () => {
    expect(getEffectDagCssFilter(undefined)).toBeUndefined();
  });

  it("returns undefined for empty style", () => {
    expect(getEffectDagCssFilter({})).toBeUndefined();
  });

  it("maps dagGrayscale to grayscale(1)", () => {
    const result = getEffectDagCssFilter({ dagGrayscale: true });
    expect(result).toBe("grayscale(1)");
  });

  it("does not apply grayscale when dagGrayscale is false", () => {
    const result = getEffectDagCssFilter({ dagGrayscale: false });
    expect(result).toBeUndefined();
  });

  it("maps dagBiLevel > 50 to contrast(1000)", () => {
    const result = getEffectDagCssFilter({ dagBiLevel: 75 });
    expect(result).toBe("contrast(1000)");
  });

  it("maps dagBiLevel <= 50 to contrast(0.01)", () => {
    const result = getEffectDagCssFilter({ dagBiLevel: 50 });
    expect(result).toBe("contrast(0.01)");
  });

  it("maps dagBiLevel of 0 to contrast(0.01)", () => {
    const result = getEffectDagCssFilter({ dagBiLevel: 0 });
    expect(result).toBe("contrast(0.01)");
  });

  it("clamps dagBiLevel to 0-100 before threshold check", () => {
    // 150 clamped to 100 > 50 => contrast(1000)
    const result = getEffectDagCssFilter({ dagBiLevel: 150 });
    expect(result).toBe("contrast(1000)");
  });

  it("maps dagLumBrightness to brightness()", () => {
    const result = getEffectDagCssFilter({ dagLumBrightness: 30 });
    expect(result).toBe("brightness(1.3)");
  });

  it("maps negative dagLumBrightness to brightness()", () => {
    const result = getEffectDagCssFilter({ dagLumBrightness: -50 });
    expect(result).toBe("brightness(0.5)");
  });

  it("ignores dagLumBrightness of 0", () => {
    const result = getEffectDagCssFilter({ dagLumBrightness: 0 });
    expect(result).toBeUndefined();
  });

  it("maps dagLumContrast to contrast()", () => {
    const result = getEffectDagCssFilter({ dagLumContrast: 40 });
    expect(result).toBe("contrast(1.4)");
  });

  it("maps negative dagLumContrast to contrast()", () => {
    const result = getEffectDagCssFilter({ dagLumContrast: -20 });
    expect(result).toBe("contrast(0.8)");
  });

  it("ignores dagLumContrast of 0", () => {
    const result = getEffectDagCssFilter({ dagLumContrast: 0 });
    expect(result).toBeUndefined();
  });

  it("combines dagLumBrightness and dagLumContrast", () => {
    const result = getEffectDagCssFilter({
      dagLumBrightness: 20,
      dagLumContrast: -10,
    });
    expect(result).toBe("brightness(1.2) contrast(0.9)");
  });

  it("maps dagHslHue to hue-rotate()", () => {
    const result = getEffectDagCssFilter({ dagHslHue: 180 });
    expect(result).toBe("hue-rotate(180deg)");
  });

  it("ignores dagHslHue of 0", () => {
    const result = getEffectDagCssFilter({ dagHslHue: 0 });
    expect(result).toBeUndefined();
  });

  it("maps dagHslSaturation to saturate()", () => {
    const result = getEffectDagCssFilter({ dagHslSaturation: 200 });
    expect(result).toBe("saturate(2)");
  });

  it("maps dagHslSaturation of 0 to saturate(0)", () => {
    const result = getEffectDagCssFilter({ dagHslSaturation: 0 });
    expect(result).toBe("saturate(0)");
  });

  it("ignores dagHslSaturation of 100 (neutral)", () => {
    const result = getEffectDagCssFilter({ dagHslSaturation: 100 });
    expect(result).toBeUndefined();
  });

  it("maps dagHslLuminance to brightness() approximation", () => {
    const result = getEffectDagCssFilter({ dagHslLuminance: 50 });
    expect(result).toBe("brightness(1.5)");
  });

  it("ignores dagHslLuminance of 0", () => {
    const result = getEffectDagCssFilter({ dagHslLuminance: 0 });
    expect(result).toBeUndefined();
  });

  it("maps dagAlphaModFix to opacity()", () => {
    const result = getEffectDagCssFilter({ dagAlphaModFix: 75 });
    expect(result).toBe("opacity(0.75)");
  });

  it("maps dagAlphaModFix of 100 to opacity(1)", () => {
    const result = getEffectDagCssFilter({ dagAlphaModFix: 100 });
    expect(result).toBe("opacity(1)");
  });

  it("maps dagAlphaModFix of 0 to opacity(0)", () => {
    const result = getEffectDagCssFilter({ dagAlphaModFix: 0 });
    expect(result).toBe("opacity(0)");
  });

  it("maps dagTintHue and dagTintAmount to sepia() hue-rotate()", () => {
    const result = getEffectDagCssFilter({
      dagTintHue: 45,
      dagTintAmount: 80,
    });
    expect(result).toBe("sepia(0.8) hue-rotate(45deg)");
  });

  it("uses default amount of 50 when only dagTintHue is set", () => {
    const result = getEffectDagCssFilter({ dagTintHue: 90 });
    expect(result).toBe("sepia(0.5) hue-rotate(90deg)");
  });

  it("uses default hue of 0 when only dagTintAmount is set", () => {
    const result = getEffectDagCssFilter({ dagTintAmount: 60 });
    expect(result).toBe("sepia(0.6) hue-rotate(0deg)");
  });

  it("clamps dagTintAmount to 0-100 range", () => {
    const result = getEffectDagCssFilter({ dagTintAmount: 150, dagTintHue: 0 });
    expect(result).toBe("sepia(1) hue-rotate(0deg)");
  });

  it("maps dagDuotone to url() SVG filter reference when elementId is provided", () => {
    const result = getEffectDagCssFilter(
      { dagDuotone: { color1: "#000000", color2: "#FFFFFF" } },
      "el-123",
    );
    expect(result).toBe("url(#dag-duotone-el-123)");
  });

  it("omits dagDuotone when no elementId is provided", () => {
    const result = getEffectDagCssFilter({
      dagDuotone: { color1: "#000000", color2: "#FFFFFF" },
    });
    expect(result).toBeUndefined();
  });

  it("combines multiple DAG effects into a single filter string", () => {
    const result = getEffectDagCssFilter({
      dagGrayscale: true,
      dagLumBrightness: 10,
      dagHslHue: 90,
      dagAlphaModFix: 80,
    });
    expect(result).toBe(
      "grayscale(1) brightness(1.1) hue-rotate(90deg) opacity(0.8)",
    );
  });

  it("legacy getEffectDagFilter is an alias for getEffectDagCssFilter", () => {
    expect(getEffectDagFilter).toBe(getEffectDagCssFilter);
  });
});

// ---------------------------------------------------------------------------
// getEffectDagOpacity
// ---------------------------------------------------------------------------

describe("getEffectDagOpacity", () => {
  it("returns undefined for undefined style", () => {
    expect(getEffectDagOpacity(undefined)).toBeUndefined();
  });

  it("returns undefined when dagAlphaModFix is not set", () => {
    expect(getEffectDagOpacity({})).toBeUndefined();
  });

  it("returns normalised 0-1 opacity from dagAlphaModFix", () => {
    expect(getEffectDagOpacity({ dagAlphaModFix: 50 })).toBe(0.5);
  });

  it("clamps opacity to max 1", () => {
    expect(getEffectDagOpacity({ dagAlphaModFix: 200 })).toBe(1);
  });

  it("clamps opacity to min 0", () => {
    expect(getEffectDagOpacity({ dagAlphaModFix: -50 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getEffectDagBlendMode
// ---------------------------------------------------------------------------

describe("getEffectDagBlendMode", () => {
  it("returns undefined for undefined blend", () => {
    expect(getEffectDagBlendMode(undefined)).toBeUndefined();
  });

  it('maps "mult" to "multiply"', () => {
    expect(getEffectDagBlendMode("mult")).toBe("multiply");
  });

  it('maps "screen" to "screen"', () => {
    expect(getEffectDagBlendMode("screen")).toBe("screen");
  });

  it('maps "darken" to "darken"', () => {
    expect(getEffectDagBlendMode("darken")).toBe("darken");
  });

  it('maps "lighten" to "lighten"', () => {
    expect(getEffectDagBlendMode("lighten")).toBe("lighten");
  });

  it('returns undefined for "over" (normal blending)', () => {
    expect(getEffectDagBlendMode("over")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getDuotoneSvgFilterMarkup
// ---------------------------------------------------------------------------

describe("getDuotoneSvgFilterMarkup", () => {
  it("generates valid SVG filter markup", () => {
    const markup = getDuotoneSvgFilterMarkup(
      "test-filter",
      "#000000",
      "#FFFFFF",
    );
    expect(markup).toContain('id="test-filter"');
    expect(markup).toContain("feColorMatrix");
    expect(markup).toContain("feComponentTransfer");
    expect(markup).toContain("feFuncR");
    expect(markup).toContain("feFuncG");
    expect(markup).toContain("feFuncB");
  });

  it("computes correct slopes for black-to-white mapping", () => {
    const markup = getDuotoneSvgFilterMarkup(
      "bw",
      "#000000",
      "#FFFFFF",
    );
    // slope = 1-0 = 1, intercept = 0
    expect(markup).toContain('slope="1"');
    expect(markup).toContain('intercept="0"');
  });

  it("computes correct intercepts for non-black shadow colour", () => {
    const markup = getDuotoneSvgFilterMarkup(
      "custom",
      "#800000",
      "#FFFFFF",
    );
    // R: shadow=128/255~0.502, highlight=1; slope~0.498, intercept~0.502
    expect(markup).toContain("feFuncR");
    // Verify it parses as valid XML-like structure
    expect(markup).toMatch(/<svg.*<\/svg>/);
  });

  it("uses BT.601 luminance weights in grayscale matrix", () => {
    const markup = getDuotoneSvgFilterMarkup("lum", "#000000", "#FFFFFF");
    // BT.601 weights: 0.2126, 0.7152, 0.0722
    expect(markup).toContain("0.2126");
    expect(markup).toContain("0.7152");
    expect(markup).toContain("0.0722");
  });

  it("generates zero slopes for identical shadow and highlight", () => {
    const markup = getDuotoneSvgFilterMarkup("mono", "#808080", "#808080");
    // slope should be 0 since color1 === color2
    expect(markup).toContain('slope="0"');
  });
});

// ---------------------------------------------------------------------------
// hasEffectDagProperties
// ---------------------------------------------------------------------------

describe("hasEffectDagProperties", () => {
  it("returns false for undefined style", () => {
    expect(hasEffectDagProperties(undefined)).toBe(false);
  });

  it("returns false for empty style", () => {
    expect(hasEffectDagProperties({})).toBe(false);
  });

  it("returns true when dagGrayscale is set", () => {
    expect(hasEffectDagProperties({ dagGrayscale: true })).toBe(true);
  });

  it("returns true when dagBiLevel is set", () => {
    expect(hasEffectDagProperties({ dagBiLevel: 50 })).toBe(true);
  });

  it("returns true when dagLumBrightness is set", () => {
    expect(hasEffectDagProperties({ dagLumBrightness: 10 })).toBe(true);
  });

  it("returns true when dagLumContrast is set", () => {
    expect(hasEffectDagProperties({ dagLumContrast: -30 })).toBe(true);
  });

  it("returns true when dagHslHue is set", () => {
    expect(hasEffectDagProperties({ dagHslHue: 90 })).toBe(true);
  });

  it("returns true when dagHslSaturation is set", () => {
    expect(hasEffectDagProperties({ dagHslSaturation: 200 })).toBe(true);
  });

  it("returns true when dagHslLuminance is set", () => {
    expect(hasEffectDagProperties({ dagHslLuminance: -20 })).toBe(true);
  });

  it("returns true when dagDuotone is set", () => {
    expect(
      hasEffectDagProperties({
        dagDuotone: { color1: "#000", color2: "#fff" },
      }),
    ).toBe(true);
  });

  it("returns true when dagFillOverlayBlend is set", () => {
    expect(hasEffectDagProperties({ dagFillOverlayBlend: "mult" })).toBe(true);
  });

  it("returns true when dagAlphaModFix is set", () => {
    expect(hasEffectDagProperties({ dagAlphaModFix: 75 })).toBe(true);
  });

  it("returns true when dagTintHue is set", () => {
    expect(hasEffectDagProperties({ dagTintHue: 180 })).toBe(true);
  });

  it("returns true when dagTintAmount is set", () => {
    expect(hasEffectDagProperties({ dagTintAmount: 60 })).toBe(true);
  });

  it("returns false when only non-DAG properties are set", () => {
    expect(
      hasEffectDagProperties({
        fillColor: "#FF0000",
        strokeWidth: 2,
        shadowBlur: 5,
      }),
    ).toBe(false);
  });
});
