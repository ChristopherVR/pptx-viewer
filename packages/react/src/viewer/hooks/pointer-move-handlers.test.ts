import { describe, it, expect } from "vitest";
import {
  computeResizeGeometry,
  computeAdjustmentValue,
} from "./pointer-move-handlers";
import { MIN_ELEMENT_SIZE } from "../constants";

// ---------------------------------------------------------------------------
// computeResizeGeometry
// ---------------------------------------------------------------------------

describe("computeResizeGeometry", () => {
  const start = { x: 100, y: 100, width: 200, height: 150 };

  describe("handle: se (south-east)", () => {
    it("expands width and height with positive deltas", () => {
      const result = computeResizeGeometry(
        "se", start.x, start.y, start.width, start.height,
        50, 30, false, 8,
      );
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(250);
      expect(result.height).toBe(180);
    });

    it("shrinks width and height with negative deltas", () => {
      const result = computeResizeGeometry(
        "se", start.x, start.y, start.width, start.height,
        -50, -30, false, 8,
      );
      expect(result.width).toBe(150);
      expect(result.height).toBe(120);
    });

    it("clamps to MIN_ELEMENT_SIZE", () => {
      const result = computeResizeGeometry(
        "se", start.x, start.y, start.width, start.height,
        -500, -500, false, 8,
      );
      expect(result.width).toBe(MIN_ELEMENT_SIZE);
      expect(result.height).toBe(MIN_ELEMENT_SIZE);
    });
  });

  describe("handle: nw (north-west)", () => {
    it("moves origin and adjusts dimensions", () => {
      const result = computeResizeGeometry(
        "nw", start.x, start.y, start.width, start.height,
        -20, -30, false, 8,
      );
      expect(result.x).toBe(80);
      expect(result.y).toBe(70);
      expect(result.width).toBe(220);
      expect(result.height).toBe(180);
    });

    it("clamps dimensions to MIN_ELEMENT_SIZE when dragged past opposite corner", () => {
      const result = computeResizeGeometry(
        "nw", start.x, start.y, start.width, start.height,
        300, 300, false, 8,
      );
      expect(result.width).toBe(MIN_ELEMENT_SIZE);
      expect(result.height).toBe(MIN_ELEMENT_SIZE);
    });
  });

  describe("handle: ne (north-east)", () => {
    it("moves y origin and expands width", () => {
      const result = computeResizeGeometry(
        "ne", start.x, start.y, start.width, start.height,
        40, -20, false, 8,
      );
      expect(result.x).toBe(100);
      expect(result.y).toBe(80);
      expect(result.width).toBe(240);
      expect(result.height).toBe(170);
    });
  });

  describe("handle: sw (south-west)", () => {
    it("moves x origin and expands height", () => {
      const result = computeResizeGeometry(
        "sw", start.x, start.y, start.width, start.height,
        -30, 40, false, 8,
      );
      expect(result.x).toBe(70);
      expect(result.y).toBe(100);
      expect(result.width).toBe(230);
      expect(result.height).toBe(190);
    });
  });

  describe("snap to grid", () => {
    it("snaps se handle right edge to grid", () => {
      const gs = 10;
      const result = computeResizeGeometry(
        "se", 100, 100, 200, 150,
        53, 47, true, gs,
      );
      // Right edge: 100 + 253 = 353, snaps to 350; width = 350 - 100 = 250
      expect(result.width).toBe(Math.round(353 / gs) * gs - 100);
      // Bottom edge: 100 + 197 = 297, snaps to 300; height = 300 - 100 = 200
      expect(result.height).toBe(Math.round(297 / gs) * gs - 100);
    });

    it("snaps nw handle origin to grid", () => {
      const gs = 10;
      const result = computeResizeGeometry(
        "nw", 100, 100, 200, 150,
        -13, -17, true, gs,
      );
      // newX = 87, snaps to 90; newY = 83, snaps to 80
      expect(result.x).toBe(90);
      expect(result.y).toBe(80);
    });
  });

  it("preserves position when no delta", () => {
    const result = computeResizeGeometry(
      "se", start.x, start.y, start.width, start.height,
      0, 0, false, 8,
    );
    expect(result).toEqual({
      x: start.x,
      y: start.y,
      width: start.width,
      height: start.height,
    });
  });
});

// ---------------------------------------------------------------------------
// computeAdjustmentValue
// ---------------------------------------------------------------------------

describe("computeAdjustmentValue", () => {
  it("computes value from delta relative to width", () => {
    // dx = 100, width = 200, so delta = 0.5; start = 0 => result = 0.5
    const result = computeAdjustmentValue(0, 100, 200);
    expect(result).toBe(0.5);
  });

  it("clamps to minimum of 0", () => {
    const result = computeAdjustmentValue(0.1, -100, 200);
    expect(result).toBe(0);
  });

  it("clamps to maximum of 1", () => {
    const result = computeAdjustmentValue(0.9, 100, 200);
    expect(result).toBe(1);
  });

  it("uses fallback width of 200 when startWidth is 0", () => {
    const result = computeAdjustmentValue(0.5, 50, 0);
    // range = 200, delta = 50/200 = 0.25, result = 0.75
    expect(result).toBe(0.75);
  });

  it("returns start adjustment when dx is 0", () => {
    const result = computeAdjustmentValue(0.3, 0, 200);
    expect(result).toBe(0.3);
  });

  it("handles negative dx", () => {
    const result = computeAdjustmentValue(0.5, -50, 200);
    // delta = -50/200 = -0.25, result = 0.25
    expect(result).toBe(0.25);
  });
});
