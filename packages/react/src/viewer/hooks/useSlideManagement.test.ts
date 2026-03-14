import { describe, it, expect, vi } from "vitest";
import type { PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Pure logic extracted from useSlideManagement for testing.
// These mirror the updater functions passed to ops.updateSlides().
// ---------------------------------------------------------------------------

function makeSlide(overrides: Partial<PptxSlide> & { id: string }): PptxSlide {
  return {
    rId: "",
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

/**
 * Move slide updater: remove from `fromIndex` and insert at `toIndex`.
 */
function moveSlideUpdater(
  slides: PptxSlide[],
  fromIndex: number,
  toIndex: number,
): PptxSlide[] {
  if (fromIndex === toIndex) return slides;
  const next = [...slides];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Delete slides updater: remove slides at given indexes (in reverse order).
 * Never reduces below 1 slide.
 */
function deleteSlidesUpdater(
  slides: PptxSlide[],
  indexes: number[],
): PptxSlide[] {
  if (indexes.length === 0 || slides.length <= 1) return slides;
  const sorted = [...indexes].sort((a, b) => b - a);
  const next = [...slides];
  for (const i of sorted) {
    if (next.length > 1) next.splice(i, 1);
  }
  return next;
}

/**
 * Compute the active slide index after deletion.
 */
function computeActiveIndexAfterDelete(
  slidesLength: number,
  deletedIndexes: number[],
): number {
  const minIdx = Math.min(...deletedIndexes);
  return Math.min(
    minIdx,
    slidesLength - deletedIndexes.length - 1,
    Math.max(slidesLength - deletedIndexes.length - 1, 0),
  );
}

/**
 * Duplicate slides updater: insert clones after each source index.
 */
function duplicateSlidesUpdater(
  slides: PptxSlide[],
  indexes: number[],
): PptxSlide[] {
  if (indexes.length === 0) return slides;
  const sorted = [...indexes].sort((a, b) => a - b);
  const next = [...slides];
  let offset = 0;
  for (const i of sorted) {
    const src = next[i + offset];
    if (!src) continue;
    const clone: PptxSlide = {
      ...src,
      id: `slide-dup-${i}`,
      elements: src.elements.map((el) => ({
        ...el,
        id: `${el.id}-dup`,
      })),
    };
    next.splice(i + offset + 1, 0, clone);
    offset++;
  }
  return next;
}

/**
 * Toggle hide slides updater.
 */
function toggleHideSlidesUpdater(
  slides: PptxSlide[],
  indexes: number[],
): PptxSlide[] {
  if (indexes.length === 0) return slides;
  const next = [...slides];
  for (const i of indexes) {
    const slide = next[i];
    if (slide) next[i] = { ...slide, hidden: !slide.hidden };
  }
  return next;
}

// ---------------------------------------------------------------------------
// Tests: moveSlideUpdater
// ---------------------------------------------------------------------------

describe("moveSlideUpdater", () => {
  const slides = [
    makeSlide({ id: "s1" }),
    makeSlide({ id: "s2" }),
    makeSlide({ id: "s3" }),
    makeSlide({ id: "s4" }),
  ];

  it("should move slide from index 0 to index 2", () => {
    const result = moveSlideUpdater(slides, 0, 2);
    expect(result.map((s) => s.id)).toEqual(["s2", "s3", "s1", "s4"]);
  });

  it("should move slide from index 3 to index 0", () => {
    const result = moveSlideUpdater(slides, 3, 0);
    expect(result.map((s) => s.id)).toEqual(["s4", "s1", "s2", "s3"]);
  });

  it("should return same order when from equals to", () => {
    const result = moveSlideUpdater(slides, 1, 1);
    expect(result).toBe(slides); // exact same reference
  });

  it("should handle moving last to second-to-last", () => {
    const result = moveSlideUpdater(slides, 3, 2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s2", "s4", "s3"]);
  });

  it("should handle adjacent swap forward", () => {
    const result = moveSlideUpdater(slides, 1, 2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s3", "s2", "s4"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteSlidesUpdater
// ---------------------------------------------------------------------------

describe("deleteSlidesUpdater", () => {
  const slides = [
    makeSlide({ id: "s1" }),
    makeSlide({ id: "s2" }),
    makeSlide({ id: "s3" }),
    makeSlide({ id: "s4" }),
  ];

  it("should delete a single slide", () => {
    const result = deleteSlidesUpdater(slides, [1]);
    expect(result.map((s) => s.id)).toEqual(["s1", "s3", "s4"]);
  });

  it("should delete multiple slides", () => {
    const result = deleteSlidesUpdater(slides, [0, 2]);
    expect(result.map((s) => s.id)).toEqual(["s2", "s4"]);
  });

  it("should not reduce below 1 slide", () => {
    const result = deleteSlidesUpdater(slides, [0, 1, 2, 3]);
    expect(result).toHaveLength(1);
  });

  it("should return same slides when indexes is empty", () => {
    const result = deleteSlidesUpdater(slides, []);
    expect(result).toBe(slides);
  });

  it("should return same slides when only 1 slide exists", () => {
    const single = [makeSlide({ id: "s1" })];
    const result = deleteSlidesUpdater(single, [0]);
    expect(result).toBe(single);
  });

  it("should handle non-sequential deletion indexes", () => {
    const result = deleteSlidesUpdater(slides, [3, 0]);
    expect(result.map((s) => s.id)).toEqual(["s2", "s3"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeActiveIndexAfterDelete
// ---------------------------------------------------------------------------

describe("computeActiveIndexAfterDelete", () => {
  it("should return 0 when deleting the first slide", () => {
    const result = computeActiveIndexAfterDelete(4, [0]);
    expect(result).toBe(0);
  });

  it("should clamp to remaining last index when deleting middle slide", () => {
    const result = computeActiveIndexAfterDelete(4, [2]);
    // slidesLength=4, deletedIndexes=[2], minIdx=2
    // remaining = 4 - 1 - 1 = 2, max(2,0) = 2
    // Math.min(2, 2, 2) = 2
    expect(result).toBe(2);
  });

  it("should return 0 when deleting all but one", () => {
    const result = computeActiveIndexAfterDelete(4, [0, 1, 2]);
    expect(result).toBe(0);
  });

  it("should return last valid index when deleting last slide", () => {
    const result = computeActiveIndexAfterDelete(4, [3]);
    // minIdx=3, 4-1-1=2, max(2,0)=2 => min(3,2,2) = 2
    expect(result).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: duplicateSlidesUpdater
// ---------------------------------------------------------------------------

describe("duplicateSlidesUpdater", () => {
  const slides = [
    makeSlide({ id: "s1" }),
    makeSlide({ id: "s2" }),
    makeSlide({ id: "s3" }),
  ];

  it("should duplicate a single slide", () => {
    const result = duplicateSlidesUpdater(slides, [1]);
    expect(result).toHaveLength(4);
    expect(result[1].id).toBe("s2");
    expect(result[2].id).toBe("slide-dup-1");
  });

  it("should duplicate multiple slides in order", () => {
    const result = duplicateSlidesUpdater(slides, [0, 2]);
    expect(result).toHaveLength(5);
    // After dup of idx 0: [s1, dup0, s2, s3]
    // After dup of idx 2 (+1 offset): [s1, dup0, s2, s3, dup2]
    // Actually idx 2 with offset 1 = idx 3 which is s3
    expect(result[0].id).toBe("s1");
    expect(result[1].id).toBe("slide-dup-0");
    expect(result[2].id).toBe("s2");
    expect(result[3].id).toBe("s3");
    expect(result[4].id).toBe("slide-dup-2");
  });

  it("should return same slides when indexes is empty", () => {
    const result = duplicateSlidesUpdater(slides, []);
    expect(result).toBe(slides);
  });

  it("should place duplicate right after the source slide", () => {
    const result = duplicateSlidesUpdater(slides, [0]);
    expect(result.map((s) => s.id)).toEqual(["s1", "slide-dup-0", "s2", "s3"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: toggleHideSlidesUpdater
// ---------------------------------------------------------------------------

describe("toggleHideSlidesUpdater", () => {
  it("should toggle hidden from undefined to true", () => {
    const slides = [makeSlide({ id: "s1" }), makeSlide({ id: "s2" })];
    const result = toggleHideSlidesUpdater(slides, [0]);
    expect(result[0].hidden).toBe(true);
    expect(result[1].hidden).toBeUndefined();
  });

  it("should toggle hidden from true to false", () => {
    const slides = [
      makeSlide({ id: "s1", hidden: true }),
      makeSlide({ id: "s2" }),
    ];
    const result = toggleHideSlidesUpdater(slides, [0]);
    expect(result[0].hidden).toBe(false);
  });

  it("should toggle multiple slides", () => {
    const slides = [
      makeSlide({ id: "s1" }),
      makeSlide({ id: "s2", hidden: true }),
      makeSlide({ id: "s3" }),
    ];
    const result = toggleHideSlidesUpdater(slides, [0, 1, 2]);
    expect(result[0].hidden).toBe(true);
    expect(result[1].hidden).toBe(false);
    expect(result[2].hidden).toBe(true);
  });

  it("should return same slides when indexes is empty", () => {
    const slides = [makeSlide({ id: "s1" })];
    const result = toggleHideSlidesUpdater(slides, []);
    expect(result).toBe(slides);
  });
});
