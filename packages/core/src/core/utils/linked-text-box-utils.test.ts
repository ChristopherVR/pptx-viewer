import { describe, it, expect } from "vitest";
import {
  buildLinkedTextBoxChains,
  distributeSegmentsAcrossChain,
  estimateTextBoxCapacity,
  getLinkedTextBoxSegments,
} from "./linked-text-box-utils";
import type { LinkedTextBoxChain } from "./linked-text-box-utils";
import type {
  PptxElement,
  PptxElementWithText,
  TextSegment,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers to build test elements
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
// buildLinkedTextBoxChains
// ---------------------------------------------------------------------------

describe("buildLinkedTextBoxChains", () => {
  it("returns an empty map when no elements have linkedTxbxId", () => {
    const elements: PptxElement[] = [
      makeTextElement({ id: "t1" }),
      makeTextElement({ id: "t2" }),
    ];
    const chains = buildLinkedTextBoxChains(elements);
    expect(chains.size).toBe(0);
  });

  it("groups elements by linkedTxbxId", () => {
    const elements: PptxElement[] = [
      makeTextElement({ id: "a", linkedTxbxId: 1, linkedTxbxSeq: 0 }),
      makeTextElement({ id: "b", linkedTxbxId: 1, linkedTxbxSeq: 1 }),
      makeTextElement({ id: "c", linkedTxbxId: 2, linkedTxbxSeq: 0 }),
    ];
    const chains = buildLinkedTextBoxChains(elements);
    expect(chains.size).toBe(2);
    expect(chains.get(1)!.members).toHaveLength(2);
    expect(chains.get(2)!.members).toHaveLength(1);
  });

  it("sorts members within a chain by linkedTxbxSeq", () => {
    const elements: PptxElement[] = [
      makeTextElement({ id: "b", linkedTxbxId: 1, linkedTxbxSeq: 2 }),
      makeTextElement({ id: "a", linkedTxbxId: 1, linkedTxbxSeq: 0 }),
      makeTextElement({ id: "c", linkedTxbxId: 1, linkedTxbxSeq: 1 }),
    ];
    const chains = buildLinkedTextBoxChains(elements);
    const chain = chains.get(1)!;
    expect(chain.members.map((m) => m.element.id)).toEqual(["a", "c", "b"]);
    expect(chain.members.map((m) => m.seq)).toEqual([0, 1, 2]);
  });

  it("defaults linkedTxbxSeq to 0 when missing", () => {
    const elements: PptxElement[] = [
      makeTextElement({ id: "a", linkedTxbxId: 5 }),
    ];
    const chains = buildLinkedTextBoxChains(elements);
    expect(chains.get(5)!.members[0].seq).toBe(0);
  });

  it("ignores non-text elements", () => {
    const elements: PptxElement[] = [
      { type: "image", id: "img1", x: 0, y: 0, width: 100, height: 100 } as PptxElement,
      makeTextElement({ id: "t1", linkedTxbxId: 1, linkedTxbxSeq: 0 }),
    ];
    const chains = buildLinkedTextBoxChains(elements);
    expect(chains.size).toBe(1);
    expect(chains.get(1)!.members).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// estimateTextBoxCapacity
// ---------------------------------------------------------------------------

describe("estimateTextBoxCapacity", () => {
  it("returns a positive number for a normal-sized text box", () => {
    const el = makeTextElement({
      id: "t1",
      width: 400,
      height: 200,
      textStyle: { fontSize: 12 },
    });
    const capacity = estimateTextBoxCapacity(el);
    expect(capacity).toBeGreaterThan(0);
  });

  it("returns 0 for a zero-sized text box", () => {
    const el = makeTextElement({
      id: "t1",
      width: 0,
      height: 0,
    });
    expect(estimateTextBoxCapacity(el)).toBe(0);
  });

  it("accounts for body insets", () => {
    const large = makeTextElement({
      id: "t1",
      width: 400,
      height: 200,
      textStyle: { fontSize: 12, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });
    const withInsets = makeTextElement({
      id: "t2",
      width: 400,
      height: 200,
      textStyle: { fontSize: 12, bodyInsetLeft: 50, bodyInsetRight: 50, bodyInsetTop: 50, bodyInsetBottom: 50 },
    });
    expect(estimateTextBoxCapacity(large)).toBeGreaterThan(
      estimateTextBoxCapacity(withInsets),
    );
  });

  it("larger font size results in fewer characters", () => {
    const small = makeTextElement({
      id: "t1",
      width: 400,
      height: 200,
      textStyle: { fontSize: 12 },
    });
    const large = makeTextElement({
      id: "t2",
      width: 400,
      height: 200,
      textStyle: { fontSize: 36 },
    });
    expect(estimateTextBoxCapacity(small)).toBeGreaterThan(
      estimateTextBoxCapacity(large),
    );
  });

  it("returns 0 when insets exceed dimensions", () => {
    const el = makeTextElement({
      id: "t1",
      width: 20,
      height: 20,
      textStyle: { bodyInsetLeft: 15, bodyInsetRight: 15, bodyInsetTop: 15, bodyInsetBottom: 15 },
    });
    expect(estimateTextBoxCapacity(el)).toBe(0);
  });

  it("uses default font size when textStyle is undefined", () => {
    const el = makeTextElement({ id: "t1", width: 400, height: 200 });
    const capacity = estimateTextBoxCapacity(el);
    expect(capacity).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// distributeSegmentsAcrossChain
// ---------------------------------------------------------------------------

describe("distributeSegmentsAcrossChain", () => {
  it("returns empty map for empty chain", () => {
    const chain: LinkedTextBoxChain = { chainId: 1, members: [] };
    const result = distributeSegmentsAcrossChain(chain);
    expect(result.size).toBe(0);
  });

  it("gives all segments to single-member chain", () => {
    const segments: TextSegment[] = [
      makeSeg("Hello "),
      makeSeg("World"),
    ];
    const el = makeTextElement({
      id: "t1",
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
    });
    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [{ element: el, seq: 0 }],
    };
    const result = distributeSegmentsAcrossChain(chain);
    expect(result.get("t1")).toHaveLength(2);
    expect(result.get("t1")![0].text).toBe("Hello ");
    expect(result.get("t1")![1].text).toBe("World");
  });

  it("distributes segments across two boxes based on capacity", () => {
    // Create a chain where the first box is tiny and the second is large.
    const segments: TextSegment[] = [
      makeSeg("AAAAABBBBBCCCCC", 12),
    ];
    const headEl = makeTextElement({
      id: "head",
      width: 30,
      height: 20,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });
    const tailEl = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
      textStyle: { fontSize: 12, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });

    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [
        { element: headEl, seq: 0 },
        { element: tailEl, seq: 1 },
      ],
    };

    const result = distributeSegmentsAcrossChain(chain);
    const headSegs = result.get("head")!;
    const tailSegs = result.get("tail")!;

    // Head box should have gotten some text, tail box should have the rest.
    const headText = headSegs.map((s) => s.text).join("");
    const tailText = tailSegs.map((s) => s.text).join("");
    expect(headText + tailText).toBe("AAAAABBBBBCCCCC");
    expect(headText.length).toBeGreaterThan(0);
    expect(tailText.length).toBeGreaterThan(0);
  });

  it("handles paragraph breaks in segments", () => {
    const segments: TextSegment[] = [
      makeSeg("Line1"),
      makeParaBreak(),
      makeSeg("Line2"),
    ];
    const el = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
    });
    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [{ element: el, seq: 0 }],
    };
    const result = distributeSegmentsAcrossChain(chain);
    expect(result.get("head")).toHaveLength(3);
  });

  it("gives empty segments to chain members when all text consumed", () => {
    const segments: TextSegment[] = [makeSeg("Hi")];
    const headEl = makeTextElement({
      id: "head",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 12 },
    });
    const tailEl = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });
    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [
        { element: headEl, seq: 0 },
        { element: tailEl, seq: 1 },
      ],
    };
    const result = distributeSegmentsAcrossChain(chain);
    // Head gets all text since box is large.
    const headText = result.get("head")!.map((s) => s.text).join("");
    const tailSegs = result.get("tail")!;
    expect(headText).toBe("Hi");
    expect(tailSegs).toHaveLength(0);
  });

  it("handles empty textSegments on head element", () => {
    const headEl = makeTextElement({
      id: "head",
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [],
    });
    const tailEl = makeTextElement({
      id: "tail",
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
    });
    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [
        { element: headEl, seq: 0 },
        { element: tailEl, seq: 1 },
      ],
    };
    const result = distributeSegmentsAcrossChain(chain);
    expect(result.get("head")).toEqual([]);
    expect(result.get("tail")).toEqual([]);
  });

  it("distributes across three boxes in sequence", () => {
    // Create a long text and three small boxes.
    const longText = "A".repeat(100);
    const segments: TextSegment[] = [makeSeg(longText, 12)];
    const makeSmallBox = (id: string, seq: number) =>
      makeTextElement({
        id,
        width: 40,
        height: 20,
        linkedTxbxId: 1,
        linkedTxbxSeq: seq,
        textSegments: seq === 0 ? segments : undefined,
        textStyle: { fontSize: 12, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
      });

    const chain: LinkedTextBoxChain = {
      chainId: 1,
      members: [
        { element: makeSmallBox("a", 0), seq: 0 },
        { element: makeSmallBox("b", 1), seq: 1 },
        { element: makeSmallBox("c", 2), seq: 2 },
      ],
    };

    const result = distributeSegmentsAcrossChain(chain);
    const allText = [
      ...result.get("a")!.map((s) => s.text),
      ...result.get("b")!.map((s) => s.text),
      ...result.get("c")!.map((s) => s.text),
    ].join("");
    expect(allText).toBe(longText);
  });
});

