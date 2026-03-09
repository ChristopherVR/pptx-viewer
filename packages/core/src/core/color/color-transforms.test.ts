import { describe, it, expect } from "vitest";
import { applyDrawingColorTransforms } from "./color-transforms";
import type { XmlObject } from "../types";

// Helper to build a color node with a single transform child.
function makeColorNode(transforms: Record<string, unknown>): XmlObject {
  return transforms;
}

describe("applyDrawingColorTransforms", () => {
  // ── Identity (no transforms) ──────────────────────────────────────────

  it("returns the base color unchanged when no transforms are present", () => {
    expect(applyDrawingColorTransforms("#FF0000", {})).toBe("#FF0000");
  });

  it("returns the base color for an invalid hex input", () => {
    expect(applyDrawingColorTransforms("notacolor", {})).toBe("notacolor");
  });

  // ── Structural transforms ─────────────────────────────────────────────

  it("applies complement (a:comp) — rotates hue 180 degrees", () => {
    // Pure red (hue=0) complement should be cyan-ish (hue=180)
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:comp": {},
    });
    // Hue 180, sat 1, lum 0.5 -> #00FFFF (cyan)
    expect(result).toBe("#00FFFF");
  });

  it("applies inverse (a:inv) — negates each RGB channel", () => {
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:inv": {},
    });
    expect(result).toBe("#00FFFF");
  });

  it("applies greyscale (a:gray) using ITU-R BT.601 coefficients", () => {
    // Pure red: gray = round(0.299 * 255 + 0.587 * 0 + 0.114 * 0) = round(76.245) = 76
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:gray": {},
    });
    expect(result).toBe("#4C4C4C"); // 76 decimal = 0x4C
  });

  // ── Shade & Tint ──────────────────────────────────────────────────────

  it("applies shade (a:shade) — darkens toward black", () => {
    // shade = 50000 = 50% → channels * 0.5
    const result = applyDrawingColorTransforms("#FF8040", {
      "a:shade": { "@_val": "50000" },
    });
    // R: 255*0.5=127.5→80, G: 128*0.5=64→40, B: 64*0.5=32→20
    expect(result).toBe("#804020");
  });

  it("shade at 100% leaves color unchanged", () => {
    const result = applyDrawingColorTransforms("#AABBCC", {
      "a:shade": { "@_val": "100000" },
    });
    expect(result).toBe("#AABBCC");
  });

  it("applies tint (a:tint) — lightens toward white", () => {
    // tint = 50000 = 50%. r = 0 + (255-0)*0.5 = 127.5 → 80
    const result = applyDrawingColorTransforms("#000000", {
      "a:tint": { "@_val": "50000" },
    });
    expect(result).toBe("#808080");
  });

  it("tint at 100% produces pure white", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:tint": { "@_val": "100000" },
    });
    expect(result).toBe("#FFFFFF");
  });

  // ── HSL transforms ────────────────────────────────────────────────────

  it("applies absolute hue (a:hue)", () => {
    // Set hue to 120 degrees (green) on a red base
    // 120 * 60000 = 7200000
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:hue": { "@_val": "7200000" },
    });
    // Hue 120, sat 1, lum 0.5 -> green
    expect(result).toBe("#00FF00");
  });

  it("applies saturation modulation (a:satMod)", () => {
    // Halve the saturation of pure red
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:satMod": { "@_val": "50000" },
    });
    // Sat from 1 to 0.5 with hue=0, lum=0.5 → rgb(191, 64, 64) approx
    // hslToRgb(0, 0.5, 0.5) → C = 0.5, X = 0, m = 0.25 → (0.75, 0.25, 0.25)*255 = (191, 64, 64)
    expect(result).toBe("#BF4040");
  });

  it("applies luminance modulation (a:lumMod)", () => {
    // lumMod = 50000 = 0.5 on white (lum=1) → lum=0.5
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:lumMod": { "@_val": "50000" },
    });
    // hslToRgb(0, 0, 0.5) → (128, 128, 128) = #808080
    expect(result).toBe("#808080");
  });

  it("applies luminance offset (a:lumOff)", () => {
    // lumOff = 20000 = 0.2 on black (lum=0) → lum=0.2
    const result = applyDrawingColorTransforms("#000000", {
      "a:lumOff": { "@_val": "20000" },
    });
    // hslToRgb(0, 0, 0.2) → (51, 51, 51) = #333333
    expect(result).toBe("#333333");
  });

  it("applies combined lumMod and lumOff", () => {
    // Start with white (lum=1), lumMod=50000→0.5, lumOff=10000→0.1
    // effective lum = 1 * 0.5 = 0.5, then + 0.1 = 0.6
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:lumMod": { "@_val": "50000" },
      "a:lumOff": { "@_val": "10000" },
    });
    // hslToRgb(0, 0, 0.6) → (153, 153, 153) = #999999
    expect(result).toBe("#999999");
  });

  // ── Direct RGB channel transforms ─────────────────────────────────────

  it("applies absolute red channel (a:red)", () => {
    // Set red to 50% (127.5 → 128) on a black base
    const result = applyDrawingColorTransforms("#000000", {
      "a:red": { "@_val": "50000" },
    });
    expect(result).toBe("#800000");
  });

  it("applies red modulation (a:redMod)", () => {
    // Halve the red channel of pure red
    const result = applyDrawingColorTransforms("#FF0000", {
      "a:redMod": { "@_val": "50000" },
    });
    // 255 * 0.5 = 127.5 → 128 = 0x80
    expect(result).toBe("#800000");
  });

  it("applies red offset (a:redOff)", () => {
    // Add 50% of 255 to a 0 red channel
    const result = applyDrawingColorTransforms("#000000", {
      "a:redOff": { "@_val": "50000" },
    });
    // 0 + 255*0.5 = 127.5 → 128 = 0x80
    expect(result).toBe("#800000");
  });

  it("applies green and blue channel transforms", () => {
    const result = applyDrawingColorTransforms("#000000", {
      "a:green": { "@_val": "100000" },
      "a:blue": { "@_val": "100000" },
    });
    expect(result).toBe("#00FFFF");
  });

  // ── Combined transforms ───────────────────────────────────────────────

  it("applies shade then tint in order", () => {
    // Start with white, shade 50% then tint 50%
    // shade: 255*0.5 = 127.5 for all channels
    // tint: 127.5 + (255-127.5)*0.5 = 127.5 + 63.75 = 191.25 → 191 = 0xBF
    const result = applyDrawingColorTransforms("#FFFFFF", {
      "a:shade": { "@_val": "50000" },
      "a:tint": { "@_val": "50000" },
    });
    expect(result).toBe("#BFBFBF");
  });
});
