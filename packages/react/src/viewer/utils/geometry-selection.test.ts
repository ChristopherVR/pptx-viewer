import { describe, it, expect } from "vitest";
import {
  clampPosition,
  clampSize,
  normalizeMarqueeRect,
  intersectsBounds,
  getSelectionBounds,
  computeSnapToShapeResult,
} from "./geometry-selection";
import type { PptxElement } from "pptx-viewer-core";
import { MIN_ELEMENT_SIZE } from "../constants";

describe("clampPosition", () => {
  it("clamps negative values to 0", () => {
    expect(clampPosition(-10, 100)).toBe(0);
  });

  it("clamps values above max to max", () => {
    expect(clampPosition(150, 100)).toBe(100);
  });

  it("passes through values within range", () => {
    expect(clampPosition(50, 100)).toBe(50);
  });

  it("returns 0 when max is 0", () => {
    expect(clampPosition(10, 0)).toBe(0);
  });

  it("returns 0 when max is negative", () => {
    expect(clampPosition(10, -5)).toBe(0);
  });

  it("returns 0 for exact 0 value", () => {
    expect(clampPosition(0, 100)).toBe(0);
  });
});

describe("clampSize", () => {
  it("returns MIN_ELEMENT_SIZE for values below minimum", () => {
    expect(clampSize(1)).toBe(MIN_ELEMENT_SIZE);
  });

  it("returns MIN_ELEMENT_SIZE for negative values", () => {
    expect(clampSize(-10)).toBe(MIN_ELEMENT_SIZE);
  });

  it("passes through values above minimum", () => {
    expect(clampSize(200)).toBe(200);
  });

  it("returns MIN_ELEMENT_SIZE for zero", () => {
    expect(clampSize(0)).toBe(MIN_ELEMENT_SIZE);
  });

  it("returns exact MIN_ELEMENT_SIZE when given the minimum", () => {
    expect(clampSize(MIN_ELEMENT_SIZE)).toBe(MIN_ELEMENT_SIZE);
  });

  it("preserves large values", () => {
    expect(clampSize(5000)).toBe(5000);
  });
});

describe("normalizeMarqueeRect", () => {
  it("normalizes when start is top-left", () => {
    const result = normalizeMarqueeRect({
      startX: 10,
      startY: 20,
      currentX: 100,
      currentY: 200,
    });
    expect(result).toEqual({ minX: 10, minY: 20, maxX: 100, maxY: 200 });
  });

  it("normalizes when start is bottom-right (dragged up-left)", () => {
    const result = normalizeMarqueeRect({
      startX: 100,
      startY: 200,
      currentX: 10,
      currentY: 20,
    });
    expect(result).toEqual({ minX: 10, minY: 20, maxX: 100, maxY: 200 });
  });

  it("handles zero-area selection (same start and current)", () => {
    const result = normalizeMarqueeRect({
      startX: 50,
      startY: 50,
      currentX: 50,
      currentY: 50,
    });
    expect(result).toEqual({ minX: 50, minY: 50, maxX: 50, maxY: 50 });
  });

  it("normalizes diagonal drag from bottom-left to top-right", () => {
    const result = normalizeMarqueeRect({
      startX: 10,
      startY: 200,
      currentX: 100,
      currentY: 20,
    });
    expect(result).toEqual({ minX: 10, minY: 20, maxX: 100, maxY: 200 });
  });

  it("normalizes drag from top-right to bottom-left", () => {
    const result = normalizeMarqueeRect({
      startX: 100,
      startY: 20,
      currentX: 10,
      currentY: 200,
    });
    expect(result).toEqual({ minX: 10, minY: 20, maxX: 100, maxY: 200 });
  });

  it("handles negative coordinates", () => {
    const result = normalizeMarqueeRect({
      startX: -20,
      startY: -30,
      currentX: 50,
      currentY: 60,
    });
    expect(result).toEqual({ minX: -20, minY: -30, maxX: 50, maxY: 60 });
  });
});

