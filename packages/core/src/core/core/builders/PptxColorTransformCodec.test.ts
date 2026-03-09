import { describe, it, expect } from "vitest";
import { PptxColorTransformCodec } from "./PptxColorTransformCodec";
import type { XmlObject } from "../../types";

// Stub theme resolver — maps common scheme colour keys to fixed hex values.
const THEME_COLORS: Record<string, string> = {
  accent1: "#4472C4",
  accent2: "#ED7D31",
  dk1: "#000000",
  lt1: "#FFFFFF",
  tx1: "#000000",
  bg1: "#FFFFFF",
};

function createCodec() {
  return new PptxColorTransformCodec({
    resolveThemeColor: (key: string) => THEME_COLORS[key],
  });
}

describe("PptxColorTransformCodec", () => {
  const codec = createCodec();

  // ── percentAttrToUnit ────────────────────────────────────────────────

  describe("percentAttrToUnit", () => {
    it("converts 100000 (100%) to 1.0", () => {
      expect(codec.percentAttrToUnit("100000")).toBe(1);
    });

    it("converts 50000 (50%) to 0.5", () => {
      expect(codec.percentAttrToUnit("50000")).toBe(0.5);
    });

    it("converts 0 to 0", () => {
      expect(codec.percentAttrToUnit("0")).toBe(0);
    });

    it("returns undefined for non-numeric input", () => {
      expect(codec.percentAttrToUnit("abc")).toBeUndefined();
      expect(codec.percentAttrToUnit(undefined)).toBeUndefined();
      expect(codec.percentAttrToUnit("")).toBeUndefined();
    });

    it("clamps values above 100000 to 1.0", () => {
      expect(codec.percentAttrToUnit("200000")).toBe(1);
    });

    it("clamps negative values to 0", () => {
      expect(codec.percentAttrToUnit("-50000")).toBe(0);
    });
  });

  // ── clampUnitInterval ────────────────────────────────────────────────

  describe("clampUnitInterval", () => {
    it("clamps values above 1 to 1", () => {
      expect(codec.clampUnitInterval(1.5)).toBe(1);
    });

    it("clamps values below 0 to 0", () => {
      expect(codec.clampUnitInterval(-0.5)).toBe(0);
    });

    it("preserves values within [0, 1]", () => {
      expect(codec.clampUnitInterval(0.75)).toBe(0.75);
    });
  });

  // ── hexToRgb ─────────────────────────────────────────────────────────

  describe("hexToRgb", () => {
    it("parses #RRGGBB with hash prefix", () => {
      expect(codec.hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("parses RRGGBB without hash prefix", () => {
      expect(codec.hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("returns undefined for invalid hex strings", () => {
      expect(codec.hexToRgb("ZZZ")).toBeUndefined();
      expect(codec.hexToRgb("#12345")).toBeUndefined();
      expect(codec.hexToRgb("")).toBeUndefined();
    });

    it("handles lower-case hex digits", () => {
      expect(codec.hexToRgb("#aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
    });
  });

  // ── rgbToHex ─────────────────────────────────────────────────────────

  describe("rgbToHex", () => {
    it("converts (255, 0, 0) to #FF0000", () => {
      expect(codec.rgbToHex(255, 0, 0)).toBe("#FF0000");
    });

    it("pads single-digit hex channels", () => {
      expect(codec.rgbToHex(0, 0, 15)).toBe("#00000F");
    });

    it("clamps channel values above 255", () => {
      expect(codec.rgbToHex(300, 0, 0)).toBe("#FF0000");
    });

    it("clamps negative channel values to 0", () => {
      expect(codec.rgbToHex(-10, 0, 0)).toBe("#000000");
    });
  });

  // ── applyColorTransforms ─────────────────────────────────────────────

  describe("applyColorTransforms", () => {
    it("returns base color unchanged when no transforms present", () => {
      expect(codec.applyColorTransforms("#FF0000", {})).toBe("#FF0000");
    });

    it("applies shade (a:shade) — darkens toward black", () => {
      // shade 50% => channels * 0.5
      const result = codec.applyColorTransforms("#FF8040", {
        "a:shade": { "@_val": "50000" },
      });
      // R: 255*0.5=127.5→128=80, G: 128*0.5=64→40, B: 64*0.5=32→20
      expect(result).toBe("#804020");
    });

    it("applies tint (a:tint) — lightens toward white", () => {
      // tint 50% on black: 0 + (255-0)*0.5 = 127.5 → 128 = 0x80
      const result = codec.applyColorTransforms("#000000", {
        "a:tint": { "@_val": "50000" },
      });
      expect(result).toBe("#808080");
    });

    it("applies lumMod — luminance modulation", () => {
      // lumMod 50% on white: 255*0.5 = 127.5 → 128 = 0x80
      const result = codec.applyColorTransforms("#FFFFFF", {
        "a:lumMod": { "@_val": "50000" },
      });
      expect(result).toBe("#808080");
    });

    it("applies lumOff — luminance offset", () => {
      // lumOff 50% on black: 0 + 255*0.5 = 127.5 → 128 = 0x80
      const result = codec.applyColorTransforms("#000000", {
        "a:lumOff": { "@_val": "50000" },
      });
      expect(result).toBe("#808080");
    });

    it("applies combined shade + tint sequentially", () => {
      // White: shade 50% -> 255*0.5=127.5 for all channels
      // tint 50%: 127.5 + (255-127.5)*0.5 = 127.5 + 63.75 = 191.25 → round(191.25) = 191 = 0xBF
      const result = codec.applyColorTransforms("#FFFFFF", {
        "a:shade": { "@_val": "50000" },
        "a:tint": { "@_val": "50000" },
      });
      expect(result).toBe("#BFBFBF");
    });

    it("returns base color for invalid hex input", () => {
      expect(codec.applyColorTransforms("notacolor", {})).toBe("notacolor");
    });
  });

  // ── parseColorChoice ─────────────────────────────────────────────────

  describe("parseColorChoice", () => {
    it("returns undefined for undefined input", () => {
      expect(codec.parseColorChoice(undefined)).toBeUndefined();
    });

    it("parses a:srgbClr node", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "FF6600" },
      };
      expect(codec.parseColorChoice(node)).toBe("#FF6600");
    });

    it("parses a:srgbClr with transforms", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:shade": { "@_val": "50000" },
        },
      };
      // Red + shade 50%: 255*0.5 = 128 = 0x80
      expect(codec.parseColorChoice(node)).toBe("#800000");
    });

    it("parses a:schemeClr by resolving from theme", () => {
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "accent1" },
      };
      expect(codec.parseColorChoice(node)).toBe("#4472C4");
    });

    it("parses a:schemeClr with phClr using placeholder color", () => {
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "phClr" },
      };
      expect(codec.parseColorChoice(node, "#AABBCC")).toBe("#AABBCC");
    });

    it("parses a:sysClr using lastClr attribute", () => {
      const node: XmlObject = {
        "a:sysClr": { "@_val": "windowText", "@_lastClr": "000000" },
      };
      expect(codec.parseColorChoice(node)).toBe("#000000");
    });

    it("parses a:prstClr for preset colour names", () => {
      const node: XmlObject = {
        "a:prstClr": { "@_val": "red" },
      };
      expect(codec.parseColorChoice(node)).toBe("#FF0000");
    });

    it("returns undefined for unknown scheme key", () => {
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "unknownKey" },
      };
      expect(codec.parseColorChoice(node)).toBeUndefined();
    });

    it("parses a:scrgbClr (percentage-based RGB)", () => {
      // 100% red, 0% green, 0% blue
      const node: XmlObject = {
        "a:scrgbClr": {
          "@_r": "100000",
          "@_g": "0",
          "@_b": "0",
        },
      };
      expect(codec.parseColorChoice(node)).toBe("#FF0000");
    });
  });

  // ── parseColor ───────────────────────────────────────────────────────

  describe("parseColor", () => {
    it("returns undefined for undefined input", () => {
      expect(codec.parseColor(undefined)).toBeUndefined();
    });

    it("delegates to parseColorChoice", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "00CCFF" },
      };
      expect(codec.parseColor(node)).toBe("#00CCFF");
    });
  });
});
