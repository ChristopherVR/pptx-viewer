import { describe, it, expect } from "vitest";
import {
  isTemplateElement,
  isEditableTextElement,
  getElementLabel,
  shouldRenderFallbackLabel,
  getElementTextContent,
  createUniformTextSegments,
  createEditorId,
  createArrayBufferCopy,
  ensureArrayValue,
  formatCommentTimestamp,
  getCommentMarkerPosition,
} from "./element-utils";
import type { PptxElement } from "../types";

// ---------------------------------------------------------------------------
// isTemplateElement
// ---------------------------------------------------------------------------

describe("isTemplateElement", () => {
  it("returns true for layout-prefixed IDs", () => {
    const el = { id: "layout-shape-1", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isTemplateElement(el)).toBe(true);
  });

  it("returns true for master-prefixed IDs", () => {
    const el = { id: "master-bg-2", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isTemplateElement(el)).toBe(true);
  });

  it("returns false for regular element IDs", () => {
    const el = { id: "shape-12345", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isTemplateElement(el)).toBe(false);
  });

  it("returns false for empty IDs", () => {
    const el = { id: "", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isTemplateElement(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEditableTextElement
// ---------------------------------------------------------------------------

describe("isEditableTextElement", () => {
  it("returns true for text elements", () => {
    const el = { id: "t1", type: "text", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isEditableTextElement(el)).toBe(true);
  });

  it("returns true for shapes with text", () => {
    const el = { id: "s1", type: "shape", x: 0, y: 0, width: 100, height: 50, text: "Hello" } as PptxElement;
    expect(isEditableTextElement(el)).toBe(true);
  });

  it("returns true for shapes with textSegments", () => {
    const el = {
      id: "s2", type: "shape", x: 0, y: 0, width: 100, height: 50,
      textSegments: [{ text: "Hi", style: {} }],
    } as PptxElement;
    expect(isEditableTextElement(el)).toBe(true);
  });

  it("returns false for image elements", () => {
    const el = { id: "img1", type: "image", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isEditableTextElement(el)).toBe(false);
  });

  it("returns false for chart elements", () => {
    const el = { id: "ch1", type: "chart", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isEditableTextElement(el)).toBe(false);
  });

  it("returns false for connector elements", () => {
    const el = { id: "c1", type: "connector", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(isEditableTextElement(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getElementLabel
// ---------------------------------------------------------------------------

describe("getElementLabel", () => {
  it('returns "Text" for text elements', () => {
    expect(getElementLabel({ type: "text" } as PptxElement)).toBe("Text");
  });

  it('returns "Connector" for connectors', () => {
    expect(getElementLabel({ type: "connector" } as PptxElement)).toBe("Connector");
  });

  it('returns "Image" for image elements', () => {
    expect(getElementLabel({ type: "image" } as PptxElement)).toBe("Image");
  });

  it('returns "Image" for picture elements', () => {
    expect(getElementLabel({ type: "picture" } as PptxElement)).toBe("Image");
  });

  it('returns "Chart" for chart elements', () => {
    expect(getElementLabel({ type: "chart" } as PptxElement)).toBe("Chart");
  });

  it('returns "Table" for table elements', () => {
    expect(getElementLabel({ type: "table" } as PptxElement)).toBe("Table");
  });

  it('returns "SmartArt" for smartArt elements', () => {
    expect(getElementLabel({ type: "smartArt" } as PptxElement)).toBe("SmartArt");
  });

  it('returns "Embedded Object" for ole elements', () => {
    expect(getElementLabel({ type: "ole" } as PptxElement)).toBe("Embedded Object");
  });

  it('returns "Media" for media elements', () => {
    expect(getElementLabel({ type: "media" } as PptxElement)).toBe("Media");
  });

  it('returns "Shape" for shape elements (default)', () => {
    expect(getElementLabel({ type: "shape" } as PptxElement)).toBe("Shape");
  });
});

// ---------------------------------------------------------------------------
// shouldRenderFallbackLabel
// ---------------------------------------------------------------------------

describe("shouldRenderFallbackLabel", () => {
  it("returns false for text elements", () => {
    const el = { type: "text" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, true)).toBe(false);
  });

  it("returns false for shapes", () => {
    const el = { type: "shape" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });

  it("returns false for connectors", () => {
    const el = { type: "connector" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });

  it("returns false for images", () => {
    const el = { type: "image" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });

  it("returns false for tables", () => {
    const el = { type: "table" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });

  it("returns true for charts", () => {
    const el = { type: "chart" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(true);
  });

  it("returns true for smartArt", () => {
    const el = { type: "smartArt" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(true);
  });

  it("returns true for ole", () => {
    const el = { type: "ole" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(true);
  });

  it("returns true for media", () => {
    const el = { type: "media" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(true);
  });

  it("returns true for unknown elements", () => {
    const el = { type: "unknown" } as PptxElement;
    expect(shouldRenderFallbackLabel(el, false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getElementTextContent
// ---------------------------------------------------------------------------

describe("getElementTextContent", () => {
  it("returns empty string for non-text elements", () => {
    const el = { type: "image", id: "i1", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(getElementTextContent(el)).toBe("");
  });

  it("returns the text property if it is a string", () => {
    const el = { type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50, text: "Hello" } as PptxElement;
    expect(getElementTextContent(el)).toBe("Hello");
  });

  it("concatenates textSegments", () => {
    const el = {
      type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50,
      textSegments: [
        { text: "Hello ", style: {} },
        { text: "World", style: {} },
      ],
    } as PptxElement;
    expect(getElementTextContent(el)).toBe("Hello World");
  });

  it("returns empty string when textSegments is empty", () => {
    const el = {
      type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50,
      textSegments: [],
    } as PptxElement;
    expect(getElementTextContent(el)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// createUniformTextSegments
// ---------------------------------------------------------------------------

describe("createUniformTextSegments", () => {
  it("creates a single-segment array with the given text", () => {
    const segments = createUniformTextSegments("Test text", { bold: true });
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Test text");
  });

  it("clones the style so mutations do not propagate", () => {
    const style = { bold: true, fontSize: 18 };
    const segments = createUniformTextSegments("X", style);
    segments[0].style.bold = false;
    expect(style.bold).toBe(true);
  });

  it("provides an empty style object when style is undefined", () => {
    const segments = createUniformTextSegments("X", undefined);
    expect(segments[0].style).toBeDefined();
    expect(typeof segments[0].style).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// createEditorId
// ---------------------------------------------------------------------------

describe("createEditorId", () => {
  it("starts with the given prefix", () => {
    const id = createEditorId("shape");
    expect(id.startsWith("shape-")).toBe(true);
  });

  it("generates unique IDs on successive calls", () => {
    const id1 = createEditorId("el");
    const id2 = createEditorId("el");
    expect(id1).not.toBe(id2);
  });

  it("contains a timestamp-like portion", () => {
    const id = createEditorId("test");
    const parts = id.split("-");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const timestamp = Number(parts[1]);
    expect(Number.isFinite(timestamp)).toBe(true);
    expect(timestamp).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createArrayBufferCopy
// ---------------------------------------------------------------------------

describe("createArrayBufferCopy", () => {
  it("creates an independent copy of the bytes", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const copy = createArrayBufferCopy(original);
    const copyView = new Uint8Array(copy);
    expect(copyView).toEqual(original);
    // Mutate original, copy should be unaffected
    original[0] = 99;
    expect(copyView[0]).toBe(1);
  });

  it("handles empty byte arrays", () => {
    const original = new Uint8Array([]);
    const copy = createArrayBufferCopy(original);
    expect(copy.byteLength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ensureArrayValue
// ---------------------------------------------------------------------------

describe("ensureArrayValue", () => {
  it("returns an empty array for undefined", () => {
    expect(ensureArrayValue(undefined)).toEqual([]);
  });

  it("returns an empty array for null", () => {
    expect(ensureArrayValue(null)).toEqual([]);
  });

  it("wraps a single value in an array", () => {
    expect(ensureArrayValue("hello")).toEqual(["hello"]);
  });

  it("returns the array unchanged when given an array", () => {
    const arr = [1, 2, 3];
    expect(ensureArrayValue(arr)).toBe(arr);
  });

  it("wraps an object in an array", () => {
    const obj = { a: 1 };
    const result = ensureArrayValue(obj);
    expect(result).toEqual([obj]);
    expect(result[0]).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// formatCommentTimestamp
// ---------------------------------------------------------------------------

describe("formatCommentTimestamp", () => {
  it("returns empty string for undefined", () => {
    expect(formatCommentTimestamp(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatCommentTimestamp("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatCommentTimestamp("not-a-date")).toBe("");
  });

  it("returns a formatted string for a valid ISO date", () => {
    const result = formatCommentTimestamp("2024-03-07T14:30:00Z");
    expect(result.length).toBeGreaterThan(0);
    // Should contain "Mar" regardless of timezone
    expect(result).toContain("Mar");
  });
});

// ---------------------------------------------------------------------------
// getCommentMarkerPosition
// ---------------------------------------------------------------------------

describe("getCommentMarkerPosition", () => {
  it("uses comment coordinates when provided", () => {
    const pos = getCommentMarkerPosition({ x: 100, y: 200 }, 0, 1280, 720);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it("uses fallback grid position when coordinates are missing", () => {
    const pos = getCommentMarkerPosition({}, 0, 1280, 720);
    expect(pos.x).toBe(18);
    expect(pos.y).toBe(18);
  });

  it("uses fallback for second comment index", () => {
    const pos = getCommentMarkerPosition({}, 1, 1280, 720);
    expect(pos.x).toBe(32); // 18 + (1 % 4) * 14
    expect(pos.y).toBe(18);
  });

  it("clamps position to stay within slide edges", () => {
    const pos = getCommentMarkerPosition({ x: 2000, y: 2000 }, 0, 1280, 720);
    expect(pos.x).toBeLessThanOrEqual(1272);
    expect(pos.y).toBeLessThanOrEqual(712);
  });

  it("clamps small positions to at least 8", () => {
    const pos = getCommentMarkerPosition({ x: 1, y: 1 }, 0, 1280, 720);
    expect(pos.x).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeGreaterThanOrEqual(8);
  });

  it("handles NaN coordinates by using fallback", () => {
    const pos = getCommentMarkerPosition({ x: NaN, y: NaN }, 0, 1280, 720);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });

  it("handles Infinity coordinates by using fallback", () => {
    const pos = getCommentMarkerPosition({ x: Infinity, y: -Infinity }, 0, 1280, 720);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });

  it("wraps to next row after 4 columns", () => {
    const pos = getCommentMarkerPosition({}, 4, 1280, 720);
    expect(pos.x).toBe(18); // 18 + (4 % 4) * 14 = 18
    expect(pos.y).toBe(32); // 18 + floor(4/4) * 14 = 32
  });
});
