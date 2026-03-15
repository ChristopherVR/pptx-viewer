import { describe, it, expect, vi } from "vitest";
import type {
  ZoomPptxElement,
  PptxSlide,
  PptxElement,
} from "pptx-viewer-core";
import {
  isSummaryZoomSlide,
  getZoomElements,
  getZoomTargetSlideIndexes,
  shouldReturnToZoomSlide,
  getSectionSlideRange,
  isZoomElement,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeZoomElement(
  overrides: Partial<ZoomPptxElement> = {},
): ZoomPptxElement {
  return {
    id: "zm_1",
    type: "zoom",
    x: 100,
    y: 100,
    width: 200,
    height: 120,
    zoomType: "slide",
    targetSlideIndex: 0,
    ...overrides,
  } as ZoomPptxElement;
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
  return {
    id: "slide1",
    rId: "rId1",
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

function makeSummaryZoomSlide(): PptxSlide {
  return makeSlide({
    id: "summary",
    elements: [
      makeZoomElement({ id: "zm_1", targetSlideIndex: 2 }),
      makeZoomElement({ id: "zm_2", targetSlideIndex: 5 }),
      makeZoomElement({ id: "zm_3", targetSlideIndex: 8 }),
    ],
  });
}

// ---------------------------------------------------------------------------
// isZoomElement (type guard)
// ---------------------------------------------------------------------------

describe("isZoomElement", () => {
  it("returns true for zoom elements", () => {
    const el = makeZoomElement();
    expect(isZoomElement(el)).toBe(true);
  });

  it("returns false for non-zoom elements", () => {
    const el = {
      id: "shp_1",
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;
    expect(isZoomElement(el)).toBe(false);
  });

  it("returns false for image elements", () => {
    const el = {
      id: "img_1",
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;
    expect(isZoomElement(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getZoomElements
// ---------------------------------------------------------------------------

describe("getZoomElements", () => {
  it("returns empty array when no zoom elements exist", () => {
    const slide = makeSlide({
      elements: [
        { id: "txt_1", type: "text", x: 0, y: 0, width: 100, height: 50 } as PptxElement,
      ],
    });
    expect(getZoomElements(slide)).toEqual([]);
  });

  it("returns only zoom elements from a mixed slide", () => {
    const zoom1 = makeZoomElement({ id: "zm_1", targetSlideIndex: 2 });
    const zoom2 = makeZoomElement({ id: "zm_2", targetSlideIndex: 4 });
    const slide = makeSlide({
      elements: [
        { id: "txt_1", type: "text", x: 0, y: 0, width: 100, height: 50 } as PptxElement,
        zoom1,
        { id: "shp_1", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement,
        zoom2,
      ],
    });
    const result = getZoomElements(slide);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("zm_1");
    expect(result[1].id).toBe("zm_2");
  });

  it("returns all zoom elements when every element is a zoom", () => {
    const slide = makeSummaryZoomSlide();
    expect(getZoomElements(slide)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// isSummaryZoomSlide
// ---------------------------------------------------------------------------

describe("isSummaryZoomSlide", () => {
  it("returns false for a slide with no zoom elements", () => {
    const slide = makeSlide({
      elements: [
        { id: "txt_1", type: "text", x: 0, y: 0, width: 100, height: 50 } as PptxElement,
      ],
    });
    expect(isSummaryZoomSlide(slide)).toBe(false);
  });

  it("returns false for a slide with only one zoom element", () => {
    const slide = makeSlide({
      elements: [makeZoomElement({ targetSlideIndex: 3 })],
    });
    expect(isSummaryZoomSlide(slide)).toBe(false);
  });

  it("returns false when multiple zoom elements target the same slide", () => {
    const slide = makeSlide({
      elements: [
        makeZoomElement({ id: "zm_1", targetSlideIndex: 3 }),
        makeZoomElement({ id: "zm_2", targetSlideIndex: 3 }),
      ],
    });
    expect(isSummaryZoomSlide(slide)).toBe(false);
  });

  it("returns true for a slide with multiple zoom elements targeting distinct slides", () => {
    const slide = makeSummaryZoomSlide();
    expect(isSummaryZoomSlide(slide)).toBe(true);
  });

  it("returns true for exactly two zoom elements targeting different slides", () => {
    const slide = makeSlide({
      elements: [
        makeZoomElement({ id: "zm_1", targetSlideIndex: 1 }),
        makeZoomElement({ id: "zm_2", targetSlideIndex: 4 }),
      ],
    });
    expect(isSummaryZoomSlide(slide)).toBe(true);
  });

  it("returns false for an empty slide", () => {
    const slide = makeSlide({ elements: [] });
    expect(isSummaryZoomSlide(slide)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getZoomTargetSlideIndexes
// ---------------------------------------------------------------------------

describe("getZoomTargetSlideIndexes", () => {
  it("returns empty array for slide with no zooms", () => {
    const slide = makeSlide({ elements: [] });
    expect(getZoomTargetSlideIndexes(slide)).toEqual([]);
  });

  it("returns distinct target indexes in order", () => {
    const slide = makeSlide({
      elements: [
        makeZoomElement({ id: "zm_1", targetSlideIndex: 5 }),
        makeZoomElement({ id: "zm_2", targetSlideIndex: 2 }),
        makeZoomElement({ id: "zm_3", targetSlideIndex: 8 }),
      ],
    });
    expect(getZoomTargetSlideIndexes(slide)).toEqual([5, 2, 8]);
  });

  it("deduplicates targets", () => {
    const slide = makeSlide({
      elements: [
        makeZoomElement({ id: "zm_1", targetSlideIndex: 3 }),
        makeZoomElement({ id: "zm_2", targetSlideIndex: 3 }),
        makeZoomElement({ id: "zm_3", targetSlideIndex: 7 }),
      ],
    });
    expect(getZoomTargetSlideIndexes(slide)).toEqual([3, 7]);
  });
});

// ---------------------------------------------------------------------------
// shouldReturnToZoomSlide
// ---------------------------------------------------------------------------

describe("shouldReturnToZoomSlide", () => {
  it("returns true for section zoom on a summary slide", () => {
    const summarySlide = makeSummaryZoomSlide();
    const sectionZoom = makeZoomElement({
      zoomType: "section",
      targetSlideIndex: 2,
      targetSectionId: "sec_1",
    });
    expect(shouldReturnToZoomSlide(sectionZoom, summarySlide)).toBe(true);
  });

  it("returns true for slide zoom on a summary slide", () => {
    const summarySlide = makeSummaryZoomSlide();
    const slideZoom = makeZoomElement({
      zoomType: "slide",
      targetSlideIndex: 5,
    });
    expect(shouldReturnToZoomSlide(slideZoom, summarySlide)).toBe(true);
  });

  it("returns false for zoom on a non-summary slide", () => {
    const normalSlide = makeSlide({
      elements: [makeZoomElement({ targetSlideIndex: 3 })],
    });
    const zoom = makeZoomElement({ targetSlideIndex: 3 });
    expect(shouldReturnToZoomSlide(zoom, normalSlide)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSectionSlideRange
// ---------------------------------------------------------------------------

describe("getSectionSlideRange", () => {
  const slides: PptxSlide[] = [
    makeSlide({ id: "s0", slideNumber: 1, sectionId: "sec_intro" }),
    makeSlide({ id: "s1", slideNumber: 2, sectionId: "sec_intro" }),
    makeSlide({ id: "s2", slideNumber: 3, sectionId: "sec_main" }),
    makeSlide({ id: "s3", slideNumber: 4, sectionId: "sec_main" }),
    makeSlide({ id: "s4", slideNumber: 5, sectionId: "sec_main" }),
    makeSlide({ id: "s5", slideNumber: 6, sectionId: "sec_conclusion" }),
  ];

  it("returns slide indices for the matching section", () => {
    const zoom = makeZoomElement({
      zoomType: "section",
      targetSlideIndex: 2,
      targetSectionId: "sec_main",
    });
    expect(getSectionSlideRange(zoom, slides)).toEqual([2, 3, 4]);
  });

  it("returns single slide for intro section", () => {
    const zoom = makeZoomElement({
      zoomType: "section",
      targetSlideIndex: 0,
      targetSectionId: "sec_intro",
    });
    expect(getSectionSlideRange(zoom, slides)).toEqual([0, 1]);
  });

  it("falls back to target slide when section has no matching slides", () => {
    const zoom = makeZoomElement({
      zoomType: "section",
      targetSlideIndex: 3,
      targetSectionId: "sec_nonexistent",
    });
    expect(getSectionSlideRange(zoom, slides)).toEqual([3]);
  });

  it("falls back to target slide for non-section zoom type", () => {
    const zoom = makeZoomElement({
      zoomType: "slide",
      targetSlideIndex: 3,
    });
    expect(getSectionSlideRange(zoom, slides)).toEqual([3]);
  });

  it("falls back to target slide when targetSectionId is undefined", () => {
    const zoom = makeZoomElement({
      zoomType: "section",
      targetSlideIndex: 2,
      targetSectionId: undefined,
    });
    expect(getSectionSlideRange(zoom, slides)).toEqual([2]);
  });
});
