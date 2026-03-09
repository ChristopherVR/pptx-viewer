import { describe, it, expect } from "vitest";
import { PptxColorStyleCodec } from "./PptxColorStyleCodec";
import type { XmlObject } from "../../types";

/**
 * Build a real PptxColorStyleCodec with simple (but functional) stubs
 * for the context dependencies.
 */
function createCodec() {
  return new PptxColorStyleCodec({
    emuPerPx: 9525, // standard 96 DPI: 1 px = 9525 EMU
    ensureArray: (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (value === undefined || value === null) return [];
      return [value];
    },
    resolveThemeColor: (schemeKey: string) => {
      const map: Record<string, string> = {
        accent1: "#4472C4",
        accent2: "#ED7D31",
        dk1: "#000000",
        lt1: "#FFFFFF",
      };
      return map[schemeKey];
    },
  });
}

describe("PptxColorStyleCodec", () => {
  const codec = createCodec();

  // ── extractColorChoiceNode ───────────────────────────────────────────

  describe("extractColorChoiceNode", () => {
    it("returns undefined for undefined input", () => {
      expect(codec.extractColorChoiceNode(undefined)).toBeUndefined();
    });

    it("extracts a:srgbClr node", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "FF0000" },
      };
      expect(codec.extractColorChoiceNode(node)).toEqual({ "@_val": "FF0000" });
    });

    it("extracts a:schemeClr node", () => {
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "accent1" },
      };
      expect(codec.extractColorChoiceNode(node)).toEqual({
        "@_val": "accent1",
      });
    });

    it("extracts a:prstClr node", () => {
      const node: XmlObject = {
        "a:prstClr": { "@_val": "blue" },
      };
      expect(codec.extractColorChoiceNode(node)).toEqual({ "@_val": "blue" });
    });

    it("extracts a:sysClr node", () => {
      const node: XmlObject = {
        "a:sysClr": { "@_val": "windowText", "@_lastClr": "000000" },
      };
      expect(codec.extractColorChoiceNode(node)).toEqual({
        "@_val": "windowText",
        "@_lastClr": "000000",
      });
    });

    it("returns undefined for empty node", () => {
      expect(codec.extractColorChoiceNode({})).toBeUndefined();
    });

    it("prefers a:srgbClr when multiple are present", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "AABBCC" },
        "a:schemeClr": { "@_val": "accent1" },
      };
      // a:srgbClr appears first in the candidate list
      expect(codec.extractColorChoiceNode(node)).toEqual({
        "@_val": "AABBCC",
      });
    });
  });

  // ── extractColorOpacity ──────────────────────────────────────────────

  describe("extractColorOpacity", () => {
    it("returns undefined when no alpha transforms present", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "FF0000" },
      };
      expect(codec.extractColorOpacity(node)).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      expect(codec.extractColorOpacity(undefined)).toBeUndefined();
    });

    it("extracts a:alpha value (50000 = 50%)", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:alpha": { "@_val": "50000" },
        },
      };
      expect(codec.extractColorOpacity(node)).toBe(0.5);
    });

    it("extracts full opacity a:alpha (100000 = 100%)", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:alpha": { "@_val": "100000" },
        },
      };
      expect(codec.extractColorOpacity(node)).toBe(1);
    });

    it("applies alphaMod to base alpha", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:alpha": { "@_val": "100000" },
          "a:alphaMod": { "@_val": "50000" },
        },
      };
      // alpha=1.0, then * 0.5 = 0.5
      expect(codec.extractColorOpacity(node)).toBe(0.5);
    });

    it("applies alphaOff to base alpha", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:alpha": { "@_val": "50000" },
          "a:alphaOff": { "@_val": "25000" },
        },
      };
      // alpha=0.5, then + 0.25 = 0.75
      expect(codec.extractColorOpacity(node)).toBe(0.75);
    });

    it("clamps opacity above 1 down to 1", () => {
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:alpha": { "@_val": "100000" },
          "a:alphaOff": { "@_val": "50000" },
        },
      };
      // alpha=1.0 + 0.5 = 1.5 → clamped to 1
      expect(codec.extractColorOpacity(node)).toBe(1);
    });
  });

  // ── colorWithOpacity ─────────────────────────────────────────────────

  describe("colorWithOpacity", () => {
    it("returns the color unchanged when opacity is undefined", () => {
      expect(codec.colorWithOpacity("#FF0000", undefined)).toBe("#FF0000");
    });

    it("formats rgba for valid hex with opacity", () => {
      expect(codec.colorWithOpacity("#FF0000", 0.5)).toBe(
        "rgba(255, 0, 0, 0.5)",
      );
    });

    it("formats rgba with full opacity", () => {
      expect(codec.colorWithOpacity("#00FF00", 1)).toBe(
        "rgba(0, 255, 0, 1)",
      );
    });

    it("clamps opacity to [0, 1] range", () => {
      expect(codec.colorWithOpacity("#0000FF", 1.5)).toBe(
        "rgba(0, 0, 255, 1)",
      );
    });

    it("returns original color for invalid hex", () => {
      expect(codec.colorWithOpacity("notahex", 0.5)).toBe("notahex");
    });
  });

  // ── parseColor + parseColorChoice (integration via codec) ───────────

  describe("parseColor (integration)", () => {
    it("parses sRGB color", () => {
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "4472C4" },
      };
      expect(codec.parseColor(node)).toBe("#4472C4");
    });

    it("parses scheme color via theme resolution", () => {
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "accent2" },
      };
      expect(codec.parseColor(node)).toBe("#ED7D31");
    });
  });

  // ── hexToRgb / rgbToHex round-trip ───────────────────────────────────

  describe("hex/rgb round-trip", () => {
    it("round-trips #4472C4", () => {
      const rgb = codec.hexToRgb("#4472C4");
      expect(rgb).toBeDefined();
      expect(codec.rgbToHex(rgb!.r, rgb!.g, rgb!.b)).toBe("#4472C4");
    });

    it("round-trips #000000", () => {
      const rgb = codec.hexToRgb("#000000");
      expect(rgb).toBeDefined();
      expect(codec.rgbToHex(rgb!.r, rgb!.g, rgb!.b)).toBe("#000000");
    });

    it("round-trips #FFFFFF", () => {
      const rgb = codec.hexToRgb("#FFFFFF");
      expect(rgb).toBeDefined();
      expect(codec.rgbToHex(rgb!.r, rgb!.g, rgb!.b)).toBe("#FFFFFF");
    });
  });
});
