import { describe, it, expect } from "vitest";
import {
  extractDagGrayscale,
  extractDagBiLevel,
  extractDagLuminance,
  extractDagHsl,
  extractDagAlphaModFix,
  extractDagTint,
  extractDagDuotone,
  extractDagFillOverlay,
} from "./effect-dag-specific-helpers";
import type { DagSpecificContext } from "./effect-dag-specific-helpers";
import type { ShapeStyle, XmlObject } from "../../types";

// Helper to build a minimal DagSpecificContext.
function makeContext(
  overrides: Partial<DagSpecificContext> = {},
): DagSpecificContext {
  return {
    parseColor: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const val = colorNode["@_val"];
      if (val) return `#${val}`;
      return undefined;
    },
    ensureArray: (value: unknown): XmlObject[] => {
      if (Array.isArray(value)) return value as XmlObject[];
      if (value === undefined || value === null) return [];
      return [value] as XmlObject[];
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// extractDagGrayscale
// ---------------------------------------------------------------------------

describe("extractDagGrayscale", () => {
  it("sets dagGrayscale to true when a:grayscl is present", () => {
    const dag: XmlObject = { "a:grayscl": {} };
    const style: Partial<ShapeStyle> = {};
    extractDagGrayscale(dag, style);
    expect(style.dagGrayscale).toBe(true);
  });

  it("does not set dagGrayscale when a:grayscl is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagGrayscale(dag, style);
    expect(style.dagGrayscale).toBeUndefined();
  });

  it("sets dagGrayscale even when a:grayscl is an empty string", () => {
    const dag: XmlObject = { "a:grayscl": "" };
    const style: Partial<ShapeStyle> = {};
    extractDagGrayscale(dag, style);
    // "" is not undefined, so the check passes
    expect(style.dagGrayscale).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractDagBiLevel
// ---------------------------------------------------------------------------

describe("extractDagBiLevel", () => {
  it("extracts threshold from a:biLevel (50000 => 50)", () => {
    const dag: XmlObject = { "a:biLevel": { "@_thresh": "50000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagBiLevel(dag, style);
    expect(style.dagBiLevel).toBe(50);
  });

  it("clamps threshold to max 100", () => {
    const dag: XmlObject = { "a:biLevel": { "@_thresh": "200000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagBiLevel(dag, style);
    expect(style.dagBiLevel).toBe(100);
  });

  it("clamps threshold to min 0", () => {
    const dag: XmlObject = { "a:biLevel": { "@_thresh": "-10000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagBiLevel(dag, style);
    expect(style.dagBiLevel).toBe(0);
  });

  it("does nothing when a:biLevel is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagBiLevel(dag, style);
    expect(style.dagBiLevel).toBeUndefined();
  });

  it("does nothing when thresh is not provided", () => {
    const dag: XmlObject = { "a:biLevel": {} };
    const style: Partial<ShapeStyle> = {};
    extractDagBiLevel(dag, style);
    expect(style.dagBiLevel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagLuminance
// ---------------------------------------------------------------------------

describe("extractDagLuminance", () => {
  it("extracts brightness from a:lum (20000 => 20)", () => {
    const dag: XmlObject = { "a:lum": { "@_bright": "20000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagLuminance(dag, style);
    expect(style.dagLumBrightness).toBe(20);
  });

  it("extracts contrast from a:lum (-30000 => -30)", () => {
    const dag: XmlObject = { "a:lum": { "@_contrast": "-30000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagLuminance(dag, style);
    expect(style.dagLumContrast).toBe(-30);
  });

  it("extracts both brightness and contrast", () => {
    const dag: XmlObject = {
      "a:lum": { "@_bright": "10000", "@_contrast": "50000" },
    };
    const style: Partial<ShapeStyle> = {};
    extractDagLuminance(dag, style);
    expect(style.dagLumBrightness).toBe(10);
    expect(style.dagLumContrast).toBe(50);
  });

  it("does nothing when a:lum is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagLuminance(dag, style);
    expect(style.dagLumBrightness).toBeUndefined();
    expect(style.dagLumContrast).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagHsl
// ---------------------------------------------------------------------------

describe("extractDagHsl", () => {
  it("extracts hue (10800000 => 180 degrees)", () => {
    const dag: XmlObject = { "a:hsl": { "@_hue": "10800000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagHsl(dag, style);
    expect(style.dagHslHue).toBe(180);
  });

  it("extracts saturation (50000 => 50)", () => {
    const dag: XmlObject = { "a:hsl": { "@_sat": "50000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagHsl(dag, style);
    expect(style.dagHslSaturation).toBe(50);
  });

  it("extracts luminance (25000 => 25)", () => {
    const dag: XmlObject = { "a:hsl": { "@_lum": "25000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagHsl(dag, style);
    expect(style.dagHslLuminance).toBe(25);
  });

  it("extracts all three HSL values together", () => {
    const dag: XmlObject = {
      "a:hsl": { "@_hue": "21600000", "@_sat": "100000", "@_lum": "0" },
    };
    const style: Partial<ShapeStyle> = {};
    extractDagHsl(dag, style);
    expect(style.dagHslHue).toBe(360);
    expect(style.dagHslSaturation).toBe(100);
    expect(style.dagHslLuminance).toBe(0);
  });

  it("does nothing when a:hsl is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagHsl(dag, style);
    expect(style.dagHslHue).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagAlphaModFix
// ---------------------------------------------------------------------------

describe("extractDagAlphaModFix", () => {
  it("extracts alpha modulation (50000 => 50%)", () => {
    const dag: XmlObject = { "a:alphaModFix": { "@_amt": "50000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagAlphaModFix(dag, style);
    expect(style.dagAlphaModFix).toBe(50);
  });

  it("extracts full opacity (100000 => 100%)", () => {
    const dag: XmlObject = { "a:alphaModFix": { "@_amt": "100000" } };
    const style: Partial<ShapeStyle> = {};
    extractDagAlphaModFix(dag, style);
    expect(style.dagAlphaModFix).toBe(100);
  });

  it("does nothing when a:alphaModFix is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagAlphaModFix(dag, style);
    expect(style.dagAlphaModFix).toBeUndefined();
  });

  it("does nothing when amt attribute is missing", () => {
    const dag: XmlObject = { "a:alphaModFix": {} };
    const style: Partial<ShapeStyle> = {};
    extractDagAlphaModFix(dag, style);
    expect(style.dagAlphaModFix).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagTint
// ---------------------------------------------------------------------------

describe("extractDagTint", () => {
  it("extracts tint hue and amount", () => {
    const dag: XmlObject = {
      "a:tint": { "@_hue": "5400000", "@_amt": "60000" },
    };
    const style: Partial<ShapeStyle> = {};
    extractDagTint(dag, style);
    expect(style.dagTintHue).toBe(90); // 5400000 / 60000
    expect(style.dagTintAmount).toBe(60); // 60000 / 1000
  });

  it("does nothing when a:tint is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagTint(dag, style);
    expect(style.dagTintHue).toBeUndefined();
    expect(style.dagTintAmount).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagDuotone
// ---------------------------------------------------------------------------

describe("extractDagDuotone", () => {
  it("extracts two sRGB colors from duotone", () => {
    const dag: XmlObject = {
      "a:duotone": {
        "a:srgbClr": [{ "@_val": "000000" }, { "@_val": "FFFFFF" }],
      },
    };
    const style: Partial<ShapeStyle> = {};
    extractDagDuotone(dag, style, makeContext());
    expect(style.dagDuotone).toEqual({
      color1: "#000000",
      color2: "#FFFFFF",
    });
  });

  it("does nothing when fewer than 2 colors", () => {
    const dag: XmlObject = {
      "a:duotone": {
        "a:srgbClr": { "@_val": "FF0000" },
      },
    };
    const style: Partial<ShapeStyle> = {};
    extractDagDuotone(dag, style, makeContext());
    expect(style.dagDuotone).toBeUndefined();
  });

  it("falls back to defaults when parseColor returns undefined", () => {
    const dag: XmlObject = {
      "a:duotone": {
        "a:schemeClr": [{ "@_val": "accent1" }, { "@_val": "accent2" }],
      },
    };
    const style: Partial<ShapeStyle> = {};
    const ctx = makeContext({
      parseColor: () => undefined,
    });
    extractDagDuotone(dag, style, ctx);
    expect(style.dagDuotone).toEqual({
      color1: "#000000",
      color2: "#ffffff",
    });
  });

  it("does nothing when a:duotone is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagDuotone(dag, style, makeContext());
    expect(style.dagDuotone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractDagFillOverlay
// ---------------------------------------------------------------------------

describe("extractDagFillOverlay", () => {
  it("extracts blend mode 'over'", () => {
    const dag: XmlObject = { "a:fillOverlay": { "@_blend": "over" } };
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBe("over");
  });

  it("extracts blend mode 'mult'", () => {
    const dag: XmlObject = { "a:fillOverlay": { "@_blend": "mult" } };
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBe("mult");
  });

  it("extracts blend mode 'screen'", () => {
    const dag: XmlObject = { "a:fillOverlay": { "@_blend": "screen" } };
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBe("screen");
  });

  it("ignores invalid blend mode", () => {
    const dag: XmlObject = { "a:fillOverlay": { "@_blend": "unknown" } };
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBeUndefined();
  });

  it("does nothing when a:fillOverlay is absent", () => {
    const dag: XmlObject = {};
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBeUndefined();
  });

  it("handles case-insensitive blend mode with whitespace", () => {
    const dag: XmlObject = { "a:fillOverlay": { "@_blend": " Darken " } };
    const style: Partial<ShapeStyle> = {};
    extractDagFillOverlay(dag, style);
    expect(style.dagFillOverlayBlend).toBe("darken");
  });
});
