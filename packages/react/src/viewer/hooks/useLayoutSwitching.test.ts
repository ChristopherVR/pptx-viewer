import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PptxSlide, PptxLayoutOption } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Pure logic extracted from useLayoutSwitching for unit testing.
// ---------------------------------------------------------------------------

/**
 * Simulates the applyLayout updater function that replaces a slide
 * in the slides array at the given index.
 */
function applyLayoutUpdater(
  slides: PptxSlide[],
  activeSlideIndex: number,
  updatedSlide: PptxSlide,
): PptxSlide[] {
  const next = [...slides];
  next[activeSlideIndex] = updatedSlide;
  return next;
}

/**
 * Simulates the core handler's applyLayoutToSlide result:
 * returns a new slide with layoutPath, layoutName, and isDirty set.
 */
function simulateApplyLayout(
  slide: PptxSlide,
  layoutPath: string,
  layoutName: string,
  layoutBgColor?: string,
): PptxSlide {
  const updated: PptxSlide = {
    ...slide,
    layoutPath,
    layoutName,
    isDirty: true,
  };
  // Apply layout background if slide doesn't have its own
  if (!slide.backgroundColor && layoutBgColor) {
    updated.backgroundColor = layoutBgColor;
  }
  return updated;
}

function makeSlide(overrides: Partial<PptxSlide> & { id: string }): PptxSlide {
  return {
    rId: "",
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLayoutSwitching logic", () => {
  let slides: PptxSlide[];

  beforeEach(() => {
    slides = [
      makeSlide({
        id: "ppt/slides/slide1.xml",
        layoutPath: "ppt/slideLayouts/slideLayout1.xml",
        layoutName: "Title Slide",
      }),
      makeSlide({
        id: "ppt/slides/slide2.xml",
        layoutPath: "ppt/slideLayouts/slideLayout2.xml",
        layoutName: "Title and Content",
      }),
    ];
  });

  describe("applyLayoutUpdater", () => {
    it("replaces the slide at the given index", () => {
      const updated = makeSlide({
        id: "ppt/slides/slide1.xml",
        layoutPath: "ppt/slideLayouts/slideLayout3.xml",
        layoutName: "Blank",
      });
      const result = applyLayoutUpdater(slides, 0, updated);
      expect(result[0].layoutPath).toBe(
        "ppt/slideLayouts/slideLayout3.xml",
      );
      expect(result[0].layoutName).toBe("Blank");
    });

    it("does not modify other slides", () => {
      const updated = makeSlide({
        id: "ppt/slides/slide1.xml",
        layoutPath: "ppt/slideLayouts/slideLayout3.xml",
        layoutName: "Blank",
      });
      const result = applyLayoutUpdater(slides, 0, updated);
      expect(result[1]).toBe(slides[1]);
    });

    it("returns a new array reference", () => {
      const updated = makeSlide({
        id: "ppt/slides/slide1.xml",
        layoutPath: "ppt/slideLayouts/slideLayout3.xml",
        layoutName: "Blank",
      });
      const result = applyLayoutUpdater(slides, 0, updated);
      expect(result).not.toBe(slides);
    });
  });

  describe("simulateApplyLayout", () => {
    it("sets layoutPath, layoutName, and isDirty", () => {
      const result = simulateApplyLayout(
        slides[0],
        "ppt/slideLayouts/slideLayout3.xml",
        "Blank",
      );
      expect(result.layoutPath).toBe("ppt/slideLayouts/slideLayout3.xml");
      expect(result.layoutName).toBe("Blank");
      expect(result.isDirty).toBe(true);
    });

    it("preserves existing slide properties", () => {
      const slide = makeSlide({
        id: "ppt/slides/slide1.xml",
        notes: "Speaker notes",
        hidden: false,
      });
      const result = simulateApplyLayout(
        slide,
        "ppt/slideLayouts/slideLayout2.xml",
        "Content",
      );
      expect(result.notes).toBe("Speaker notes");
      expect(result.hidden).toBe(false);
      expect(result.id).toBe("ppt/slides/slide1.xml");
    });

    it("applies layout background when slide has none", () => {
      const slide = makeSlide({ id: "s1" });
      const result = simulateApplyLayout(
        slide,
        "ppt/slideLayouts/slideLayout2.xml",
        "Content",
        "#FF0000",
      );
      expect(result.backgroundColor).toBe("#FF0000");
    });

    it("preserves slide background when it already has one", () => {
      const slide = makeSlide({
        id: "s1",
        backgroundColor: "#00FF00",
      });
      const result = simulateApplyLayout(
        slide,
        "ppt/slideLayouts/slideLayout2.xml",
        "Content",
        "#FF0000",
      );
      expect(result.backgroundColor).toBe("#00FF00");
    });

    it("does not set backgroundColor when layout has none", () => {
      const slide = makeSlide({ id: "s1" });
      const result = simulateApplyLayout(
        slide,
        "ppt/slideLayouts/slideLayout2.xml",
        "Content",
      );
      expect(result.backgroundColor).toBeUndefined();
    });
  });

  describe("currentLayoutPath derivation", () => {
    it("returns layoutPath from the active slide", () => {
      const activeSlideIndex = 0;
      const currentLayoutPath = slides[activeSlideIndex]?.layoutPath;
      expect(currentLayoutPath).toBe(
        "ppt/slideLayouts/slideLayout1.xml",
      );
    });

    it("returns undefined when slide has no layoutPath", () => {
      const bareSlides = [makeSlide({ id: "s1" })];
      const currentLayoutPath = bareSlides[0]?.layoutPath;
      expect(currentLayoutPath).toBeUndefined();
    });

    it("returns undefined for out-of-bounds index", () => {
      const currentLayoutPath = slides[99]?.layoutPath;
      expect(currentLayoutPath).toBeUndefined();
    });
  });
});
