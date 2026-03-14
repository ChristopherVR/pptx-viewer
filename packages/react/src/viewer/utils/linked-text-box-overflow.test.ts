import { describe, it, expect } from "vitest";
import type {
  PptxElement,
  PptxElementWithText,
  TextSegment,
} from "pptx-viewer-core";
import {
  isLinkedTextBox,
  isLinkedTextBoxHead,
  getOverflowSegments,
  buildSlideOverflowMap,
} from "./linked-text-box-overflow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextElement(
  overrides: Partial<PptxElementWithText> & { id: string },
): PptxElementWithText {
  return {
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...overrides,
  } as PptxElementWithText;
}

function makeSeg(text: string, fontSize?: number): TextSegment {
  return { text, style: fontSize ? { fontSize } : {} };
}

function makeParaBreak(): TextSegment {
  return { text: "", style: {}, isParagraphBreak: true };
}

// ---------------------------------------------------------------------------
// isLinkedTextBox
// ---------------------------------------------------------------------------

describe("isLinkedTextBox", () => {
  it("returns true for elements with linkedTxbxId", () => {
    const el = makeTextElement({ id: "t1", linkedTxbxId: 1, linkedTxbxSeq: 0 });
    expect(isLinkedTextBox(el)).toBe(true);
  });

  it("returns false for elements without linkedTxbxId", () => {
    const el = makeTextElement({ id: "t1" });
    expect(isLinkedTextBox(el)).toBe(false);
  });

  it("returns false for non-text elements", () => {
    const el = {
      type: "image",
      id: "img1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;
    expect(isLinkedTextBox(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLinkedTextBoxHead
// ---------------------------------------------------------------------------

describe("isLinkedTextBoxHead", () => {
  it("returns true for seq=0 elements", () => {
    const el = makeTextElement({ id: "t1", linkedTxbxId: 1, linkedTxbxSeq: 0 });
    expect(isLinkedTextBoxHead(el)).toBe(true);
  });

  it("returns true when linkedTxbxSeq is undefined (defaults to 0)", () => {
    const el = makeTextElement({ id: "t1", linkedTxbxId: 1 });
    expect(isLinkedTextBoxHead(el)).toBe(true);
  });

  it("returns false for seq > 0", () => {
    const el = makeTextElement({ id: "t1", linkedTxbxId: 1, linkedTxbxSeq: 1 });
    expect(isLinkedTextBoxHead(el)).toBe(false);
  });

  it("returns false for elements without linkedTxbxId", () => {
    const el = makeTextElement({ id: "t1" });
    expect(isLinkedTextBoxHead(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getOverflowSegments
// ---------------------------------------------------------------------------

describe("getOverflowSegments", () => {
  it("returns undefined for non-linked elements", () => {
    const el = makeTextElement({ id: "t1", textSegments: [makeSeg("Hello")] });
    expect(getOverflowSegments(el, [el])).toBeUndefined();
  });

  it("returns undefined for a single-member chain", () => {
    const el = makeTextElement({
      id: "t1",
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg("Hello")],
    });
    expect(getOverflowSegments(el, [el])).toBeUndefined();
  });

  it("returns segments for head of a two-member chain", () => {
    const segments = [makeSeg("Hello World", 12)];
    const head = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });

    const result = getOverflowSegments(head, [head, tail]);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("distributes overflow text to the tail element", () => {
    const longText = "A".repeat(200);
    const segments = [makeSeg(longText, 16)];
    const head = makeTextElement({
      id: "head",
      width: 30,
      height: 20,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: {
        fontSize: 16,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
      textStyle: {
        fontSize: 16,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });

    const tailResult = getOverflowSegments(tail, [head, tail]);
    expect(tailResult).toBeDefined();
    const tailText = tailResult!.map((s) => s.text).join("");
    expect(tailText.length).toBeGreaterThan(0);
  });

  it("preserves total text content across head and tail", () => {
    const originalText = "The quick brown fox jumps over the lazy dog.";
    const segments = [makeSeg(originalText, 14)];
    const head = makeTextElement({
      id: "head",
      width: 60,
      height: 30,
      linkedTxbxId: 5,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: {
        fontSize: 14,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 5,
      linkedTxbxSeq: 1,
      textStyle: {
        fontSize: 14,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });

    const allElements = [head, tail] as PptxElement[];
    const headSegs = getOverflowSegments(head, allElements)!;
    const tailSegs = getOverflowSegments(tail, allElements)!;
    const combined =
      headSegs.map((s) => s.text).join("") +
      tailSegs.map((s) => s.text).join("");
    expect(combined).toBe(originalText);
  });

  it("handles paragraph breaks in overflow segments", () => {
    const segments = [
      makeSeg("Line1", 12),
      makeParaBreak(),
      makeSeg("Line2", 12),
    ];
    const head = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 3,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 3,
      linkedTxbxSeq: 1,
    });

    const headSegs = getOverflowSegments(head, [head, tail]);
    expect(headSegs).toBeDefined();
    // Large head box: all text should fit in the head
    expect(headSegs!.length).toBe(3);
  });

  it("gives empty segments to tail when all text fits in head", () => {
    const segments = [makeSeg("Hi", 12)];
    const head = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });

    const tailResult = getOverflowSegments(tail, [head, tail]);
    expect(tailResult).toBeDefined();
    expect(tailResult).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildSlideOverflowMap
// ---------------------------------------------------------------------------

describe("buildSlideOverflowMap", () => {
  it("returns empty map when no linked elements exist", () => {
    const elements = [
      makeTextElement({ id: "t1" }),
      makeTextElement({ id: "t2" }),
    ] as PptxElement[];
    const map = buildSlideOverflowMap(elements);
    expect(map.size).toBe(0);
  });

  it("returns empty map for single-member chains", () => {
    const elements = [
      makeTextElement({
        id: "t1",
        linkedTxbxId: 1,
        linkedTxbxSeq: 0,
        textSegments: [makeSeg("Hello")],
      }),
    ] as PptxElement[];
    const map = buildSlideOverflowMap(elements);
    // Single-member chains return undefined from getLinkedTextBoxSegments
    expect(map.size).toBe(0);
  });

  it("builds overflow map for a two-member chain", () => {
    const longText = "X".repeat(200);
    const head = makeTextElement({
      id: "head",
      width: 30,
      height: 20,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg(longText, 16)],
      textStyle: {
        fontSize: 16,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
      textStyle: {
        fontSize: 16,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });

    const elements = [head, tail] as PptxElement[];
    const map = buildSlideOverflowMap(elements);
    expect(map.size).toBe(2);
    expect(map.has("head")).toBe(true);
    expect(map.has("tail")).toBe(true);

    // All text should be preserved
    const headText = map.get("head")!.map((s) => s.text).join("");
    const tailText = map.get("tail")!.map((s) => s.text).join("");
    expect(headText + tailText).toBe(longText);
  });

  it("handles multiple independent chains on one slide", () => {
    const head1 = makeTextElement({
      id: "h1",
      width: 30,
      height: 20,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg("A".repeat(100), 12)],
      textStyle: {
        fontSize: 12,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const tail1 = makeTextElement({
      id: "t1",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
      textStyle: {
        fontSize: 12,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const head2 = makeTextElement({
      id: "h2",
      width: 30,
      height: 20,
      linkedTxbxId: 2,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg("B".repeat(100), 12)],
      textStyle: {
        fontSize: 12,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });
    const tail2 = makeTextElement({
      id: "t2",
      width: 400,
      height: 200,
      linkedTxbxId: 2,
      linkedTxbxSeq: 1,
      textStyle: {
        fontSize: 12,
        bodyInsetLeft: 0,
        bodyInsetRight: 0,
        bodyInsetTop: 0,
        bodyInsetBottom: 0,
      },
    });

    const elements = [head1, tail1, head2, tail2] as PptxElement[];
    const map = buildSlideOverflowMap(elements);
    expect(map.size).toBe(4);

    // Chain 1 text preserved
    const chain1Text =
      map.get("h1")!.map((s) => s.text).join("") +
      map.get("t1")!.map((s) => s.text).join("");
    expect(chain1Text).toBe("A".repeat(100));

    // Chain 2 text preserved
    const chain2Text =
      map.get("h2")!.map((s) => s.text).join("") +
      map.get("t2")!.map((s) => s.text).join("");
    expect(chain2Text).toBe("B".repeat(100));
  });

  it("ignores non-text elements when building overflow map", () => {
    const img = {
      type: "image",
      id: "img1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;
    const head = makeTextElement({
      id: "head",
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg("Hello")],
      textStyle: { fontSize: 12 },
    });
    const tail = makeTextElement({
      id: "tail",
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });

    const elements = [img, head, tail] as PptxElement[];
    const map = buildSlideOverflowMap(elements);
    // The chain has 2 members so we get distributions
    expect(map.has("head")).toBe(true);
    expect(map.has("tail")).toBe(true);
    expect(map.has("img1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// renderTextSegments with segmentOverrides (integration-level)
// ---------------------------------------------------------------------------

describe("renderTextSegments with segmentOverrides", () => {
  // These tests verify that the renderTextSegments function correctly
  // uses segmentOverrides when provided. Since renderTextSegments returns
  // React nodes, we test the core data flow through the linked text box
  // utilities instead, ensuring the segments passed are correct.

  it("segmentOverrides from getOverflowSegments are valid TextSegment arrays", () => {
    const segments = [makeSeg("Hello World", 12)];
    const head = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });

    const overrides = getOverflowSegments(head, [head, tail]);
    expect(overrides).toBeDefined();
    expect(Array.isArray(overrides)).toBe(true);
    for (const seg of overrides!) {
      expect(seg).toHaveProperty("text");
      expect(seg).toHaveProperty("style");
    }
  });

  it("segmentOverrides preserve style information from original segments", () => {
    const segments = [
      makeSeg("Bold text ", 14),
      { text: "italic text", style: { italic: true, fontSize: 14 } } as TextSegment,
    ];
    const head = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 14 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });

    const headOverrides = getOverflowSegments(head, [head, tail]);
    expect(headOverrides).toBeDefined();
    // The head is large enough to fit all text, so it should have both segments
    const allText = headOverrides!.map((s) => s.text).join("");
    expect(allText).toBe("Bold text italic text");
    // Style is preserved on the italic segment
    const italicSeg = headOverrides!.find((s) => s.text.includes("italic"));
    expect(italicSeg?.style?.italic).toBe(true);
  });
});
