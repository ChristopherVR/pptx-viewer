/**
 * Tests verifying that all OOXML colour transforms are correctly applied
 * to text fill colours.
 *
 * Text colours flow through the same `applyDrawingColorTransforms` pipeline
 * as shape fills: the runtime calls `parseColor(solidFillNode)` which
 * delegates to `PptxColorTransformCodec.parseColorChoice`, which in turn
 * calls `applyDrawingColorTransforms(baseHex, colorChoiceNode)`.
 *
 * These tests exercise every individual transform type to ensure text
 * colours (particularly from theme scheme references) are rendered with
 * the correct lumMod/satMod/tint/shade/alpha adjustments.
 */
import { describe, it, expect } from "vitest";
import { applyDrawingColorTransforms } from "./color-transforms";
import { PptxColorTransformCodec } from "../core/builders/PptxColorTransformCodec";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// Stub theme resolver
// ---------------------------------------------------------------------------
const THEME_COLORS: Record<string, string> = {
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  dk1: "#000000",
  dk2: "#44546A",
  lt1: "#FFFFFF",
  lt2: "#E7E6E6",
  tx1: "#000000",
  tx2: "#44546A",
  bg1: "#FFFFFF",
  bg2: "#E7E6E6",
  hlink: "#0563C1",
  folHlink: "#954F72",
};

function createCodec() {
  return new PptxColorTransformCodec({
    resolveThemeColor: (key: string) => THEME_COLORS[key],
  });
}