describe("intersectsBounds", () => {
  it("returns true for overlapping rectangles", () => {
    expect(
      intersectsBounds(
        { minX: 0, minY: 0, maxX: 50, maxY: 50 },
        { minX: 25, minY: 25, maxX: 75, maxY: 75 },
      ),
    ).toBe(true);
  });

  it("returns false for non-overlapping rectangles (left right)", () => {
    expect(
      intersectsBounds(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 20, minY: 0, maxX: 30, maxY: 10 },
      ),
    ).toBe(false);
  });

  it("returns false for non-overlapping rectangles (top bottom)", () => {
    expect(
      intersectsBounds(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 0, minY: 20, maxX: 10, maxY: 30 },
      ),
    ).toBe(false);
  });

  it("returns true for touching edges", () => {
    expect(
      intersectsBounds(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 10, minY: 0, maxX: 20, maxY: 10 },
      ),
    ).toBe(true);
  });

  it("returns true when one contains the other", () => {
    expect(
      intersectsBounds(
        { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        { minX: 25, minY: 25, maxX: 75, maxY: 75 },
      ),
    ).toBe(true);
  });

  it("returns true for identical bounds", () => {
    expect(
      intersectsBounds(
        { minX: 10, minY: 10, maxX: 50, maxY: 50 },
        { minX: 10, minY: 10, maxX: 50, maxY: 50 },
      ),
    ).toBe(true);
  });
});

describe("getSelectionBounds", () => {
  const makeElement = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): PptxElement =>
    ({
      id: `el-${x}-${y}`,
      type: "shape",
      x,
      y,
      width,
      height,
    }) as unknown as PptxElement;

  it("returns null for empty elements array", () => {
    expect(getSelectionBounds([])).toBeNull();
  });

  it("returns bounds of a single element", () => {
    const bounds = getSelectionBounds([makeElement(10, 20, 100, 50)]);
    expect(bounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    });
  });

  it("returns bounding box of multiple elements", () => {
    const bounds = getSelectionBounds([
      makeElement(10, 20, 100, 50),
      makeElement(50, 10, 200, 30),
    ]);
    expect(bounds).toEqual({
      minX: 10,
      minY: 10,
      maxX: 250,
      maxY: 70,
    });
  });

  it("clamps tiny elements to MIN_ELEMENT_SIZE", () => {
    const bounds = getSelectionBounds([makeElement(0, 0, 1, 1)]);
    expect(bounds!.maxX).toBe(MIN_ELEMENT_SIZE);
    expect(bounds!.maxY).toBe(MIN_ELEMENT_SIZE);
  });

  it("handles elements at origin", () => {
    const bounds = getSelectionBounds([makeElement(0, 0, 50, 50)]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
  });

  it("handles negative positions", () => {
    const bounds = getSelectionBounds([makeElement(-10, -20, 50, 50)]);
    expect(bounds).toEqual({ minX: -10, minY: -20, maxX: 40, maxY: 30 });
  });
});

describe("computeSnapToShapeResult", () => {
  it("returns original position when no siblings", () => {
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      [],
      new Set(),
      [],
    );
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.lines).toEqual([]);
  });

  it("snaps to sibling left edge when within threshold", () => {
    const siblings = [
      { x: 103, y: 200, width: 50, height: 50, id: "sib-1" },
    ];
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      siblings,
      new Set(),
      [],
    );
    // dragX=100 should snap to sib.x=103 (within SNAP_THRESHOLD=6)
    expect(result.x).toBe(103);
  });

  it("does not snap to elements that are being dragged", () => {
    const siblings = [
      { x: 103, y: 200, width: 50, height: 50, id: "sib-1" },
    ];
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      siblings,
      new Set(["sib-1"]),
      [],
    );
    expect(result.x).toBe(100);
  });

  it("snaps to vertical guide", () => {
    const guides = [{ axis: "v" as const, position: 102 }];
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      [],
      new Set(),
      guides,
    );
    expect(result.x).toBe(102);
  });

  it("snaps to horizontal guide", () => {
    const guides = [{ axis: "h" as const, position: 103 }];
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      [],
      new Set(),
      guides,
    );
    expect(result.y).toBe(103);
  });

  it("produces snap lines when snapping occurs", () => {
    const siblings = [
      { x: 100, y: 200, width: 50, height: 50, id: "sib-1" },
    ];
    const result = computeSnapToShapeResult(
      100,
      100,
      50,
      50,
      siblings,
      new Set(),
      [],
    );
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.some((l) => l.axis === "v")).toBe(true);
  });
});
