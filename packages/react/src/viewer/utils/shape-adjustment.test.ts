import { describe, it, expect } from "vitest";
import {
  clampShapeAdjustmentValue,
  getRoundRectAdjustmentValue,
  getRoundRectRadiusPx,
  getDraggedShapeAdjustmentValue,
} from "./shape-adjustment";
import {
  SHAPE_ADJUSTMENT_MAX,
  SHAPE_ADJUSTMENT_MIN,
  DEFAULT_ROUND_RECT_ADJUSTMENT,
} from "../constants";
import type { PptxElementWithShapeStyle } from "pptx-viewer-core";
import type { ShapeAdjustmentDragState } from "../types";

describe("clampShapeAdjustmentValue", () => {
  it("clamps below minimum to SHAPE_ADJUSTMENT_MIN", () => {
    expect(clampShapeAdjustmentValue(-100)).toBe(SHAPE_ADJUSTMENT_MIN);
  });

  it("clamps above maximum to SHAPE_ADJUSTMENT_MAX", () => {
    expect(clampShapeAdjustmentValue(100000)).toBe(SHAPE_ADJUSTMENT_MAX);
  });

  it("rounds to nearest integer", () => {
    expect(clampShapeAdjustmentValue(25000.7)).toBe(25001);
    expect(clampShapeAdjustmentValue(25000.3)).toBe(25000);
  });

  it("passes through valid values unchanged", () => {
    expect(clampShapeAdjustmentValue(25000)).toBe(25000);
  });

  it("accepts exact minimum", () => {
    expect(clampShapeAdjustmentValue(SHAPE_ADJUSTMENT_MIN)).toBe(
      SHAPE_ADJUSTMENT_MIN,
    );
  });

  it("accepts exact maximum", () => {
    expect(clampShapeAdjustmentValue(SHAPE_ADJUSTMENT_MAX)).toBe(
      SHAPE_ADJUSTMENT_MAX,
    );
  });
});

describe("getRoundRectAdjustmentValue", () => {
  it("returns the element's adjustment value when valid", () => {
    const element = {
      shapeAdjustments: { adj: 10000 },
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(10000);
  });

  it("returns DEFAULT when no adjustments object", () => {
    const element = {} as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(
      DEFAULT_ROUND_RECT_ADJUSTMENT,
    );
  });

  it("returns DEFAULT when adj is undefined", () => {
    const element = {
      shapeAdjustments: {},
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(
      DEFAULT_ROUND_RECT_ADJUSTMENT,
    );
  });

  it("returns DEFAULT for NaN adjustment", () => {
    const element = {
      shapeAdjustments: { adj: NaN },
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(
      DEFAULT_ROUND_RECT_ADJUSTMENT,
    );
  });

  it("returns DEFAULT for Infinity adjustment", () => {
    const element = {
      shapeAdjustments: { adj: Infinity },
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(
      DEFAULT_ROUND_RECT_ADJUSTMENT,
    );
  });

  it("clamps out-of-range adjustment values", () => {
    const element = {
      shapeAdjustments: { adj: -500 },
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectAdjustmentValue(element)).toBe(SHAPE_ADJUSTMENT_MIN);
  });
});

describe("getRoundRectRadiusPx", () => {
  it("computes radius for default adjustment", () => {
    const element = {
      width: 200,
      height: 100,
      shapeAdjustments: { adj: DEFAULT_ROUND_RECT_ADJUSTMENT },
    } as unknown as PptxElementWithShapeStyle;
    const radius = getRoundRectRadiusPx(element);
    // min(200,100) * 0.5 * (16667/50000) ≈ 16.667
    expect(radius).toBeCloseTo(16.667, 0);
  });

  it("returns 0 for zero adjustment", () => {
    const element = {
      width: 100,
      height: 100,
      shapeAdjustments: { adj: 0 },
    } as unknown as PptxElementWithShapeStyle;
    expect(getRoundRectRadiusPx(element)).toBe(0);
  });

  it("uses smaller dimension", () => {
    const narrow = {
      width: 50,
      height: 200,
      shapeAdjustments: { adj: SHAPE_ADJUSTMENT_MAX },
    } as unknown as PptxElementWithShapeStyle;
    const wide = {
      width: 200,
      height: 50,
      shapeAdjustments: { adj: SHAPE_ADJUSTMENT_MAX },
    } as unknown as PptxElementWithShapeStyle;
    // Both should produce same radius since min(w,h) = 50 in both cases
    expect(getRoundRectRadiusPx(narrow)).toBe(getRoundRectRadiusPx(wide));
    // At max adjustment: 50 * 0.5 * 1.0 = 25
    expect(getRoundRectRadiusPx(narrow)).toBe(25);
  });

  it("handles very small dimensions", () => {
    const element = {
      width: 0,
      height: 0,
      shapeAdjustments: { adj: 25000 },
    } as unknown as PptxElementWithShapeStyle;
    const radius = getRoundRectRadiusPx(element);
    // min(max(0,1), max(0,1)) * 0.5 * (25000/50000) = 0.25
    expect(radius).toBeCloseTo(0.25, 2);
  });

  it("uses default adjustment when none provided", () => {
    const element = {
      width: 100,
      height: 100,
    } as unknown as PptxElementWithShapeStyle;
    const radius = getRoundRectRadiusPx(element);
    const expected =
      100 * 0.5 * (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
    expect(radius).toBeCloseTo(expected, 1);
  });
});

function makeDragState(
  overrides: Partial<ShapeAdjustmentDragState> = {},
): ShapeAdjustmentDragState {
  return {
    elementId: "el-1",
    key: "adj",
    shapeType: "roundrect",
    startClientX: 0,
    startClientY: 0,
    startAdjustment: 25000,
    startWidth: 200,
    startHeight: 100,
    moved: false,
    ...overrides,
  };
}

describe("getDraggedShapeAdjustmentValue", () => {
  it("adjusts value based on positive deltaX", () => {
    const state = makeDragState();
    const result = getDraggedShapeAdjustmentValue(state, 10);
    expect(result).toBeGreaterThan(25000);
  });

  it("adjusts value based on negative deltaX", () => {
    const state = makeDragState();
    const result = getDraggedShapeAdjustmentValue(state, -10);
    expect(result).toBeLessThan(25000);
  });

  it("clamps result to valid range", () => {
    const state = makeDragState({ startAdjustment: 0 });
    const result = getDraggedShapeAdjustmentValue(state, -1000);
    expect(result).toBe(SHAPE_ADJUSTMENT_MIN);
  });

  it("returns startAdjustment for non-roundrect shapes", () => {
    const state = makeDragState({
      shapeType: "rect",
      startAdjustment: 12345,
    });
    expect(getDraggedShapeAdjustmentValue(state, 50)).toBe(12345);
  });

  it("returns startAdjustment when deltaX is 0", () => {
    const state = makeDragState({ startAdjustment: 15000 });
    expect(getDraggedShapeAdjustmentValue(state, 0)).toBe(15000);
  });

  it("handles very small element dimensions", () => {
    const state = makeDragState({ startWidth: 1, startHeight: 1 });
    // Should not crash or return NaN
    const result = getDraggedShapeAdjustmentValue(state, 5);
    expect(Number.isFinite(result)).toBe(true);
  });
});