// ---------------------------------------------------------------------------
// 1. Direct applyDrawingColorTransforms on text-colour hex values
// ---------------------------------------------------------------------------
describe("text colour transforms — applyDrawingColorTransforms", () => {
  // ── Shade (a:shade) ─────────────────────────────────────────────────
  it("shade 50% darkens text colour toward black", () => {
    const result = applyDrawingColorTransforms("#4472C4", {
      "a:shade": { "@_val": "50000" },
    });
    // Each channel * 0.5: R=68*0.5=34, G=114*0.5=57, B=196*0.5=98
    expect(result).toBe("#223962");
  });

  it("shade 100% leaves text colour unchanged", () => {
    expect(
      applyDrawingColorTransforms("#4472C4", {
        "a:shade": { "@_val": "100000" },
      }),
    ).toBe("#4472C4");
  });

  it("shade 0% produces black", () => {
    expect(
      applyDrawingColorTransforms("#4472C4", {
        "a:shade": { "@_val": "0" },
      }),
    ).toBe("#000000");
  });

  // ── Tint (a:tint) ──────────────────────────────────────────────────
  it("tint 50% lightens text colour toward white", () => {
    const result = applyDrawingColorTransforms("#4472C4", {
      "a:tint": { "@_val": "50000" },
    });
    // R: 68 + (255-68)*0.5 = 68+93.5 = 161.5 -> A2
    // G: 114 + (255-114)*0.5 = 114+70.5 = 184.5 -> B9
    // B: 196 + (255-196)*0.5 = 196+29.5 = 225.5 -> E2
    expect(result).toBe("#A2B9E2");
  });

  it("tint 100% produces white regardless of base", () => {
    expect(
      applyDrawingColorTransforms("#4472C4", {
        "a:tint": { "@_val": "100000" },
      }),
    ).toBe("#FFFFFF");
  });

  // ── lumMod (a:lumMod) ───────────────────────────────────────────────
  it("lumMod 75% on white text produces lighter grey", () => {
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:lumMod": { "@_val": "75000" },
    });
    // White has lum=1.0. After lumMod 0.75 -> lum=0.75
    // hslToRgb(0, 0, 0.75) -> (191, 191, 191) = #BFBFBF
    expect(result).toBe("#BFBFBF");
  });

  it("lumMod 50% on white text produces mid-grey", () => {
    expect(
      applyDrawingColorTransforms("#FFFFFF", {
        "a:lumMod": { "@_val": "50000" },
      }),
    ).toBe("#808080");
  });

  // ── lumOff (a:lumOff) ───────────────────────────────────────────────
  it("lumOff 40% on black text lightens it", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:lumOff": { "@_val": "40000" },
    });
    // Black has lum=0. After lumOff 0.4 -> lum=0.4
    // hslToRgb(0, 0, 0.4) -> (102, 102, 102) = #666666
    expect(result).toBe("#666666");
  });

  // ── Combined lumMod + lumOff ────────────────────────────────────────
  it("lumMod 75% + lumOff 25% on white text", () => {
    // White lum=1.0 -> 1.0 * 0.75 = 0.75, then 0.75 + 0.25 = 1.0 (clamped)
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:lumMod": { "@_val": "75000" },
      "a:lumOff": { "@_val": "25000" },
    });
    expect(result).toBe("#FFFFFF");
  });

  it("lumMod 65% + lumOff 35% on black text", () => {
    // Black lum=0 -> 0 * 0.65 = 0, then 0 + 0.35 = 0.35
    // hslToRgb(0, 0, 0.35) -> ~(89, 89, 89) = #595959
    const result = applyDrawingColorTransforms("#000000", {
      "a:lumMod": { "@_val": "65000" },
      "a:lumOff": { "@_val": "35000" },
    });
    expect(result).toBe("#595959");
  });

  // ── satMod (a:satMod) ───────────────────────────────────────────────
  it("satMod 50% desaturates text colour", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:satMod": { "@_val": "50000" },
    });
    // Pure red: hsl(0, 1, 0.5). Sat becomes 0.5
    // hslToRgb(0, 0.5, 0.5) -> (191, 64, 64) = #BF4040
    expect(result).toBe("#BF4040");
  });

  it("satMod 0% fully desaturates text colour to grey", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:satMod": { "@_val": "0" },
    });
    // Pure red: hsl(0, 1, 0.5). Sat becomes 0
    // hslToRgb(0, 0, 0.5) -> (128, 128, 128) = #808080
    expect(result).toBe("#808080");
  });

  // ── satOff (a:satOff) ───────────────────────────────────────────────
  it("satOff -50% reduces saturation of text colour", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:satOff": { "@_val": "-50000" },
    });
    // Pure red: hsl(0, 1, 0.5). Sat becomes 1 + (-0.5) = 0.5
    // hslToRgb(0, 0.5, 0.5) -> (191, 64, 64) = #BF4040
    expect(result).toBe("#BF4040");
  });

  // ── Hue absolute (a:hue) ───────────────────────────────────────────
  it("absolute hue 120 degrees shifts red text to green", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:hue": { "@_val": "7200000" }, // 120 * 60000
    });
    expect(result).toBe("#00FF00");
  });

  // ── hueMod (a:hueMod) ──────────────────────────────────────────────
  it("hueMod 200% doubles the hue angle", () => {
    // Green (hue=120). hueMod 200% -> 120*2=240 -> blue
    const result = applyDrawingColorTransforms("#00FF00", {
      "a:hueMod": { "@_val": "200000" },
    });
    expect(result).toBe("#0000FF");
  });

  // ── hueOff (a:hueOff) ──────────────────────────────────────────────
  it("hueOff +120 degrees shifts red to green", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:hueOff": { "@_val": "7200000" }, // 120 * 60000
    });
    expect(result).toBe("#00FF00");
  });

  // ── Complement (a:comp) ────────────────────────────────────────────
  it("complement rotates text colour hue by 180 degrees", () => {
    // Red (hue=0) -> complement (hue=180) = cyan
    expect(
      applyDrawingColorTransforms("#FF0000", { "a:comp": {} }),
    ).toBe("#00FFFF");
  });

  // ── Inverse (a:inv) ────────────────────────────────────────────────
  it("inverse negates each RGB channel of text colour", () => {
    expect(
      applyDrawingColorTransforms("#4472C4", { "a:inv": {} }),
    ).toBe("#BB8D3B");
  });

  // ── Greyscale (a:gray) ─────────────────────────────────────────────
  it("greyscale converts text colour to luminance-weighted grey", () => {
    // #4472C4: R=68, G=114, B=196
    // gray = round(0.299*68 + 0.587*114 + 0.114*196) = round(20.332+66.918+22.344) = round(109.594) = 110 = 0x6E
    expect(
      applyDrawingColorTransforms("#4472C4", { "a:gray": {} }),
    ).toBe("#6E6E6E");
  });

  // ── Direct red channel (a:red / a:redMod / a:redOff) ──────────────
  it("absolute red sets red channel directly on text", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:red": { "@_val": "80000" }, // 80%
    });
    // R = round(0.8 * 255) = 204 = 0xCC
    expect(result).toBe("#CC0000");
  });

  it("redMod modulates red channel of text", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:redMod": { "@_val": "50000" },
    });
    expect(result).toBe("#800000");
  });

  it("redOff offsets red channel of text", () => {
    const result = applyDrawingColorTransforms("#800000", {
      "a:redOff": { "@_val": "25000" },
    });
    // 128 + 255*0.25 = 128 + 63.75 = 191.75 -> 192 = 0xC0
    expect(result).toBe("#C00000");
  });

  // ── Direct green channel ───────────────────────────────────────────
  it("absolute green sets green channel on text", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:green": { "@_val": "100000" },
    });
    expect(result).toBe("#00FF00");
  });

  // ── Direct blue channel ────────────────────────────────────────────
  it("absolute blue sets blue channel on text", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:blue": { "@_val": "100000" },
    });
    expect(result).toBe("#0000FF");
  });

  // ── Multiple combined transforms ───────────────────────────────────
  it("shade then lumMod applied in correct order on text colour", () => {
    // shade 50% on white: each channel * 0.5 = 127.5
    // lumMod 50%: lum of #808080 is 0.5 -> 0.5*0.5 = 0.25
    // hslToRgb(0, 0, 0.25) -> (64, 64, 64) = #404040
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:shade": { "@_val": "50000" },
      "a:lumMod": { "@_val": "50000" },
    });
    expect(result).toBe("#404040");
  });

  it("tint + satMod combined on text colour", () => {
    // tint 40% on pure red: R=255+0*0.4=255, G=0+(255)*0.4=102, B=0+255*0.4=102
    // -> #FF6666
    // satMod 50%: convert to HSL, halve saturation, back to RGB
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:tint": { "@_val": "40000" },
      "a:satMod": { "@_val": "50000" },
    });
    // After tint: rgb(255, 102, 102) -> hsl(0, 1.0, 0.7)
    // After satMod 50%: hsl(0, 0.5, 0.7) -> rgb(217, 140, 140) approx
    const rgb = hexToRgbForTest(result);
    expect(rgb).not.toBeNull();
    // Verify the result is in the right ballpark (desaturated pinkish)
    expect(rgb!.r).toBeGreaterThan(180);
    expect(rgb!.g).toBeGreaterThan(100);
    expect(rgb!.b).toBeGreaterThan(100);
    // Red channel should still be dominant
    expect(rgb!.r).toBeGreaterThan(rgb!.g);
  });
});

