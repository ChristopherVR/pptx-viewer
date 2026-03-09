import { describe, it, expect } from "vitest";
import {
  parseDrawingColorChoice,
  parseDrawingColor,
  parseDrawingColorOpacity,
} from "./color-utils";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// parseDrawingColorChoice
// ---------------------------------------------------------------------------

describe("parseDrawingColorChoice", () => {
  it("returns undefined for undefined input", () => {
    expect(parseDrawingColorChoice(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty node", () => {
    expect(parseDrawingColorChoice({})).toBeUndefined();
  });

  // ── sRGB colour ─────────────────────────────────────────────────────

  it("parses a:srgbClr with valid hex", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
    };
    expect(parseDrawingColorChoice(node)).toBe("#FF0000");
  });

  it("uppercases sRGB hex values", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "aabbcc" },
    };
    expect(parseDrawingColorChoice(node)).toBe("#AABBCC");
  });

  it("returns undefined for invalid sRGB hex", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "GGGGGG" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  it("applies transforms to sRGB colors", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:shade": { "@_val": "50000" },
      },
    };
    const result = parseDrawingColorChoice(node);
    expect(result).toBe("#800000");
  });

  // ── scRGB colour ────────────────────────────────────────────────────

  it("parses a:scrgbClr with percentage-based RGB", () => {
    const node: XmlObject = {
      "a:scrgbClr": {
        "@_r": "100000",
        "@_g": "0",
        "@_b": "0",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#FF0000");
  });

  it("parses a:scrgbClr with partial values", () => {
    const node: XmlObject = {
      "a:scrgbClr": {
        "@_r": "50000",
        "@_g": "50000",
        "@_b": "50000",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#808080");
  });

  // ── System colour ──────────────────────────────────────────────────

  it("parses a:sysClr using @_lastClr first", () => {
    const node: XmlObject = {
      "a:sysClr": {
        "@_val": "windowText",
        "@_lastClr": "FF0000",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#FF0000");
  });

  it("falls back to system color name when @_lastClr is missing", () => {
    const node: XmlObject = {
      "a:sysClr": {
        "@_val": "windowText",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#000000");
  });

  it("returns undefined for unknown system color name without lastClr", () => {
    const node: XmlObject = {
      "a:sysClr": {
        "@_val": "nonexistentColor",
      },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  // ── Scheme colour ──────────────────────────────────────────────────

  it("parses a:schemeClr from the default scheme map", () => {
    const node: XmlObject = {
      "a:schemeClr": { "@_val": "accent1" },
    };
    const result = parseDrawingColorChoice(node);
    // Default accent1 is #4472C4
    expect(result).toBe("#4472C4");
  });

  it("parses scheme color with transforms", () => {
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "dk1",
        // dk1 = #000000, tint 50% → #808080
        "a:tint": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#808080");
  });

  it("returns undefined for unknown scheme color", () => {
    const node: XmlObject = {
      "a:schemeClr": { "@_val": "nonexistent" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  // ── HSL colour ─────────────────────────────────────────────────────

  it("parses a:hslClr", () => {
    // Hue 0 (= red), Sat 100%, Lum 50%
    const node: XmlObject = {
      "a:hslClr": {
        "@_hue": "0",
        "@_sat": "100000",
        "@_lum": "50000",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#FF0000");
  });

  it("parses a:hslClr for green", () => {
    // Hue 120deg = 7200000/60000, Sat 100%, Lum 50%
    const node: XmlObject = {
      "a:hslClr": {
        "@_hue": "7200000",
        "@_sat": "100000",
        "@_lum": "50000",
      },
    };
    expect(parseDrawingColorChoice(node)).toBe("#00FF00");
  });

  // ── Preset colour ─────────────────────────────────────────────────

  it("parses a:prstClr for known preset names", () => {
    const node: XmlObject = {
      "a:prstClr": { "@_val": "red" },
    };
    expect(parseDrawingColorChoice(node)).toBe("#FF0000");
  });

  it("parses a:prstClr for case-insensitive preset names", () => {
    const node: XmlObject = {
      "a:prstClr": { "@_val": "CornflowerBlue" },
    };
    expect(parseDrawingColorChoice(node)).toBe("#6495ED");
  });

  it("returns undefined for unknown preset names", () => {
    const node: XmlObject = {
      "a:prstClr": { "@_val": "nonexistentcolor" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColor
// ---------------------------------------------------------------------------

describe("parseDrawingColor", () => {
  it("returns undefined for undefined input", () => {
    expect(parseDrawingColor(undefined)).toBeUndefined();
  });

  it("parses direct color-choice children", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "00FF00" },
    };
    expect(parseDrawingColor(node)).toBe("#00FF00");
  });

  it("parses a:solidFill wrapper", () => {
    const node: XmlObject = {
      "a:solidFill": {
        "a:srgbClr": { "@_val": "0000FF" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#0000FF");
  });

  it("prefers direct color over solidFill wrapper", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
      "a:solidFill": {
        "a:srgbClr": { "@_val": "0000FF" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColorOpacity
// ---------------------------------------------------------------------------

describe("parseDrawingColorOpacity", () => {
  it("returns undefined for undefined input", () => {
    expect(parseDrawingColorOpacity(undefined)).toBeUndefined();
  });

  it("returns undefined when no alpha attributes are present", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
    };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });

  it("returns undefined when no color-choice type is present", () => {
    const node: XmlObject = { "a:something": {} };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });

  it("parses alpha value", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.5);
  });

  it("parses alpha at 100%", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(1);
  });

  it("applies alphaMod to base alpha", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
        "a:alphaMod": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.5);
  });

  it("defaults base alpha to 1 when only alphaMod is present", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alphaMod": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.5);
  });

  it("applies alphaOff to the computed opacity", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "50000" },
        "a:alphaOff": { "@_val": "25000" },
      },
    };
    // 0.5 + 0.25 = 0.75
    expect(parseDrawingColorOpacity(node)).toBe(0.75);
  });

  it("clamps the final opacity to [0, 1]", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
        "a:alphaOff": { "@_val": "50000" },
      },
    };
    // 1 + 0.5 = 1.5 → clamped to 1
    expect(parseDrawingColorOpacity(node)).toBe(1);
  });

  it("works with scheme colors", () => {
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "accent1",
        "a:alpha": { "@_val": "75000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.75);
  });
});
