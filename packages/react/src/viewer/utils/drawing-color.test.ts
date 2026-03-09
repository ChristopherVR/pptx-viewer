import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCHEME_COLOR_MAP,
  parseDrawingColorChoice,
  parseDrawingColor,
  parseDrawingColorOpacity,
} from "./drawing-color";
import type { XmlObject } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// DEFAULT_SCHEME_COLOR_MAP
// ---------------------------------------------------------------------------

describe("DEFAULT_SCHEME_COLOR_MAP", () => {
  it("has entries for all standard scheme keys", () => {
    const expectedKeys = [
      "dk1",
      "lt1",
      "dk2",
      "lt2",
      "accent1",
      "accent2",
      "accent3",
      "accent4",
      "accent5",
      "accent6",
      "hlink",
      "folHlink",
      "tx1",
      "tx2",
      "bg1",
      "bg2",
      "phclr",
    ];
    for (const key of expectedKeys) {
      expect(DEFAULT_SCHEME_COLOR_MAP[key]).toBeDefined();
    }
  });

  it("dk1 defaults to black", () => {
    expect(DEFAULT_SCHEME_COLOR_MAP.dk1).toBe("#000000");
  });

  it("lt1 defaults to white", () => {
    expect(DEFAULT_SCHEME_COLOR_MAP.lt1).toBe("#FFFFFF");
  });

  it("tx1 matches dk1 (text on dark)", () => {
    expect(DEFAULT_SCHEME_COLOR_MAP.tx1).toBe(
      DEFAULT_SCHEME_COLOR_MAP.dk1,
    );
  });

  it("bg1 matches lt1 (background = light)", () => {
    expect(DEFAULT_SCHEME_COLOR_MAP.bg1).toBe(
      DEFAULT_SCHEME_COLOR_MAP.lt1,
    );
  });

  it("all values are valid hex colour strings", () => {
    for (const value of Object.values(DEFAULT_SCHEME_COLOR_MAP)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColorChoice
// ---------------------------------------------------------------------------

describe("parseDrawingColorChoice", () => {
  it("returns undefined for undefined input", () => {
    expect(parseDrawingColorChoice(undefined)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(parseDrawingColorChoice({})).toBeUndefined();
  });

  it("parses a:srgbClr with valid 6-digit hex", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
    };
    const result = parseDrawingColorChoice(node);
    expect(result).toBe("#FF0000");
  });

  it("parses a:srgbClr with lowercase hex", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "abcdef" },
    };
    const result = parseDrawingColorChoice(node);
    expect(result).toBe("#ABCDEF");
  });

  it("returns undefined for a:srgbClr with invalid value", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "GGGG00" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  it("parses a:sysClr using lastClr attribute", () => {
    const node: XmlObject = {
      "a:sysClr": { "@_lastClr": "000000" },
    };
    const result = parseDrawingColorChoice(node);
    expect(result).toBe("#000000");
  });

  it("returns undefined for a:sysClr with invalid lastClr", () => {
    const node: XmlObject = {
      "a:sysClr": { "@_lastClr": "xyz" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  it("parses a:schemeClr using DEFAULT_SCHEME_COLOR_MAP", () => {
    const node: XmlObject = {
      "a:schemeClr": { "@_val": "accent1" },
    };
    const result = parseDrawingColorChoice(node);
    // Should resolve to the accent1 default, possibly with transforms applied
    expect(result).toBeDefined();
    expect(result!.startsWith("#")).toBe(true);
  });

  it("returns undefined for unknown scheme colour", () => {
    const node: XmlObject = {
      "a:schemeClr": { "@_val": "nonexistent" },
    };
    expect(parseDrawingColorChoice(node)).toBeUndefined();
  });

  it("returns undefined for a:schemeClr with empty val", () => {
    const node: XmlObject = {
      "a:schemeClr": { "@_val": "" },
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

  it("parses direct srgbClr nodes", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "00FF00" },
    };
    expect(parseDrawingColor(node)).toBe("#00FF00");
  });

  it("parses nested a:solidFill wrapper", () => {
    const node: XmlObject = {
      "a:solidFill": {
        "a:srgbClr": { "@_val": "0000FF" },
      },
    };
    expect(parseDrawingColor(node)).toBe("#0000FF");
  });

  it("returns undefined when solidFill is empty", () => {
    const node: XmlObject = {
      "a:solidFill": {},
    };
    expect(parseDrawingColor(node)).toBeUndefined();
  });

  it("prefers direct colour over solidFill wrapper", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
      "a:solidFill": {
        "a:srgbClr": { "@_val": "00FF00" },
      },
    };
    // Direct colour should be preferred
    expect(parseDrawingColor(node)).toBe("#FF0000");
  });

  it("returns undefined for node with no colour info", () => {
    const node: XmlObject = {
      "a:someOtherElement": {},
    };
    expect(parseDrawingColor(node)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseDrawingColorOpacity
// ---------------------------------------------------------------------------

describe("parseDrawingColorOpacity", () => {
  it("returns undefined for undefined input", () => {
    expect(parseDrawingColorOpacity(undefined)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(parseDrawingColorOpacity({})).toBeUndefined();
  });

  it("returns undefined when no alpha info is present", () => {
    const node: XmlObject = {
      "a:srgbClr": { "@_val": "FF0000" },
    };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });

  it("parses alpha from a:srgbClr", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "50000" }, // 50%
      },
    };
    const result = parseDrawingColorOpacity(node);
    expect(result).toBeDefined();
    expect(result).toBeCloseTo(0.5, 2);
  });

  it("parses alpha from a:schemeClr", () => {
    const node: XmlObject = {
      "a:schemeClr": {
        "@_val": "accent1",
        "a:alpha": { "@_val": "75000" }, // 75%
      },
    };
    const result = parseDrawingColorOpacity(node);
    expect(result).toBeDefined();
    expect(result).toBeCloseTo(0.75, 2);
  });

  it("clamps opacity to 0-1 range", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "150000" }, // 150% → should clamp to 1
      },
    };
    const result = parseDrawingColorOpacity(node);
    expect(result).toBeDefined();
    expect(result).toBeLessThanOrEqual(1);
  });

  it("returns full opacity when alpha is 100000", () => {
    const node: XmlObject = {
      "a:srgbClr": {
        "@_val": "FF0000",
        "a:alpha": { "@_val": "100000" }, // 100%
      },
    };
    const result = parseDrawingColorOpacity(node);
    expect(result).toBeDefined();
    expect(result).toBeCloseTo(1, 2);
  });

  it("returns undefined when colour choice has no alpha elements", () => {
    const node: XmlObject = {
      "a:sysClr": {
        "@_lastClr": "000000",
      },
    };
    expect(parseDrawingColorOpacity(node)).toBeUndefined();
  });
});
