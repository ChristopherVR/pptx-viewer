import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  createPlainNotesSegments,
  segmentsToPlainText,
  normalizeSegments,
  parsePt,
  segmentsToParagraphs,
  paragraphsToSegments,
} from "./notes-utils";
import type { TextSegment } from "pptx-viewer-core";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("does not modify safe text", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("escapes multiple special characters at once", () => {
    expect(escapeHtml('<a href="x">&')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;',
    );
  });
});

describe("createPlainNotesSegments", () => {
  it("creates single segment for simple text", () => {
    const segments = createPlainNotesSegments("Hello");
    expect(segments).toEqual([{ text: "Hello", style: {} }]);
  });

  it("creates segments with paragraph breaks for newlines", () => {
    const segments = createPlainNotesSegments("Line 1\nLine 2");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ text: "Line 1", style: {} });
    expect(segments[1]).toEqual({
      text: "",
      style: {},
      isParagraphBreak: true,
    });
    expect(segments[2]).toEqual({ text: "Line 2", style: {} });
  });

  it("returns a single empty segment for empty string", () => {
    const segments = createPlainNotesSegments("");
    expect(segments).toEqual([{ text: "", style: {} }]);
  });

  it("handles multiple consecutive newlines", () => {
    const segments = createPlainNotesSegments("A\n\nB");
    // "A\n\nB" splits into ["A", "", "B"] (3 lines)
    // line "A" → segment, then break, line "" → segment, then break, line "B" → segment
    expect(segments).toHaveLength(5);
    expect(segments[0].text).toBe("A");
    expect(segments[1].isParagraphBreak).toBe(true);
    expect(segments[2].text).toBe("");
    expect(segments[3].isParagraphBreak).toBe(true);
    expect(segments[4].text).toBe("B");
  });

  it("handles trailing newline", () => {
    const segments = createPlainNotesSegments("Hello\n");
    expect(segments).toHaveLength(3);
    expect(segments[2]).toEqual({ text: "", style: {} });
  });

  it("handles three lines", () => {
    const segments = createPlainNotesSegments("A\nB\nC");
    expect(segments).toHaveLength(5);
    expect(segments[0].text).toBe("A");
    expect(segments[2].text).toBe("B");
    expect(segments[4].text).toBe("C");
  });
});

describe("segmentsToPlainText", () => {
  it("concatenates text segments", () => {
    const result = segmentsToPlainText([
      { text: "Hello ", style: {} },
      { text: "World", style: {} },
    ]);
    expect(result).toBe("Hello World");
  });

  it("inserts newline for paragraph breaks", () => {
    const result = segmentsToPlainText([
      { text: "Line 1", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "Line 2", style: {} },
    ]);
    expect(result).toBe("Line 1\nLine 2");
  });

  it("returns empty string for empty segments", () => {
    expect(segmentsToPlainText([])).toBe("");
  });

  it("handles single empty segment", () => {
    expect(segmentsToPlainText([{ text: "", style: {} }])).toBe("");
  });

  it("handles multiple breaks", () => {
    const result = segmentsToPlainText([
      { text: "A", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "B", style: {} },
    ]);
    expect(result).toBe("A\n\nB");
  });

  it("handles segment with only paragraph break", () => {
    const result = segmentsToPlainText([
      { text: "", style: {}, isParagraphBreak: true },
    ]);
    expect(result).toBe("\n");
  });
});

