import { describe, it, expect } from "vitest";
import { getRoundRectRadiusPx } from "./shape-round-rect";
import {
  SHAPE_ADJUSTMENT_MAX,
  SHAPE_ADJUSTMENT_MIN,
  DEFAULT_ROUND_RECT_ADJUSTMENT,
} from "../constants";
import type { PptxElementWithShapeStyle } from "pptx-viewer-core";

/**
 * Helper to build a minimal PptxElementWithShapeStyle stub for testing
 * getRoundRectRadiusPx.  Only `width`, `height`, and optionally
 * `shapeAdjustments.adj` are relevant.
 */
function makeElement(
  width: number,
  height: number,
  adj?: number,
): PptxElementWithShapeStyle {
  return {
    width,
    height,
    ...(adj !== undefined ? { shapeAdjustments: { adj } } : {}),
  } as unknown as PptxElementWithShapeStyle;
}

describe("getRoundRectRadiusPx", () => {
  // -------------------------------------------------------------------
  // Default adjustment when no shapeAdjustments provided
  // -------------------------------------------------------------------
  describe("default adjustment (no shapeAdjustments)", () => {
    it("uses DEFAULT_ROUND_RECT_ADJUSTMENT when shapeAdjustments is absent", () => {
      const el = makeElement(200, 100);
      const expected =
        Math.min(Math.max(200, 1), Math.max(100, 1)) *
        0.5 *
        (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("uses DEFAULT_ROUND_RECT_ADJUSTMENT when shapeAdjustments exists but adj is undefined", () => {
      const el = {
        width: 200,
        height: 100,
        shapeAdjustments: {},
      } as unknown as PptxElementWithShapeStyle;
      const expected =
        Math.min(200, 100) *
        0.5 *
        (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Custom adjustment value
  // -------------------------------------------------------------------
  describe("custom adjustment value", () => {
    it("applies a custom adj value within valid range", () => {
      const adj = 25000;
      const el = makeElement(200, 100, adj);
      const expected =
        Math.min(200, 100) * 0.5 * (adj / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("applies adj = 0 (minimum)", () => {
      const el = makeElement(200, 100, 0);
      expect(getRoundRectRadiusPx(el)).toBe(0);
    });

    it("applies adj = SHAPE_ADJUSTMENT_MAX (maximum)", () => {
      const el = makeElement(200, 100, SHAPE_ADJUSTMENT_MAX);
      const expected = Math.min(200, 100) * 0.5 * 1;
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("applies a small adj value", () => {
      const adj = 1000;
      const el = makeElement(300, 300, adj);
      const expected =
        Math.min(300, 300) * 0.5 * (adj / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // NaN / non-finite adjustment falls back to default
  // -------------------------------------------------------------------
  describe("NaN / non-finite adjustment falls back to default", () => {
    it("falls back to default for NaN adj", () => {
      const el = makeElement(200, 100, NaN);
      const expected =
        Math.min(200, 100) *
        0.5 *
        (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("falls back to default for Infinity adj", () => {
      const el = makeElement(200, 100, Infinity);
      const expected =
        Math.min(200, 100) *
        0.5 *
        (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("falls back to default for -Infinity adj", () => {
      const el = makeElement(200, 100, -Infinity);
      const expected =
        Math.min(200, 100) *
        0.5 *
        (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Width < height: radius based on width
  // -------------------------------------------------------------------
  describe("width < height: radius based on width", () => {
    it("uses width when width < height", () => {
      const el = makeElement(80, 200);
      const expected =
        80 * 0.5 * (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("uses width when width is much smaller than height", () => {
      const el = makeElement(10, 1000, 25000);
      const expected = 10 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Height < width: radius based on height
  // -------------------------------------------------------------------
  describe("height < width: radius based on height", () => {
    it("uses height when height < width", () => {
      const el = makeElement(300, 50);
      const expected =
        50 * 0.5 * (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("uses height when height is much smaller than width", () => {
      const el = makeElement(1000, 5, 30000);
      const expected = 5 * 0.5 * (30000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Square elements (equal dimensions)
  // -------------------------------------------------------------------
  describe("square elements (width === height)", () => {
    it("uses the shared dimension for a square", () => {
      const el = makeElement(100, 100, 25000);
      const expected = 100 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Zero / negative width or height → clamped to 1
  // -------------------------------------------------------------------
  describe("zero / negative width or height clamped to 1", () => {
    it("clamps zero width to 1", () => {
      const el = makeElement(0, 100, 25000);
      // Math.min(Math.max(0,1), Math.max(100,1)) = Math.min(1, 100) = 1
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("clamps zero height to 1", () => {
      const el = makeElement(100, 0, 25000);
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("clamps negative width to 1", () => {
      const el = makeElement(-50, 100, 25000);
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("clamps negative height to 1", () => {
      const el = makeElement(100, -50, 25000);
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("clamps both zero width and height to 1", () => {
      const el = makeElement(0, 0, 25000);
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("clamps both negative width and height to 1", () => {
      const el = makeElement(-10, -20, 25000);
      const expected = 1 * 0.5 * (25000 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });

  // -------------------------------------------------------------------
  // Adjustment clamping to SHAPE_ADJUSTMENT_MIN/MAX
  // -------------------------------------------------------------------
  describe("adjustment clamping to SHAPE_ADJUSTMENT_MIN / MAX", () => {
    it("clamps adj below SHAPE_ADJUSTMENT_MIN to MIN", () => {
      const el = makeElement(200, 100, -5000);
      // localClampAdjustment(-5000) → Math.max(0, Math.min(50000, Math.round(-5000))) = 0
      expect(getRoundRectRadiusPx(el)).toBe(0);
    });

    it("clamps adj above SHAPE_ADJUSTMENT_MAX to MAX", () => {
      const el = makeElement(200, 100, 100000);
      // localClampAdjustment(100000) → Math.max(0, Math.min(50000, 100000)) = 50000
      const expected =
        Math.min(200, 100) *
        0.5 *
        (SHAPE_ADJUSTMENT_MAX / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("rounds adj to nearest integer before clamping", () => {
      const el = makeElement(200, 100, 25000.7);
      // localClampAdjustment(25000.7) → Math.round(25000.7) = 25001
      const expected =
        Math.min(200, 100) * 0.5 * (25001 / SHAPE_ADJUSTMENT_MAX);
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });

    it("adj at exact MIN boundary yields 0 radius", () => {
      const el = makeElement(200, 100, SHAPE_ADJUSTMENT_MIN);
      expect(getRoundRectRadiusPx(el)).toBe(0);
    });

    it("adj at exact MAX boundary yields max radius", () => {
      const el = makeElement(200, 100, SHAPE_ADJUSTMENT_MAX);
      const expected = Math.min(200, 100) * 0.5;
      expect(getRoundRectRadiusPx(el)).toBeCloseTo(expected, 5);
    });
  });
});
