import { describe, it, expect } from "vitest";
import { findInSlides, applyFindReplacements } from "./useFindReplace";
import type { FindResult } from "./useFindReplace";
import type { PptxSlide, PptxElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextElement(
  id: string,
  segments: Array<{ text: string }>,
): PptxElement {
  return {
    id,
    type: "shape",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    text: segments.map((s) => s.text).join(""),
    textSegments: segments.map((s) => ({ text: s.text, style: {} })),
  } as unknown as PptxElement;
}

function makeImageElement(id: string): PptxElement {
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  } as PptxElement;
}

function makeSlide(id: string, elements: PptxElement[]): PptxSlide {
  return {
    id,
    rId: `rId-${id}`,
    slideNumber: 1,
    elements,
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// findInSlides
// ---------------------------------------------------------------------------

describe("findInSlides", () => {
  it("returns empty array for empty query", () => {
    const slides = [makeSlide("s1", [makeTextElement("el1", [{ text: "hello" }])])];
    expect(findInSlides(slides, "", false)).toEqual([]);
  });

  it("returns empty array when no slides have elements", () => {
    const slides = [makeSlide("s1", [])];
    expect(findInSlides(slides, "hello", false)).toEqual([]);
  });

  it("finds a simple match in a single segment", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "hello world" }])]),
    ];
    const results = findInSlides(slides, "world", false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 0,
      startOffset: 6,
      length: 5,
    });
  });

  it("finds multiple matches in the same segment", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "abcabcabc" }])]),
    ];
    const results = findInSlides(slides, "abc", false);
    expect(results).toHaveLength(3);
    expect(results[0].startOffset).toBe(0);
    expect(results[1].startOffset).toBe(3);
    expect(results[2].startOffset).toBe(6);
  });

  it("finds overlapping matches", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "aaaa" }])]),
    ];
    const results = findInSlides(slides, "aa", false);
    // "aa" at 0, "aa" at 1, "aa" at 2
    expect(results).toHaveLength(3);
    expect(results[0].startOffset).toBe(0);
    expect(results[1].startOffset).toBe(1);
    expect(results[2].startOffset).toBe(2);
  });

  it("searches case-insensitively by default", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "Hello WORLD" }])]),
    ];
    const results = findInSlides(slides, "hello", false);
    expect(results).toHaveLength(1);
    expect(results[0].startOffset).toBe(0);
  });

  it("searches case-sensitively when matchCase is true", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "Hello WORLD" }])]),
    ];
    expect(findInSlides(slides, "hello", true)).toHaveLength(0);
    expect(findInSlides(slides, "Hello", true)).toHaveLength(1);
  });

  it("searches across multiple segments of the same element", () => {
    const slides = [
      makeSlide("s1", [
        makeTextElement("el1", [{ text: "foo" }, { text: "bar foo" }]),
      ]),
    ];
    const results = findInSlides(slides, "foo", false);
    expect(results).toHaveLength(2);
    expect(results[0].segmentIndex).toBe(0);
    expect(results[1].segmentIndex).toBe(1);
  });

  it("searches across multiple slides", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "hello" }])]),
      makeSlide("s2", [makeTextElement("el2", [{ text: "hello again" }])]),
    ];
    const results = findInSlides(slides, "hello", false);
    expect(results).toHaveLength(2);
    expect(results[0].slideIndex).toBe(0);
    expect(results[1].slideIndex).toBe(1);
  });

  it("skips non-text elements (image, table, etc.)", () => {
    const slides = [
      makeSlide("s1", [makeImageElement("img1")]),
    ];
    const results = findInSlides(slides, "image", false);
    expect(results).toEqual([]);
  });

  it("handles elements with empty textSegments", () => {
    const el = {
      id: "el1",
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      textSegments: [],
    } as unknown as PptxElement;
    const slides = [makeSlide("s1", [el])];
    expect(findInSlides(slides, "test", false)).toEqual([]);
  });

  it("handles segments with empty text", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "" }])]),
    ];
    expect(findInSlides(slides, "test", false)).toEqual([]);
  });

  it("records correct length from original query", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "HELLO world" }])]),
    ];
    const results = findInSlides(slides, "hello", false);
    expect(results[0].length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// applyFindReplacements
// ---------------------------------------------------------------------------

describe("applyFindReplacements", () => {
  it("returns original slides when toReplace is empty", () => {
    const slides = [makeSlide("s1", [makeTextElement("el1", [{ text: "hello" }])])];
    expect(applyFindReplacements(slides, [], "world")).toBe(slides);
  });

  it("replaces a single match", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "hello world" }])]),
    ];
    const match: FindResult = {
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 0,
      startOffset: 6,
      length: 5,
    };
    const result = applyFindReplacements(slides, [match], "earth");
    const seg = (result[0].elements[0] as any).textSegments[0];
    expect(seg.text).toBe("hello earth");
  });

  it("replaces multiple matches in different segments", () => {
    const slides = [
      makeSlide("s1", [
        makeTextElement("el1", [{ text: "foo bar" }, { text: "foo baz" }]),
      ]),
    ];
    const matches: FindResult[] = [
      { slideIndex: 0, elementId: "el1", segmentIndex: 0, startOffset: 0, length: 3 },
      { slideIndex: 0, elementId: "el1", segmentIndex: 1, startOffset: 0, length: 3 },
    ];
    const result = applyFindReplacements(slides, matches, "qux");
    const segs = (result[0].elements[0] as any).textSegments;
    expect(segs[0].text).toBe("qux bar");
    expect(segs[1].text).toBe("qux baz");
  });

  it("handles replacement with different length string", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "abc" }])]),
    ];
    const match: FindResult = {
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 0,
      startOffset: 0,
      length: 3,
    };
    const result = applyFindReplacements(slides, [match], "longer-replacement");
    const seg = (result[0].elements[0] as any).textSegments[0];
    expect(seg.text).toBe("longer-replacement");
  });

  it("handles replacement with empty string (deletion)", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "hello world" }])]),
    ];
    const match: FindResult = {
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 0,
      startOffset: 5,
      length: 6,
    };
    const result = applyFindReplacements(slides, [match], "");
    const seg = (result[0].elements[0] as any).textSegments[0];
    expect(seg.text).toBe("hello");
  });

  it("handles multiple matches in the same segment (descending offset order)", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "foo foo foo" }])]),
    ];
    const matches: FindResult[] = [
      { slideIndex: 0, elementId: "el1", segmentIndex: 0, startOffset: 0, length: 3 },
      { slideIndex: 0, elementId: "el1", segmentIndex: 0, startOffset: 4, length: 3 },
      { slideIndex: 0, elementId: "el1", segmentIndex: 0, startOffset: 8, length: 3 },
    ];
    const result = applyFindReplacements(slides, matches, "bar");
    const seg = (result[0].elements[0] as any).textSegments[0];
    expect(seg.text).toBe("bar bar bar");
  });

  it("updates the concatenated text property", () => {
    const slides = [
      makeSlide("s1", [
        makeTextElement("el1", [{ text: "hello " }, { text: "world" }]),
      ]),
    ];
    const match: FindResult = {
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 1,
      startOffset: 0,
      length: 5,
    };
    const result = applyFindReplacements(slides, [match], "earth");
    const el = result[0].elements[0] as any;
    expect(el.text).toBe("hello earth");
  });

  it("does not mutate original slides", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "hello" }])]),
    ];
    const match: FindResult = {
      slideIndex: 0,
      elementId: "el1",
      segmentIndex: 0,
      startOffset: 0,
      length: 5,
    };
    applyFindReplacements(slides, [match], "bye");
    const seg = (slides[0].elements[0] as any).textSegments[0];
    expect(seg.text).toBe("hello");
  });

  it("handles replacements across multiple slides", () => {
    const slides = [
      makeSlide("s1", [makeTextElement("el1", [{ text: "cat" }])]),
      makeSlide("s2", [makeTextElement("el2", [{ text: "cat" }])]),
    ];
    const matches: FindResult[] = [
      { slideIndex: 0, elementId: "el1", segmentIndex: 0, startOffset: 0, length: 3 },
      { slideIndex: 1, elementId: "el2", segmentIndex: 0, startOffset: 0, length: 3 },
    ];
    const result = applyFindReplacements(slides, matches, "dog");
    expect((result[0].elements[0] as any).textSegments[0].text).toBe("dog");
    expect((result[1].elements[0] as any).textSegments[0].text).toBe("dog");
  });
});