// ---------------------------------------------------------------------------
// getLinkedTextBoxSegments
// ---------------------------------------------------------------------------

describe("getLinkedTextBoxSegments", () => {
  it("returns undefined for elements without linkedTxbxId", () => {
    const el = makeTextElement({ id: "t1" });
    const result = getLinkedTextBoxSegments(el, [el]);
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-text elements", () => {
    const el = {
      type: "image",
      id: "img1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;
    const result = getLinkedTextBoxSegments(el, [el]);
    expect(result).toBeUndefined();
  });

  it("returns undefined for single-member chain (no overflow needed)", () => {
    const el = makeTextElement({
      id: "t1",
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: [makeSeg("Hello")],
    });
    const result = getLinkedTextBoxSegments(el, [el]);
    expect(result).toBeUndefined();
  });

  it("returns distributed segments for the head of a two-member chain", () => {
    const segments = [makeSeg("Hello World")];
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

    const headResult = getLinkedTextBoxSegments(head, [head, tail]);
    expect(headResult).toBeDefined();
    expect(headResult!.length).toBeGreaterThan(0);
  });

  it("returns segments for the tail of a two-member chain", () => {
    // Use a very tiny head so text overflows to tail.
    const longText = "X".repeat(200);
    const segments = [makeSeg(longText, 16)];
    const head = makeTextElement({
      id: "head",
      width: 30,
      height: 20,
      linkedTxbxId: 1,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 16, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 1,
      linkedTxbxSeq: 1,
      textStyle: { fontSize: 16, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });

    const tailResult = getLinkedTextBoxSegments(tail, [head, tail]);
    expect(tailResult).toBeDefined();
    // Tail should have overflow text
    const tailText = tailResult!.map((s) => s.text).join("");
    expect(tailText.length).toBeGreaterThan(0);
  });

  it("preserves total text content across the chain", () => {
    const originalText = "The quick brown fox jumps over the lazy dog.";
    const segments = [makeSeg(originalText, 14)];
    const head = makeTextElement({
      id: "head",
      width: 60,
      height: 30,
      linkedTxbxId: 7,
      linkedTxbxSeq: 0,
      textSegments: segments,
      textStyle: { fontSize: 14, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });
    const tail = makeTextElement({
      id: "tail",
      width: 400,
      height: 200,
      linkedTxbxId: 7,
      linkedTxbxSeq: 1,
      textStyle: { fontSize: 14, bodyInsetLeft: 0, bodyInsetRight: 0, bodyInsetTop: 0, bodyInsetBottom: 0 },
    });

    const allElements = [head, tail] as PptxElement[];
    const headSegs = getLinkedTextBoxSegments(head, allElements)!;
    const tailSegs = getLinkedTextBoxSegments(tail, allElements)!;
    const combined =
      headSegs.map((s) => s.text).join("") +
      tailSegs.map((s) => s.text).join("");
    expect(combined).toBe(originalText);
  });
});