describe("normalizeSegments", () => {
  it("removes empty non-break segments", () => {
    const result = normalizeSegments([
      { text: "hello", style: {} },
      { text: "", style: {} },
    ]);
    expect(result).toEqual([{ text: "hello", style: {} }]);
  });

  it("trims trailing paragraph breaks", () => {
    const result = normalizeSegments([
      { text: "hello", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
    ]);
    expect(result).toEqual([{ text: "hello", style: {} }]);
  });

  it("returns single empty segment when all segments are empty", () => {
    const result = normalizeSegments([{ text: "", style: {} }]);
    expect(result).toEqual([{ text: "", style: {} }]);
  });

  it("preserves non-trailing breaks", () => {
    const result = normalizeSegments([
      { text: "A", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "B", style: {} },
    ]);
    expect(result).toHaveLength(3);
    expect(result[1].isParagraphBreak).toBe(true);
  });

  it("removes multiple trailing breaks", () => {
    const result = normalizeSegments([
      { text: "A", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "", style: {}, isParagraphBreak: true },
    ]);
    expect(result).toEqual([{ text: "A", style: {} }]);
  });

  it("returns empty segment for all-break input", () => {
    const result = normalizeSegments([
      { text: "", style: {}, isParagraphBreak: true },
    ]);
    expect(result).toEqual([{ text: "", style: {} }]);
  });
});

describe("parsePt", () => {
  it("returns undefined for undefined input", () => {
    expect(parsePt(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parsePt("")).toBeUndefined();
  });

  it("parses plain numeric string", () => {
    expect(parsePt("12")).toBe(12);
  });

  it("parses floating-point value", () => {
    expect(parsePt("14.5")).toBe(14.5);
  });

  it("converts px to pt", () => {
    // 16px * 0.75 = 12pt
    expect(parsePt("16px")).toBe(12);
  });

  it("returns undefined for NaN", () => {
    expect(parsePt("abc")).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(parsePt("Infinity")).toBeUndefined();
  });

  it("handles zero", () => {
    expect(parsePt("0")).toBe(0);
  });
});

describe("segmentsToParagraphs", () => {
  it("creates single paragraph for simple segments", () => {
    const paragraphs = segmentsToParagraphs([{ text: "Hello", style: {} }]);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].bulletType).toBe("none");
    expect(paragraphs[0].indentLevel).toBe(0);
  });

  it("splits at paragraph breaks", () => {
    const paragraphs = segmentsToParagraphs([
      { text: "Line 1", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "Line 2", style: {} },
    ]);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].segments[0].text).toBe("Line 1");
    expect(paragraphs[1].segments[0].text).toBe("Line 2");
  });

  it("detects bullet paragraphs", () => {
    const paragraphs = segmentsToParagraphs([
      { text: "Item", style: {}, bulletInfo: { char: "\u2022" } },
    ]);
    expect(paragraphs[0].bulletType).toBe("bullet");
  });

  it("detects numbered paragraphs", () => {
    const paragraphs = segmentsToParagraphs([
      {
        text: "Item",
        style: {},
        bulletInfo: { autoNumType: "arabicPeriod", paragraphIndex: 0 },
      },
    ]);
    expect(paragraphs[0].bulletType).toBe("numbered");
  });

  it("returns empty paragraph for empty input", () => {
    const paragraphs = segmentsToParagraphs([]);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].segments[0].text).toBe("");
  });

  it("computes indent level from paragraphMarginLeft", () => {
    const paragraphs = segmentsToParagraphs([
      { text: "Indented", style: { paragraphMarginLeft: 48 } },
    ]);
    // 48 / 24 = indent level 2
    expect(paragraphs[0].indentLevel).toBe(2);
  });
});

describe("paragraphsToSegments", () => {
  it("round-trips simple paragraphs", () => {
    const segments: TextSegment[] = [
      { text: "Hello", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "World", style: {} },
    ];
    const paragraphs = segmentsToParagraphs(segments);
    const result = paragraphsToSegments(paragraphs);
    expect(result[0].text).toBe("Hello");
    expect(result[1].isParagraphBreak).toBe(true);
    expect(result[2].text).toBe("World");
  });

  it("adds bullet info on first segment of bullet paragraphs", () => {
    const result = paragraphsToSegments([
      {
        segments: [{ text: "Item", style: {} }],
        bulletType: "bullet",
        indentLevel: 0,
      },
    ]);
    expect(result[0].bulletInfo?.char).toBe("\u2022");
  });

  it("adds numbered bullet info with sequential index", () => {
    const result = paragraphsToSegments([
      {
        segments: [{ text: "First", style: {} }],
        bulletType: "numbered",
        indentLevel: 0,
      },
      {
        segments: [{ text: "Second", style: {} }],
        bulletType: "numbered",
        indentLevel: 0,
      },
    ]);
    expect(result[0].bulletInfo?.autoNumType).toBe("arabicPeriod");
    expect(result[0].bulletInfo?.paragraphIndex).toBe(0);
    // After break separator (index 1), second paragraph is at index 2
    expect(result[2].bulletInfo?.paragraphIndex).toBe(1);
  });

  it("sets paragraphMarginLeft for indented paragraphs", () => {
    const result = paragraphsToSegments([
      {
        segments: [{ text: "Indented", style: {} }],
        bulletType: "none",
        indentLevel: 3,
      },
    ]);
    expect(result[0].style.paragraphMarginLeft).toBe(72); // 3 * 24
  });

  it("removes paragraphMarginLeft for zero indent", () => {
    const result = paragraphsToSegments([
      {
        segments: [
          { text: "No indent", style: { paragraphMarginLeft: 48 } },
        ],
        bulletType: "none",
        indentLevel: 0,
      },
    ]);
    expect(result[0].style.paragraphMarginLeft).toBeUndefined();
  });

  it("inserts paragraph breaks between paragraphs", () => {
    const result = paragraphsToSegments([
      {
        segments: [{ text: "A", style: {} }],
        bulletType: "none",
        indentLevel: 0,
      },
      {
        segments: [{ text: "B", style: {} }],
        bulletType: "none",
        indentLevel: 0,
      },
    ]);
    expect(result).toHaveLength(3);
    expect(result[1].isParagraphBreak).toBe(true);
  });
});
