import { describe, it, expect } from "vitest";
import type { PptxElement, PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Pure logic extracted from useClipboardHandlers for testing.
// These mirror the updater functions passed to ops.updateSlides() and
// setTemplateElementsBySlideId().
// ---------------------------------------------------------------------------

function makeElement(
  overrides: Partial<PptxElement> & { id: string },
): PptxElement {
  return {
    type: "shape",
    x: 100,
    y: 200,
    width: 50,
    height: 50,
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
// Delete updaters
// ---------------------------------------------------------------------------

/**
 * Delete elements from a slide by IDs.
 */
function deleteElementsFromSlideUpdater(
  slides: PptxSlide[],
  activeSlideIndex: number,
  idsToDelete: Set<string>,
): PptxSlide[] {
  return slides.map((s, i) =>
    i === activeSlideIndex
      ? { ...s, elements: s.elements.filter((el) => !idsToDelete.has(el.id)) }
      : s,
  );
}

/**
 * Delete elements from template elements.
 */
function deleteTemplateElementsUpdater(
  templatesBySlideId: Record<string, PptxElement[]>,
  slideId: string,
  idsToDelete: Set<string>,
): Record<string, PptxElement[]> {
  const existing = templatesBySlideId[slideId] ?? [];
  return {
    ...templatesBySlideId,
    [slideId]: existing.filter((el) => !idsToDelete.has(el.id)),
  };
}

// ---------------------------------------------------------------------------
// Paste updater
// ---------------------------------------------------------------------------

/**
 * Paste an element into a slide (offset by 20px).
 */
function pasteElementIntoSlideUpdater(
  slides: PptxSlide[],
  activeSlideIndex: number,
  element: PptxElement,
): PptxSlide[] {
  return slides.map((s, i) =>
    i === activeSlideIndex ? { ...s, elements: [...s.elements, element] } : s,
  );
}

/**
 * Compute the position of a pasted element (offset by 20).
 */
function computePastePosition(
  sourceX: number,
  sourceY: number,
): { x: number; y: number } {
  return { x: sourceX + 20, y: sourceY + 20 };
}

// ---------------------------------------------------------------------------
// Tests: deleteElementsFromSlideUpdater
// ---------------------------------------------------------------------------

describe("deleteElementsFromSlideUpdater", () => {
  it("should remove elements by ID from the active slide", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [
          makeElement({ id: "a" }),
          makeElement({ id: "b" }),
          makeElement({ id: "c" }),
        ],
      }),
    ];
    const result = deleteElementsFromSlideUpdater(
      slides,
      0,
      new Set(["a", "c"]),
    );
    expect(result[0].elements).toHaveLength(1);
    expect(result[0].elements[0].id).toBe("b");
  });

  it("should not modify other slides", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a" })],
      }),
      makeSlide({
        id: "s2",
        elements: [makeElement({ id: "a" })], // same ID different slide
      }),
    ];
    const result = deleteElementsFromSlideUpdater(
      slides,
      0,
      new Set(["a"]),
    );
    expect(result[0].elements).toHaveLength(0);
    expect(result[1].elements).toHaveLength(1); // unchanged
  });

  it("should handle empty ID set", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a" })],
      }),
    ];
    const result = deleteElementsFromSlideUpdater(slides, 0, new Set());
    expect(result[0].elements).toHaveLength(1);
  });

  it("should handle deleting all elements", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "a" }), makeElement({ id: "b" })],
      }),
    ];
    const result = deleteElementsFromSlideUpdater(
      slides,
      0,
      new Set(["a", "b"]),
    );
    expect(result[0].elements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteTemplateElementsUpdater
// ---------------------------------------------------------------------------

describe("deleteTemplateElementsUpdater", () => {
  it("should remove template elements by ID", () => {
    const templates: Record<string, PptxElement[]> = {
      "slide-1": [makeElement({ id: "t1" }), makeElement({ id: "t2" })],
    };
    const result = deleteTemplateElementsUpdater(
      templates,
      "slide-1",
      new Set(["t1"]),
    );
    expect(result["slide-1"]).toHaveLength(1);
    expect(result["slide-1"][0].id).toBe("t2");
  });

  it("should not modify other slide templates", () => {
    const templates: Record<string, PptxElement[]> = {
      "slide-1": [makeElement({ id: "t1" })],
      "slide-2": [makeElement({ id: "t1" })], // same ID
    };
    const result = deleteTemplateElementsUpdater(
      templates,
      "slide-1",
      new Set(["t1"]),
    );
    expect(result["slide-1"]).toHaveLength(0);
    expect(result["slide-2"]).toHaveLength(1);
  });

  it("should handle missing slide ID gracefully", () => {
    const templates: Record<string, PptxElement[]> = {};
    const result = deleteTemplateElementsUpdater(
      templates,
      "missing",
      new Set(["t1"]),
    );
    expect(result["missing"]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: pasteElementIntoSlideUpdater
// ---------------------------------------------------------------------------

describe("pasteElementIntoSlideUpdater", () => {
  it("should add element to the active slide", () => {
    const slides = [
      makeSlide({ id: "s1", elements: [makeElement({ id: "a" })] }),
    ];
    const newEl = makeElement({ id: "pasted" });
    const result = pasteElementIntoSlideUpdater(slides, 0, newEl);
    expect(result[0].elements).toHaveLength(2);
    expect(result[0].elements[1].id).toBe("pasted");
  });

  it("should not modify other slides", () => {
    const slides = [
      makeSlide({ id: "s1" }),
      makeSlide({ id: "s2" }),
    ];
    const newEl = makeElement({ id: "pasted" });
    const result = pasteElementIntoSlideUpdater(slides, 0, newEl);
    expect(result[0].elements).toHaveLength(1);
    expect(result[1].elements).toHaveLength(0);
  });

  it("should append to existing elements", () => {
    const slides = [
      makeSlide({
        id: "s1",
        elements: [makeElement({ id: "existing" })],
      }),
    ];
    const newEl = makeElement({ id: "pasted" });
    const result = pasteElementIntoSlideUpdater(slides, 0, newEl);
    expect(result[0].elements.map((e) => e.id)).toEqual(["existing", "pasted"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: computePastePosition
// ---------------------------------------------------------------------------

describe("computePastePosition", () => {
  it("should offset position by 20 pixels", () => {
    const result = computePastePosition(100, 200);
    expect(result).toEqual({ x: 120, y: 220 });
  });

  it("should handle zero position", () => {
    const result = computePastePosition(0, 0);
    expect(result).toEqual({ x: 20, y: 20 });
  });

  it("should handle negative position", () => {
    const result = computePastePosition(-10, -20);
    expect(result).toEqual({ x: 10, y: 0 });
  });
});
