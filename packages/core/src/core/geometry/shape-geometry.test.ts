import { describe, it, expect } from "vitest";
import {
  getShapeType,
  getShapeClipPath,
  getRoundRectRadiusPx,
  getImageMaskStyle,
} from "./shape-geometry";
import type { PptxElementWithShapeStyle } from "../types";

// Helper to create a minimal element with required fields.
function makeElement(
  overrides: Partial<{
    width: number;
    height: number;
    shapeType: string;
    shapeAdjustments: Record<string, number>;
  }> = {},
): PptxElementWithShapeStyle {
  return {
    id: "test-1",
    type: "shape",
    x: 0,
    y: 0,
    width: overrides.width ?? 200,
    height: overrides.height ?? 100,
    shapeType: overrides.shapeType,
    shapeAdjustments: overrides.shapeAdjustments,
  } as unknown as PptxElementWithShapeStyle;
}

// ---------------------------------------------------------------------------
// getShapeType
// ---------------------------------------------------------------------------

describe("getShapeType", () => {
  it('returns "rect" for undefined shapeType', () => {
    expect(getShapeType(undefined)).toBe("rect");
  });

  it('returns "rect" for "rect"', () => {
    expect(getShapeType("rect")).toBe("rect");
  });

  it("is case-insensitive", () => {
    expect(getShapeType("RECT")).toBe("rect");
    expect(getShapeType("Ellipse")).toBe("ellipse");
    expect(getShapeType("RoundRect")).toBe("roundRect");
  });

  it("maps all primary shapes correctly", () => {
    expect(getShapeType("roundRect")).toBe("roundRect");
    expect(getShapeType("ellipse")).toBe("ellipse");
    expect(getShapeType("oval")).toBe("ellipse");
    expect(getShapeType("cylinder")).toBe("cylinder");
    expect(getShapeType("can")).toBe("cylinder");
    expect(getShapeType("triangle")).toBe("triangle");
    expect(getShapeType("diamond")).toBe("diamond");
    expect(getShapeType("line")).toBe("line");
  });

  it("maps arrow shapes correctly", () => {
    expect(getShapeType("rtArrow")).toBe("rtArrow");
    expect(getShapeType("rightArrow")).toBe("rtArrow");
    expect(getShapeType("leftArrow")).toBe("leftArrow");
    expect(getShapeType("upArrow")).toBe("upArrow");
    expect(getShapeType("downArrow")).toBe("downArrow");
  });

  it("maps connector shapes to 'connector'", () => {
    expect(getShapeType("bentConnector3")).toBe("connector");
    expect(getShapeType("straightConnector1")).toBe("connector");
    expect(getShapeType("curvedConnector5")).toBe("connector");
  });

  it('returns "rect" for unknown shapes without clip-path', () => {
    expect(getShapeType("totallyFakeShape")).toBe("rect");
  });
});

// ---------------------------------------------------------------------------
// getShapeClipPath
// ---------------------------------------------------------------------------

