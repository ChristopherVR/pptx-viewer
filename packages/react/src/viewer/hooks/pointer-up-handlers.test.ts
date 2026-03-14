import { describe, it, expect } from "vitest";
import {
  computeMarqueeHitIds,
  mergeAdditiveSelection,
} from "./pointer-up-handlers";
import type { MarqueeRect, ElementRect } from "./pointer-up-handlers";
import { MIN_ELEMENT_SIZE } from "../constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ElementRect {
  return { id, x, y, width, height };
}

// ---------------------------------------------------------------------------
// computeMarqueeHitIds
// ---------------------------------------------------------------------------

describe("computeMarqueeHitIds", () => {
  const elements: ElementRect[] = [
    makeRect("a", 10, 10, 50, 50),
    makeRect("b", 100, 100, 50, 50),
    makeRect("c", 200, 200, 50, 50),
  ];

  it("returns empty array for tiny marquee (both dimensions <= 3)", () => {
    const marquee: MarqueeRect = {
      startX: 10,
      startY: 10,
      currentX: 12,
      currentY: 12,
    };
    expect(computeMarqueeHitIds(marquee, elements)).toEqual([]);
  });

  it("selects elements inside the marquee rectangle", () => {
    const marquee: MarqueeRect = {
      startX: 0,
      startY: 0,
      currentX: 70,
      currentY: 70,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual(["a"]);
  });

  it("selects multiple elements when marquee covers them", () => {
    const marquee: MarqueeRect = {
      startX: 0,
      startY: 0,
      currentX: 260,
      currentY: 260,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("selects elements that partially overlap the marquee", () => {
    const marquee: MarqueeRect = {
      startX: 30,
      startY: 30,
      currentX: 120,
      currentY: 120,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual(["a", "b"]);
  });

  it("handles reversed marquee coordinates (start > current)", () => {
    const marquee: MarqueeRect = {
      startX: 70,
      startY: 70,
      currentX: 0,
      currentY: 0,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual(["a"]);
  });

  it("returns empty array when no elements intersect", () => {
    const marquee: MarqueeRect = {
      startX: 300,
      startY: 300,
      currentX: 400,
      currentY: 400,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual([]);
  });

  it("returns empty for empty elements array", () => {
    const marquee: MarqueeRect = {
      startX: 0,
      startY: 0,
      currentX: 500,
      currentY: 500,
    };
    expect(computeMarqueeHitIds(marquee, [])).toEqual([]);
  });

  it("uses MIN_ELEMENT_SIZE for elements with small dimensions", () => {
    const tinyElement: ElementRect = makeRect("tiny", 50, 50, 2, 2);
    const marquee: MarqueeRect = {
      startX: 45,
      startY: 45,
      currentX: 50 + MIN_ELEMENT_SIZE + 1,
      currentY: 50 + MIN_ELEMENT_SIZE + 1,
    };
    const result = computeMarqueeHitIds(marquee, [tinyElement]);
    expect(result).toEqual(["tiny"]);
  });

  it("detects width-only overlap (tall marquee touches wide element)", () => {
    const marquee: MarqueeRect = {
      startX: 0,
      startY: 0,
      currentX: 15,
      currentY: 500,
    };
    const result = computeMarqueeHitIds(marquee, elements);
    expect(result).toEqual(["a"]);
  });
});

// ---------------------------------------------------------------------------
// mergeAdditiveSelection
// ---------------------------------------------------------------------------

describe("mergeAdditiveSelection", () => {
  it("merges base selection with new hit IDs", () => {
    const result = mergeAdditiveSelection(["a", "b"], ["c", "d"]);
    expect(result).toEqual(["a", "b", "c", "d"]);
  });

  it("deduplicates when IDs overlap", () => {
    const result = mergeAdditiveSelection(["a", "b"], ["b", "c"]);
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(["a", "b", "c"]));
  });

  it("handles undefined baseSelectionIds", () => {
    const result = mergeAdditiveSelection(undefined, ["a", "b"]);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns base selection when hitIds is empty", () => {
    const result = mergeAdditiveSelection(["a", "b"], []);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns empty array when both are empty", () => {
    const result = mergeAdditiveSelection([], []);
    expect(result).toEqual([]);
  });

  it("returns empty array when base is undefined and hitIds is empty", () => {
    const result = mergeAdditiveSelection(undefined, []);
    expect(result).toEqual([]);
  });
});