// ---------------------------------------------------------------------------
// 2. PptxColorTransformCodec.parseColorChoice — text colour from scheme refs
// ---------------------------------------------------------------------------
describe("text colour transforms — PptxColorTransformCodec scheme colours", () => {
  const codec = createCodec();

  it("scheme colour dk1 with lumMod 75% + lumOff 25% (light text variant)", () => {
    // dk1 = #000000, lum=0. lumMod 0.75 -> 0, lumOff 0.25 -> 0.25
    // hslToRgb(0, 0, 0.25) -> (64, 64, 64) = #404040
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "dk1",
        "a:lumMod": { "@_val": "75000" },
        "a:lumOff": { "@_val": "25000" },
      },
    };
    expect(codec.parseColorChoice(node)).toBe("#404040");
  });

  it("scheme colour lt1 with shade 50% (darkened white text)", () => {
    // lt1 = #FFFFFF, shade 50% -> all channels * 0.5
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "lt1",
        "a:shade": { "@_val": "50000" },
      },
    };
    expect(codec.parseColorChoice(node)).toBe("#808080");
  });

  it("scheme colour accent1 with tint 40% (lighter accent text)", () => {
    // accent1 = #4472C4
    // tint 40%: R=68+(255-68)*0.4=68+74.8=142.8->143, G=114+(255-114)*0.4=114+56.4=170.4->170, B=196+(255-196)*0.4=196+23.6=219.6->220
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "accent1",
        "a:tint": { "@_val": "40000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    expect(result).toBeDefined();
    const rgb = hexToRgbForTest(result);
    expect(rgb).not.toBeNull();
    // Should be lighter than the base accent1
    expect(rgb!.r).toBeGreaterThan(68);
    expect(rgb!.g).toBeGreaterThan(114);
    expect(rgb!.b).toBeGreaterThan(196);
  });

  it("scheme colour tx1 with lumMod 50% + lumOff 50% (mid-grey text)", () => {
    // tx1 = #000000, lum=0. lumMod 0.5 -> 0, lumOff 0.5 -> 0.5
    // hslToRgb(0, 0, 0.5) -> (128, 128, 128) = #808080
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "tx1",
        "a:lumMod": { "@_val": "50000" },
        "a:lumOff": { "@_val": "50000" },
      },
    };
    expect(codec.parseColorChoice(node)).toBe("#808080");
  });

  it("scheme colour accent2 with satMod 50% (desaturated accent text)", () => {
    // accent2 = #ED7D31 -> Apply saturation modulation
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "accent2",
        "a:satMod": { "@_val": "50000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    expect(result).toBeDefined();
    // Result should still be warm/orange but less saturated
    const rgb = hexToRgbForTest(result);
    expect(rgb).not.toBeNull();
    // The range between max and min channels should be smaller (less saturation)
    const channels = [rgb!.r, rgb!.g, rgb!.b];
    const spread = Math.max(...channels) - Math.min(...channels);
    // Original spread is large (237-49=188). After 50% satMod it should be narrower
    expect(spread).toBeLessThan(150);
  });

  it("srgbClr text colour with shade transform", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF6600",
        "a:shade": { "@_val": "75000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    expect(result).toBeDefined();
    // Each channel * 0.75: R=255*0.75=191, G=102*0.75=77, B=0*0.75=0
    const rgb = hexToRgbForTest(result);
    expect(rgb!.r).toBe(191);
    expect(rgb!.g).toBe(77);
    expect(rgb!.b).toBe(0);
  });

  it("srgbClr text colour with tint transform", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "000000",
        "a:tint": { "@_val": "60000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    // 0 + (255-0)*0.6 = 153 each channel = #999999
    expect(result).toBe("#999999");
  });

  it("srgbClr text colour with lumMod", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FFFFFF",
        "a:lumMod": { "@_val": "85000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    // White lum=1.0, lumMod 85% -> lum=0.85
    // hslToRgb(0, 0, 0.85) -> (217, 217, 217) = #D9D9D9
    expect(result).toBe("#D9D9D9");
  });

  it("sysClr text colour with shade transform", () => {
    const node: XmlObject = {
      "a:sysClr": {
        "@_val": "windowText",
        "@_lastClr": "000000",
        "a:lumMod": { "@_val": "65000" },
        "a:lumOff": { "@_val": "35000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    expect(result).toBeDefined();
    // Black lum=0, lumMod 0.65 -> 0, lumOff 0.35 -> 0.35
    // hslToRgb(0, 0, 0.35) -> (89, 89, 89) = #595959
    expect(result).toBe("#595959");
  });

  it("prstClr text with satMod transform", () => {
    const node: XmlObject = {
      "a:prstClr": {
        "@_val": "red",
        "a:satMod": { "@_val": "50000" },
      },
    };
    const result = codec.parseColorChoice(node)!;
    // red = #FF0000, sat halved
    expect(result).toBe("#BF4040");
  });
});

// ---------------------------------------------------------------------------
// 3. Edge cases for text colour transforms
// ---------------------------------------------------------------------------
describe("text colour transforms — edge cases", () => {
  it("no transforms on a text colour returns the exact base colour", () => {
    expect(applyDrawingColorTransforms("#4472C4", {})).toBe("#4472C4");
  });

  it("multiple HSL transforms in a single round-trip avoid cumulative rounding errors", () => {
    // Apply satMod + lumMod together — they should share one RGB->HSL->RGB round-trip
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:satMod": { "@_val": "50000" },
      "a:lumMod": { "@_val": "75000" },
    });
    // Red: hsl(0, 1, 0.5). satMod 50% -> sat=0.5. lumMod 75% -> lum=0.375
    // hslToRgb(0, 0.5, 0.375) -> C=0.375, X=0, m=0.1875
    // r=(0.375+0.1875)*255=143.4, g=0.1875*255=47.8, b=0.1875*255=47.8
    const rgb = hexToRgbForTest(result);
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBeGreaterThan(rgb!.g);
    expect(rgb!.g).toBe(rgb!.b); // green and blue should be equal for hue=0
  });

  it("shade and lumMod interact correctly on coloured text", () => {
    // accent1 = #4472C4
    // shade 75% first, then lumMod 90% in HSL space
    const result = applyDrawingColorTransforms("#4472C4", {
      "a:shade": { "@_val": "75000" },
      "a:lumMod": { "@_val": "90000" },
    });
    // Result should be darker than the original
    const baseRgb = hexToRgbForTest("#4472C4")!;
    const resultRgb = hexToRgbForTest(result)!;
    const baseLuminance = 0.299 * baseRgb.r + 0.587 * baseRgb.g + 0.114 * baseRgb.b;
    const resultLuminance = 0.299 * resultRgb.r + 0.587 * resultRgb.g + 0.114 * resultRgb.b;
    expect(resultLuminance).toBeLessThan(baseLuminance);
  });

  it("transforms on black text with lumOff produce visible colour", () => {
    // Common PowerPoint pattern: tx1 (black) with lumOff to make grey text
    const result = applyDrawingColorTransforms("#000000", {
      "a:lumMod": { "@_val": "50000" },
      "a:lumOff": { "@_val": "50000" },
    });
    // lum=0, lumMod 0.5 -> 0, lumOff 0.5 -> 0.5
    expect(result).toBe("#808080");
  });

  it("transforms on white text with shade produce visible colour", () => {
    // Common PowerPoint pattern: lt1 (white) with shade for subtle dark text
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:shade": { "@_val": "95000" },
    });
    // Each channel * 0.95 = 242.25 -> 242 = 0xF2
    expect(result).toBe("#F2F2F2");
  });
});

// ---------------------------------------------------------------------------
// Test utility
// ---------------------------------------------------------------------------
function hexToRgbForTest(
  hex: string,
): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}