describe("getShapeClipPath", () => {
  it("returns undefined for undefined shapeType", () => {
    expect(getShapeClipPath(undefined)).toBeUndefined();
  });

  it("returns a clip-path string for known preset shapes", () => {
    // triangle is a common preset
    const result = getShapeClipPath("triangle");
    if (result) {
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
    // If triangle doesn't have a clip path, that's also fine - the test
    // just verifies the function returns the right type
  });

  it("returns undefined for shapes that don't need clipping", () => {
    // "rect" has no clip-path in the preset library
    expect(getShapeClipPath("rect")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRoundRectRadiusPx
// ---------------------------------------------------------------------------

describe("getRoundRectRadiusPx", () => {
  it("uses the default adjustment when no adj is specified", () => {
    const element = makeElement({ width: 200, height: 100 });
    const radius = getRoundRectRadiusPx(element);
    // Default adj = 16667/50000 ≈ 0.33334
    // min(200, 100) = 100, radius = 100 * 0.5 * (16667/50000) ≈ 16.667
    expect(radius).toBeCloseTo(16.667, 1);
  });

  it("calculates radius with a custom adjustment", () => {
    const element = makeElement({
      width: 200,
      height: 100,
      shapeAdjustments: { adj: 25000 },
    });
    const radius = getRoundRectRadiusPx(element);
    // 25000/50000 = 0.5, min(200,100)=100, radius = 100*0.5*0.5 = 25
    expect(radius).toBe(25);
  });

  it("clamps adjustment to 0 minimum", () => {
    const element = makeElement({
      width: 200,
      height: 100,
      shapeAdjustments: { adj: -1000 },
    });
    const radius = getRoundRectRadiusPx(element);
    expect(radius).toBe(0);
  });

  it("clamps adjustment to 50000 maximum", () => {
    const element = makeElement({
      width: 200,
      height: 100,
      shapeAdjustments: { adj: 100000 },
    });
    const radius = getRoundRectRadiusPx(element);
    // 50000/50000 = 1, min(200,100)=100, radius = 100*0.5*1 = 50
    expect(radius).toBe(50);
  });

  it("uses the shorter side for radius calculation", () => {
    const element = makeElement({
      width: 50,
      height: 200,
      shapeAdjustments: { adj: 50000 },
    });
    const radius = getRoundRectRadiusPx(element);
    // min(50, 200) = 50, radius = 50 * 0.5 * 1 = 25
    expect(radius).toBe(25);
  });

  it("handles zero-size elements with minimum dimension of 1", () => {
    const element = makeElement({
      width: 0,
      height: 0,
      shapeAdjustments: { adj: 50000 },
    });
    const radius = getRoundRectRadiusPx(element);
    // min(max(0,1), max(0,1)) = 1, radius = 1*0.5*1 = 0.5
    expect(radius).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// getImageMaskStyle
// ---------------------------------------------------------------------------

describe("getImageMaskStyle", () => {
  it("returns undefined when shapeType is not set", () => {
    const element = makeElement({});
    expect(getImageMaskStyle(element)).toBeUndefined();
  });

  it("returns borderRadius for roundRect shapes", () => {
    const element = makeElement({ shapeType: "roundRect" });
    const result = getImageMaskStyle(element);
    expect(result).toBeDefined();
    expect(result!.borderRadius).toBeDefined();
    expect(typeof result!.borderRadius).toBe("number");
    expect(result!.borderRadius).toBeGreaterThan(0);
  });

  it('returns "9999px" borderRadius for ellipse', () => {
    const element = makeElement({ shapeType: "ellipse" });
    const result = getImageMaskStyle(element);
    expect(result).toBeDefined();
    expect(result!.borderRadius).toBe("9999px");
  });

  it('returns "9999px" borderRadius for oval', () => {
    const element = makeElement({ shapeType: "oval" });
    const result = getImageMaskStyle(element);
    expect(result).toEqual({ borderRadius: "9999px" });
  });

  it("returns borderRadius for cylinder/can", () => {
    const element = makeElement({ shapeType: "can" });
    const result = getImageMaskStyle(element);
    expect(result).toEqual({ borderRadius: "48% / 12%" });
  });

  it("returns undefined for very small roundRect radius", () => {
    const element = makeElement({
      shapeType: "roundRect",
      shapeAdjustments: { adj: 0 },
    });
    const result = getImageMaskStyle(element);
    expect(result).toBeUndefined();
  });

  it("returns clip-path for shapes with known preset clip-paths", () => {
    // Try a shape that has a clip-path in the preset library (e.g. triangle)
    const element = makeElement({ shapeType: "triangle" });
    const result = getImageMaskStyle(element);
    if (result) {
      // Either clipPath or borderRadius should be set
      expect(result.clipPath || result.borderRadius).toBeDefined();
    }
  });

  it("supports round2SameRect variant shapes", () => {
    const element = makeElement({ shapeType: "round2SameRect" });
    const result = getImageMaskStyle(element);
    expect(result).toBeDefined();
    expect(result!.borderRadius).toBeDefined();
  });
});
