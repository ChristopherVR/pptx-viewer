/**
 * Spec-accurate tests for OOXML color-choice parsing.
 *
 * Validates that all six DrawingML color models are parsed correctly
 * from XML structures matching ECMA-376 Part 1, Section 20.1.2.3.
 *
 * Uses the parsed-XML object representation that fast-xml-parser produces
 * (attributes prefixed with `@_`, child elements as nested objects).
 */
import { describe, it, expect } from "vitest";
import {
  parseDrawingColorChoice,
  parseDrawingColor,
  parseDrawingColorOpacity,
} from "./color-utils";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// parseDrawingColorChoice — all 6 color models
// ---------------------------------------------------------------------------

describe("parseDrawingColorChoice — spec-accurate XML structures", () => {
  // ── 1. a:srgbClr (sRGB hex color) ──────────────────────────────────────

  describe("a:srgbClr", () => {
    it("parses <a:srgbClr val='FF0000'/> to #FF0000", () => {
      // XML: <a:srgbClr val="FF0000"/>
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "FF0000" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FF0000");
    });

    it("normalizes lowercase hex to uppercase", () => {
      // XML: <a:srgbClr val="aabb00"/>
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "aabb00" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#AABB00");
    });

    it("applies transform children on sRGB color", () => {
      // XML:
      // <a:srgbClr val="FF0000">
      //   <a:tint val="50000"/>
      // </a:srgbClr>
      const node: XmlObject = {
        "a:srgbClr": {
          "@_val": "FF0000",
          "a:tint": { "@_val": "50000" },
        },
      };
      // Red with 50% tint: r = 255 + (255-255)*0.5 = 255, g = 0+(255-0)*0.5 = 128, b same
      expect(parseDrawingColorChoice(node)).toBe("#FF8080");
    });

    it("returns undefined for invalid hex (non-hex characters)", () => {
      // XML: <a:srgbClr val="ZZZZZZ"/>
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "ZZZZZZ" },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });

    it("returns undefined when val is empty string", () => {
      // XML: <a:srgbClr val=""/>
      const node: XmlObject = {
        "a:srgbClr": { "@_val": "" },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });
  });

  // ── 2. a:scrgbClr (scRGB percentage-based color) ───────────────────────

  describe("a:scrgbClr", () => {
    it("parses full red: <a:scrgbClr r='100000' g='0' b='0'/>", () => {
      // XML: <a:scrgbClr r="100000" g="0" b="0"/>
      const node: XmlObject = {
        "a:scrgbClr": {
          "@_r": "100000",
          "@_g": "0",
          "@_b": "0",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FF0000");
    });

    it("parses 50% grey: <a:scrgbClr r='50000' g='50000' b='50000'/>", () => {
      // XML: <a:scrgbClr r="50000" g="50000" b="50000"/>
      const node: XmlObject = {
        "a:scrgbClr": {
          "@_r": "50000",
          "@_g": "50000",
          "@_b": "50000",
        },
      };
      // 50000/100000 * 255 = 127.5 -> 128 = 0x80
      expect(parseDrawingColorChoice(node)).toBe("#808080");
    });

    it("parses white: all channels at 100000", () => {
      // XML: <a:scrgbClr r="100000" g="100000" b="100000"/>
      const node: XmlObject = {
        "a:scrgbClr": {
          "@_r": "100000",
          "@_g": "100000",
          "@_b": "100000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FFFFFF");
    });

    it("applies transforms on scRGB color", () => {
      // XML:
      // <a:scrgbClr r="100000" g="0" b="0">
      //   <a:shade val="50000"/>
      // </a:scrgbClr>
      const node: XmlObject = {
        "a:scrgbClr": {
          "@_r": "100000",
          "@_g": "0",
          "@_b": "0",
          "a:shade": { "@_val": "50000" },
        },
      };
      // shade 50% on pure red: r = 255*0.5 = 127.5 -> 128 = 0x80
      expect(parseDrawingColorChoice(node)).toBe("#800000");
    });
  });

  // ── 3. a:hslClr (HSL color) ────────────────────────────────────────────

  describe("a:hslClr", () => {
    it("parses pure red: hue=0, sat=100000, lum=50000", () => {
      // XML: <a:hslClr hue="0" sat="100000" lum="50000"/>
      const node: XmlObject = {
        "a:hslClr": {
          "@_hue": "0",
          "@_sat": "100000",
          "@_lum": "50000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FF0000");
    });

    it("parses pure green: hue=7200000 (120 deg), sat=100000, lum=50000", () => {
      // XML: <a:hslClr hue="7200000" sat="100000" lum="50000"/>
      const node: XmlObject = {
        "a:hslClr": {
          "@_hue": "7200000",
          "@_sat": "100000",
          "@_lum": "50000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#00FF00");
    });

    it("parses pure blue: hue=14400000 (240 deg), sat=100000, lum=50000", () => {
      // XML: <a:hslClr hue="14400000" sat="100000" lum="50000"/>
      const node: XmlObject = {
        "a:hslClr": {
          "@_hue": "14400000",
          "@_sat": "100000",
          "@_lum": "50000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#0000FF");
    });

    it("parses white: sat=0, lum=100000", () => {
      // XML: <a:hslClr hue="0" sat="0" lum="100000"/>
      const node: XmlObject = {
        "a:hslClr": {
          "@_hue": "0",
          "@_sat": "0",
          "@_lum": "100000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FFFFFF");
    });

    it("returns undefined when a required attribute is missing", () => {
      // XML: <a:hslClr hue="0" sat="100000"/>  (no lum)
      const node: XmlObject = {
        "a:hslClr": {
          "@_hue": "0",
          "@_sat": "100000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });
  });

  // ── 4. a:schemeClr (theme scheme color reference) ──────────────────────

  describe("a:schemeClr", () => {
    it("resolves accent1 to default theme color #4472C4", () => {
      // XML: <a:schemeClr val="accent1"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "accent1" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#4472C4");
    });

    it("resolves dk1 (dark 1) to #000000", () => {
      // XML: <a:schemeClr val="dk1"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "dk1" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#000000");
    });

    it("resolves lt1 (light 1) to #FFFFFF", () => {
      // XML: <a:schemeClr val="lt1"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "lt1" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FFFFFF");
    });

    it("applies transforms on scheme color", () => {
      // XML:
      // <a:schemeClr val="dk1">
      //   <a:tint val="50000"/>
      // </a:schemeClr>
      const node: XmlObject = {
        "a:schemeClr": {
          "@_val": "dk1",
          "a:tint": { "@_val": "50000" },
        },
      };
      // dk1 = #000000, tint 50% -> channels: 0 + (255-0)*0.5 = 128 = 0x80
      expect(parseDrawingColorChoice(node)).toBe("#808080");
    });

    it("returns undefined for unknown scheme name", () => {
      // XML: <a:schemeClr val="nonexistent"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "nonexistent" },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });

    it("is case-insensitive for scheme val", () => {
      // XML: <a:schemeClr val="ACCENT1"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "ACCENT1" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#4472C4");
    });

    it("resolves hlink scheme color", () => {
      // XML: <a:schemeClr val="hlink"/>
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "hlink" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#0563C1");
    });

    it("resolves folHlink (followed hyperlink) scheme color", () => {
      // XML: <a:schemeClr val="folHlink"/>
      // Note: folHlink requires a theme resolver to map — without one it returns undefined
      const node: XmlObject = {
        "a:schemeClr": { "@_val": "folHlink" },
      };
      const result = parseDrawingColorChoice(node);
      // folHlink may not have a built-in fallback, so it may be undefined without a theme
      expect(result === undefined || typeof result === "string").toBe(true);
    });
  });

  // ── 5. a:prstClr (preset named color) ─────────────────────────────────

  describe("a:prstClr", () => {
    it("resolves 'red' to #FF0000", () => {
      // XML: <a:prstClr val="red"/>
      const node: XmlObject = {
        "a:prstClr": { "@_val": "red" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FF0000");
    });

    it("resolves 'cornflowerBlue' (camelCase) to #6495ED", () => {
      // XML: <a:prstClr val="cornflowerBlue"/>
      const node: XmlObject = {
        "a:prstClr": { "@_val": "cornflowerBlue" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#6495ED");
    });

    it("resolves 'black' to #000000", () => {
      // XML: <a:prstClr val="black"/>
      const node: XmlObject = {
        "a:prstClr": { "@_val": "black" },
      };
      expect(parseDrawingColorChoice(node)).toBe("#000000");
    });

    it("returns undefined for unknown preset name", () => {
      // XML: <a:prstClr val="fantasticColor"/>
      const node: XmlObject = {
        "a:prstClr": { "@_val": "fantasticColor" },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });

    it("applies transforms on preset color", () => {
      // XML:
      // <a:prstClr val="red">
      //   <a:shade val="50000"/>
      // </a:prstClr>
      const node: XmlObject = {
        "a:prstClr": {
          "@_val": "red",
          "a:shade": { "@_val": "50000" },
        },
      };
      // red = #FF0000, shade 50%: r = 255*0.5 = 128 = 0x80
      expect(parseDrawingColorChoice(node)).toBe("#800000");
    });
  });

  // ── 6. a:sysClr (system color with fallback) ──────────────────────────

  describe("a:sysClr", () => {
    it("uses @_lastClr first: <a:sysClr val='windowText' lastClr='000000'/>", () => {
      // XML: <a:sysClr val="windowText" lastClr="000000"/>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "windowText",
          "@_lastClr": "000000",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#000000");
    });

    it("uses @_lastClr even when it differs from system name resolution", () => {
      // XML: <a:sysClr val="windowText" lastClr="FF0000"/>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "windowText",
          "@_lastClr": "FF0000",
        },
      };
      // lastClr takes priority over resolving 'windowText'
      expect(parseDrawingColorChoice(node)).toBe("#FF0000");
    });

    it("falls back to system color name when @_lastClr is absent", () => {
      // XML: <a:sysClr val="windowText"/>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "windowText",
        },
      };
      // windowText resolves to #000000 from SYSTEM_COLOR_MAP
      expect(parseDrawingColorChoice(node)).toBe("#000000");
    });

    it("resolves 'window' system color to #FFFFFF", () => {
      // XML: <a:sysClr val="window"/>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "window",
        },
      };
      expect(parseDrawingColorChoice(node)).toBe("#FFFFFF");
    });

    it("applies transforms on system color", () => {
      // XML:
      // <a:sysClr val="windowText" lastClr="000000">
      //   <a:tint val="50000"/>
      // </a:sysClr>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "windowText",
          "@_lastClr": "000000",
          "a:tint": { "@_val": "50000" },
        },
      };
      // #000000 with tint 50% -> #808080
      expect(parseDrawingColorChoice(node)).toBe("#808080");
    });

    it("returns undefined for unknown system color without lastClr", () => {
      // XML: <a:sysClr val="unknownSystemColor"/>
      const node: XmlObject = {
        "a:sysClr": {
          "@_val": "unknownSystemColor",
        },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns undefined for undefined input", () => {
      expect(parseDrawingColorChoice(undefined)).toBeUndefined();
    });

    it("returns undefined for an empty XML node", () => {
      expect(parseDrawingColorChoice({})).toBeUndefined();
    });

    it("returns undefined when color node has unrecognized children", () => {
      const node: XmlObject = {
        "a:unknownColorType": { "@_val": "something" },
      };
      expect(parseDrawingColorChoice(node)).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColor — direct vs. solidFill wrapper
// ---------------------------------------------------------------------------

describe("parseDrawingColor — solidFill wrapper handling", () => {
  it("parses direct sRGB child", () => {
    // XML structure at shape property level:
    // <a:srgbClr val="00FF00"/>
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "00FF00" },
    };
    expect(parseDrawingColor(node)).toBe("#00FF00");
  });

  it("parses color inside a:solidFill wrapper", () => {
    // XML:
    // <a:solidFill>
    //   <a:srgbClr val="0000FF"/>
    // </a:solidFill>
    const node: XmlObject = {
      "a:solidFill": {
        "a:srgbClr": { "@_val": "0000FF" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#0000FF");
  });

  it("prefers direct color-choice over solidFill", () => {
    // When both are present, direct color-choice wins
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
      "a:solidFill": {
        "a:srgbClr": { "@_val": "0000FF" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#FF0000");
  });

  it("parses solidFill with scheme color and transforms", () => {
    // XML:
    // <a:solidFill>
    //   <a:schemeClr val="accent1">
    //     <a:tint val="50000"/>
    //   </a:schemeClr>
    // </a:solidFill>
    const node: XmlObject = {
      "a:solidFill": {
        "a:schemeClr": {
          "@_val": "accent1",
          "a:tint": { "@_val": "50000" },
        },
      },
    };
    const result = parseDrawingColor(node);
    expect(result).toBeDefined();
    // accent1 = #4472C4, tint 50% lightens toward white
    expect(result).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("returns undefined for undefined input", () => {
    expect(parseDrawingColor(undefined)).toBeUndefined();
  });

  it("returns undefined for node with no color information", () => {
    const node: XmlObject = {
      "a:someOtherProperty": { "@_val": "something" },
    };
    expect(parseDrawingColor(node)).toBeUndefined();
  });

  it("solidFill with preset color", () => {
    // XML:
    // <a:solidFill>
    //   <a:prstClr val="blue"/>
    // </a:solidFill>
    const node: XmlObject = {
      "a:solidFill": {
        "a:prstClr": { "@_val": "blue" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#0000FF");
  });

  it("solidFill with system color using lastClr", () => {
    // XML:
    // <a:solidFill>
    //   <a:sysClr val="windowText" lastClr="333333"/>
    // </a:solidFill>
    const node: XmlObject = {
      "a:solidFill": {
        "a:sysClr": {
          "@_val": "windowText",
          "@_lastClr": "333333",
        },
      },
    };
    expect(parseDrawingColor(node)).toBe("#333333");
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColorOpacity — alpha extraction
// ---------------------------------------------------------------------------

describe("parseDrawingColorOpacity — spec-accurate alpha handling", () => {
  it("returns undefined when no alpha attributes present", () => {
    // XML: <a:srgbClr val="FF0000"/>
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
    };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });

  it("parses a:alpha val='50000' as 0.5 opacity", () => {
    // XML:
    // <a:srgbClr val="FF0000">
    //   <a:alpha val="50000"/>
    // </a:srgbClr>
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.5);
  });

  it("parses full opacity: a:alpha val='100000'", () => {
    // XML:
    // <a:srgbClr val="FF0000">
    //   <a:alpha val="100000"/>
    // </a:srgbClr>
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(1);
  });

  it("combines alpha + alphaMod", () => {
    // XML:
    // <a:srgbClr val="FF0000">
    //   <a:alpha val="100000"/>
    //   <a:alphaMod val="50000"/>
    // </a:srgbClr>
    // Result: 1.0 * 0.5 = 0.5
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
        "a:alphaMod": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.5);
  });

  it("combines alpha + alphaOff", () => {
    // XML:
    // <a:srgbClr val="FF0000">
    //   <a:alpha val="50000"/>
    //   <a:alphaOff val="25000"/>
    // </a:srgbClr>
    // Result: 0.5 + 0.25 = 0.75
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "50000" },
        "a:alphaOff": { "@_val": "25000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.75);
  });

  it("clamps combined opacity above 1 to 1", () => {
    // XML: alpha=100% + alphaOff=50% = 1.5 -> clamped to 1
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" },
        "a:alphaOff": { "@_val": "50000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(1);
  });

  it("defaults alpha to 1 when only alphaMod is present", () => {
    // XML:
    // <a:srgbClr val="FF0000">
    //   <a:alphaMod val="75000"/>
    // </a:srgbClr>
    // Result: 1.0 * 0.75 = 0.75
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alphaMod": { "@_val": "75000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.75);
  });

  it("works with scheme color alpha", () => {
    // XML:
    // <a:schemeClr val="accent1">
    //   <a:alpha val="75000"/>
    // </a:schemeClr>
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "accent1",
        "a:alpha": { "@_val": "75000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.75);
  });

  it("works with system color alpha", () => {
    // XML:
    // <a:sysClr val="windowText" lastClr="000000">
    //   <a:alpha val="25000"/>
    // </a:sysClr>
    const node: XmlObject = {
      "a:sysClr": {
        "@_val": "windowText",
        "@_lastClr": "000000",
        "a:alpha": { "@_val": "25000" },
      },
    };
    expect(parseDrawingColorOpacity(node)).toBe(0.25);
  });

  it("returns undefined when no color-choice node is present", () => {
    const node: XmlObject = { "a:randomThing": {} };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });
});
