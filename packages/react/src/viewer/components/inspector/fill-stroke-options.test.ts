import { describe, it, expect } from "vitest";
import {
  COMPOUND_LINE_OPTIONS,
  LINE_JOIN_OPTIONS,
  LINE_CAP_OPTIONS,
  FILL_MODE_OPTIONS,
  PATTERN_PRESET_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  IMAGE_MODE_OPTIONS,
  getCompoundLinePreviewStyle,
} from "./fill-stroke-options";

// ---------------------------------------------------------------------------
// Helper: assert every item has non-empty value + label and no duplicate values
// ---------------------------------------------------------------------------

function assertOptionArray(
  options: ReadonlyArray<{ value: string; label: string }>,
  name: string,
) {
  it(`${name}: every item has a non-empty value`, () => {
    for (const opt of options) {
      expect(opt.value).toBeTruthy();
      expect(typeof opt.value).toBe("string");
    }
  });

  it(`${name}: every item has a non-empty label`, () => {
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(typeof opt.label).toBe("string");
    }
  });

  it(`${name}: no duplicate values`, () => {
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
}

// ---------------------------------------------------------------------------
// COMPOUND_LINE_OPTIONS
// ---------------------------------------------------------------------------

describe("COMPOUND_LINE_OPTIONS", () => {
  it("has exactly 5 items", () => {
    expect(COMPOUND_LINE_OPTIONS).toHaveLength(5);
  });

  it("contains sng, dbl, thickThin, thinThick, tri", () => {
    const values = COMPOUND_LINE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["sng", "dbl", "thickThin", "thinThick", "tri"]);
  });

  assertOptionArray(COMPOUND_LINE_OPTIONS, "COMPOUND_LINE_OPTIONS");
});

// ---------------------------------------------------------------------------
// LINE_JOIN_OPTIONS
// ---------------------------------------------------------------------------

describe("LINE_JOIN_OPTIONS", () => {
  it("has exactly 3 items", () => {
    expect(LINE_JOIN_OPTIONS).toHaveLength(3);
  });

  it("contains round, bevel, miter", () => {
    const values = LINE_JOIN_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["round", "bevel", "miter"]);
  });

  assertOptionArray(LINE_JOIN_OPTIONS, "LINE_JOIN_OPTIONS");
});

// ---------------------------------------------------------------------------
// LINE_CAP_OPTIONS
// ---------------------------------------------------------------------------

describe("LINE_CAP_OPTIONS", () => {
  it("has exactly 3 items", () => {
    expect(LINE_CAP_OPTIONS).toHaveLength(3);
  });

  it("contains flat, rnd, sq", () => {
    const values = LINE_CAP_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["flat", "rnd", "sq"]);
  });

  assertOptionArray(LINE_CAP_OPTIONS, "LINE_CAP_OPTIONS");
});

// ---------------------------------------------------------------------------
// FILL_MODE_OPTIONS
// ---------------------------------------------------------------------------

describe("FILL_MODE_OPTIONS", () => {
  it("has exactly 5 items", () => {
    expect(FILL_MODE_OPTIONS).toHaveLength(5);
  });

  it("contains solid, gradient, pattern, image, none", () => {
    const values = FILL_MODE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["solid", "gradient", "pattern", "image", "none"]);
  });

  assertOptionArray(FILL_MODE_OPTIONS, "FILL_MODE_OPTIONS");
});

// ---------------------------------------------------------------------------
// PATTERN_PRESET_OPTIONS
// ---------------------------------------------------------------------------

describe("PATTERN_PRESET_OPTIONS", () => {
  it("has 50 or more items", () => {
    expect(PATTERN_PRESET_OPTIONS.length).toBeGreaterThanOrEqual(50);
  });

  it("contains well-known pattern values", () => {
    const values = PATTERN_PRESET_OPTIONS.map((o) => o.value);
    expect(values).toContain("pct5");
    expect(values).toContain("horz");
    expect(values).toContain("vert");
    expect(values).toContain("cross");
    expect(values).toContain("diagCross");
    expect(values).toContain("zigZag");
  });

  assertOptionArray(PATTERN_PRESET_OPTIONS, "PATTERN_PRESET_OPTIONS");
});

// ---------------------------------------------------------------------------
// GRADIENT_TYPE_OPTIONS
// ---------------------------------------------------------------------------

describe("GRADIENT_TYPE_OPTIONS", () => {
  it("has exactly 2 items", () => {
    expect(GRADIENT_TYPE_OPTIONS).toHaveLength(2);
  });

  it("contains linear and radial", () => {
    const values = GRADIENT_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["linear", "radial"]);
  });

  assertOptionArray(GRADIENT_TYPE_OPTIONS, "GRADIENT_TYPE_OPTIONS");
});

// ---------------------------------------------------------------------------
// IMAGE_MODE_OPTIONS
// ---------------------------------------------------------------------------

describe("IMAGE_MODE_OPTIONS", () => {
  it("has exactly 2 items", () => {
    expect(IMAGE_MODE_OPTIONS).toHaveLength(2);
  });

  it("contains stretch and tile", () => {
    const values = IMAGE_MODE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["stretch", "tile"]);
  });

  assertOptionArray(IMAGE_MODE_OPTIONS, "IMAGE_MODE_OPTIONS");
});

// ---------------------------------------------------------------------------
// getCompoundLinePreviewStyle
// ---------------------------------------------------------------------------

describe("getCompoundLinePreviewStyle", () => {
  it("returns a style with borderTop for sng", () => {
    const style = getCompoundLinePreviewStyle("sng");
    expect(style.borderTop).toBeDefined();
    expect(style.width).toBe("100%");
  });

  it("returns a style with boxShadow for dbl", () => {
    const style = getCompoundLinePreviewStyle("dbl");
    expect(style.boxShadow).toBeDefined();
    expect(style.position).toBe("relative");
  });

  it("returns a style with boxShadow for thickThin", () => {
    const style = getCompoundLinePreviewStyle("thickThin");
    expect(style.boxShadow).toBeDefined();
  });

  it("returns a style with boxShadow for thinThick", () => {
    const style = getCompoundLinePreviewStyle("thinThick");
    expect(style.boxShadow).toBeDefined();
  });

  it("returns a style with boxShadow for tri", () => {
    const style = getCompoundLinePreviewStyle("tri");
    expect(style.boxShadow).toBeDefined();
  });

  it("returns an empty object for unknown type", () => {
    const style = getCompoundLinePreviewStyle("unknown");
    expect(Object.keys(style)).toHaveLength(0);
  });
});
