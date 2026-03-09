import { describe, it, expect } from "vitest";
import {
  readRectFromView,
  readPointFromView,
} from "./emf-plus-read-helpers";
import type { RectCoords, PointCoords } from "./emf-plus-read-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuffer(
  size: number,
  writer: (view: DataView) => void,
): DataView {
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  writer(view);
  return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-plus-read-helpers", () => {
  // -----------------------------------------------------------------------
  // readRectFromView — compressed (Int16)
  // -----------------------------------------------------------------------
  describe("readRectFromView() compressed (Int16)", () => {
    it("reads positive values", () => {
      const view = buildBuffer(8, (v) => {
        v.setInt16(0, 10, true);  // x
        v.setInt16(2, 20, true);  // y
        v.setInt16(4, 100, true); // w
        v.setInt16(6, 200, true); // h
      });
      const rect = readRectFromView(view, 0, true);
      expect(rect).toEqual({ x: 10, y: 20, w: 100, h: 200 });
    });

    it("reads negative values", () => {
      const view = buildBuffer(8, (v) => {
        v.setInt16(0, -50, true);
        v.setInt16(2, -100, true);
        v.setInt16(4, 300, true);
        v.setInt16(6, 400, true);
      });
      const rect = readRectFromView(view, 0, true);
      expect(rect.x).toBe(-50);
      expect(rect.y).toBe(-100);
    });

    it("reads at a non-zero offset", () => {
      const view = buildBuffer(16, (v) => {
        v.setInt16(8, 5, true);
        v.setInt16(10, 15, true);
        v.setInt16(12, 50, true);
        v.setInt16(14, 75, true);
      });
      const rect = readRectFromView(view, 8, true);
      expect(rect).toEqual({ x: 5, y: 15, w: 50, h: 75 });
    });

    it("reads zero rect", () => {
      const view = buildBuffer(8, () => {});
      const rect = readRectFromView(view, 0, true);
      expect(rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });
  });

  // -----------------------------------------------------------------------
  // readRectFromView — uncompressed (Float32)
  // -----------------------------------------------------------------------
  describe("readRectFromView() uncompressed (Float32)", () => {
    it("reads positive float values", () => {
      const view = buildBuffer(16, (v) => {
        v.setFloat32(0, 1.5, true);
        v.setFloat32(4, 2.5, true);
        v.setFloat32(8, 100.25, true);
        v.setFloat32(12, 200.75, true);
      });
      const rect = readRectFromView(view, 0, false);
      expect(rect.x).toBeCloseTo(1.5);
      expect(rect.y).toBeCloseTo(2.5);
      expect(rect.w).toBeCloseTo(100.25);
      expect(rect.h).toBeCloseTo(200.75);
    });

    it("reads negative float values", () => {
      const view = buildBuffer(16, (v) => {
        v.setFloat32(0, -10.5, true);
        v.setFloat32(4, -20.5, true);
        v.setFloat32(8, 50.0, true);
        v.setFloat32(12, 60.0, true);
      });
      const rect = readRectFromView(view, 0, false);
      expect(rect.x).toBeCloseTo(-10.5);
      expect(rect.y).toBeCloseTo(-20.5);
    });

    it("reads at a non-zero offset", () => {
      const view = buildBuffer(32, (v) => {
        v.setFloat32(16, 3.14, true);
        v.setFloat32(20, 2.71, true);
        v.setFloat32(24, 42.0, true);
        v.setFloat32(28, 99.9, true);
      });
      const rect = readRectFromView(view, 16, false);
      expect(rect.x).toBeCloseTo(3.14);
      expect(rect.y).toBeCloseTo(2.71);
      expect(rect.w).toBeCloseTo(42.0);
      expect(rect.h).toBeCloseTo(99.9);
    });
  });

  // -----------------------------------------------------------------------
  // readPointFromView — compressed (Int16)
  // -----------------------------------------------------------------------
  describe("readPointFromView() compressed (Int16)", () => {
    it("reads a positive point", () => {
      const view = buildBuffer(4, (v) => {
        v.setInt16(0, 42, true);
        v.setInt16(2, 84, true);
      });
      const pt = readPointFromView(view, 0, true);
      expect(pt).toEqual({ x: 42, y: 84 });
    });

    it("reads a negative point", () => {
      const view = buildBuffer(4, (v) => {
        v.setInt16(0, -100, true);
        v.setInt16(2, -200, true);
      });
      const pt = readPointFromView(view, 0, true);
      expect(pt).toEqual({ x: -100, y: -200 });
    });

    it("reads at a non-zero offset", () => {
      const view = buildBuffer(8, (v) => {
        v.setInt16(4, 7, true);
        v.setInt16(6, 13, true);
      });
      const pt = readPointFromView(view, 4, true);
      expect(pt).toEqual({ x: 7, y: 13 });
    });
  });

  // -----------------------------------------------------------------------
  // readPointFromView — uncompressed (Float32)
  // -----------------------------------------------------------------------
  describe("readPointFromView() uncompressed (Float32)", () => {
    it("reads a float point", () => {
      const view = buildBuffer(8, (v) => {
        v.setFloat32(0, 3.14, true);
        v.setFloat32(4, 2.71, true);
      });
      const pt = readPointFromView(view, 0, false);
      expect(pt.x).toBeCloseTo(3.14);
      expect(pt.y).toBeCloseTo(2.71);
    });

    it("reads at a non-zero offset", () => {
      const view = buildBuffer(16, (v) => {
        v.setFloat32(8, -99.5, true);
        v.setFloat32(12, 0.001, true);
      });
      const pt = readPointFromView(view, 8, false);
      expect(pt.x).toBeCloseTo(-99.5);
      expect(pt.y).toBeCloseTo(0.001);
    });

    it("handles zero values", () => {
      const view = buildBuffer(8, () => {});
      const pt = readPointFromView(view, 0, false);
      expect(pt.x).toBe(0);
      expect(pt.y).toBe(0);
    });
  });
});
