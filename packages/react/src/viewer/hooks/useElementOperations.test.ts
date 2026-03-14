import { describe, it, expect } from "vitest";
import type { PptxElement, PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Pure logic extracted from useElementOperations for testing.
// ---------------------------------------------------------------------------

function makeElement(
  overrides: Partial<PptxElement> & { id: string },
): PptxElement {
  return {
    type: "shape",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    hidden: false,
    opacity: 1,
    rawXml: {},
    ...overrides,
  } as PptxElement;
}

function makeSlide(
  overrides: Partial<PptxSlide> & { id: string },
): PptxSlide {
  return {
    rId: "",
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// Element ID classification (mirrors isTemplateElementId from utils/element)
// ---------------------------------------------------------------------------

function isTemplateElementId(elementId: string): boolean {
  return elementId.startsWith("layout-") || elementId.startsWith("master-");
}

// ---------------------------------------------------------------------------
// Update element by ID in slides (non-template path)
// ---------------------------------------------------------------------------

function updateElementInSlidesUpdater(
  slides: PptxSlide[],
  activeSlideIndex: number,
  elementId: string,
  updates: Partial<PptxElement>,
): PptxSlide[] {
  return slides.map((s, i) =>
    i !== activeSlideIndex
      ? s
      : {
          ...s,
          elements: s.elements.map((el) =>
            el.id === elementId
              ? ({ ...el, ...updates } as PptxElement)
              : el,
          ),
        },
  );
}

// ---------------------------------------------------------------------------
// Update element by ID in template elements
// ---------------------------------------------------------------------------

function updateTemplateElementUpdater(
  templates: Record<string, PptxElement[]>,
  slideId: string,
  elementId: string,
  updates: Partial<PptxElement>,
): Record<string, PptxElement[]> {
  const elements = templates[slideId] ?? [];
  return {
    ...templates,
    [slideId]: elements.map((el) =>
      el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests: isTemplateElementId
// ---------------------------------------------------------------------------

describe("isTemplateElementId", () => {
  it("should return true for layout element IDs", () => {
    expect(isTemplateElementId("layout-123")).toBe(true);
  });

  it("should return true for master element IDs", () => {
    expect(isTemplateElementId("master-456")).toBe(true);
  });

  it("should return false for regular element IDs", () => {
    expect(isTemplateElementId("el-789")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isTemplateElementId("")).toBe(false);
  });

  it("should return false for partial matches", () => {
    expect(isTemplateElementId("my-layout-thing")).toBe(false);
    expect(isTemplateElementId("masterpiece")).toBe(false);
  });

  it('should be case-sensitive (Layout- is not a match)', () => {
    expect(isTemplateElementId("Layout-123")).toBe(false);
    expect(isTemplateElementId("Master-456")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: updateElementInSlidesUpdater
// ---------------------------------------------------------------------------

describe("updateElementInSlidesUpdater", () => {
  it("should update the matching element on the active slide", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [
          makeElement({ id: "a", x: 10 }),
          makeElement({ id: "b", x: 20 }),
        ],
      }),
    ];
    const result = updateElementInSlidesUpdater(slides, 0, "a", { x: 99 });
    expect(result[0].elements[0].x).toBe(99);
    expect(result[0].elements[1].x).toBe(20); // unchanged
  });

  it("should not modify other slides", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a", x: 10 })],
      }),
      makeSlide({
        id: "s2",
        elements: [makeElement({ id: "a", x: 50 })],
      }),
    ];
    const result = updateElementInSlidesUpdater(slides, 0, "a", { x: 99 });
    expect(result[0].elements[0].x).toBe(99);
    expect(result[1].elements[0].x).toBe(50); // unchanged
  });

  it("should handle element not found (no-op)", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a", x: 10 })],
      }),
    ];
    const result = updateElementInSlidesUpdater(slides, 0, "unknown", { x: 99 });
    expect(result[0].elements[0].x).toBe(10);
  });

  it("should merge multiple properties", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a", x: 10, y: 20, width: 100 })],
      }),
    ];
    const result = updateElementInSlidesUpdater(slides, 0, "a", {
      x: 50,
      y: 60,
      width: 200,
    });
    expect(result[0].elements[0].x).toBe(50);
    expect(result[0].elements[0].y).toBe(60);
    expect(result[0].elements[0].width).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: updateTemplateElementUpdater
// ---------------------------------------------------------------------------

describe("updateTemplateElementUpdater", () => {
  it("should update the matching template element", () => {
    const templates: Record<string, PptxElement[]> = {
      "slide-1": [makeElement({ id: "layout-1", x: 10 })],
    };
    const result = updateTemplateElementUpdater(
      templates,
      "slide-1",
      "layout-1",
      { x: 99 },
    );
    expect(result["slide-1"][0].x).toBe(99);
  });

  it("should not modify other slide templates", () => {
    const templates: Record<string, PptxElement[]> = {
      "slide-1": [makeElement({ id: "layout-1", x: 10 })],
      "slide-2": [makeElement({ id: "layout-2", x: 20 })],
    };
    const result = updateTemplateElementUpdater(
      templates,
      "slide-1",
      "layout-1",
      { x: 99 },
    );
    expect(result["slide-2"][0].x).toBe(20);
  });

  it("should handle missing slide ID gracefully", () => {
    const templates: Record<string, PptxElement[]> = {};
    const result = updateTemplateElementUpdater(
      templates,
      "missing",
      "layout-1",
      { x: 99 },
    );
    expect(result["missing"]).toEqual([]);
  });

  it("should handle element not found in template", () => {
    const templates: Record<string, PptxElement[]> = {
      "slide-1": [makeElement({ id: "layout-1", x: 10 })],
    };
    const result = updateTemplateElementUpdater(
      templates,
      "slide-1",
      "unknown",
      { x: 99 },
    );
    expect(result["slide-1"][0].x).toBe(10);
  });
});
