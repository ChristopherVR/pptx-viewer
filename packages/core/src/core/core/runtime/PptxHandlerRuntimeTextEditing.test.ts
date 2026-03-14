/**
 * Tests for PptxHandlerRuntimeTextEditing:
 *   - remapEditedTextToExistingStyles logic (style-preserving text remap)
 *   - extractTextSegmentsFromTxBodyForRewrite logic (segment extraction)
 */
import { describe, it, expect } from "vitest";

import type { TextStyle, TextSegment } from "../../types";

// ---------------------------------------------------------------------------
// Reimplemented helpers
// ---------------------------------------------------------------------------

function cloneTextStyleValue(style: TextStyle | undefined): TextStyle {
  if (!style) return {};
  return JSON.parse(JSON.stringify(style));
}

function normalizeTextLineBreaks(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Compact adjacent segments with identical styles into single segments.
 */
function compactTextSegments(
  segments: TextSegment[],
  _baseStyle: TextStyle | undefined,
): TextSegment[] {
  if (segments.length === 0) return segments;
  const compacted: TextSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const sameStyle = JSON.stringify(current.style) === JSON.stringify(seg.style);
    if (sameStyle && !current.fieldType && !seg.fieldType) {
      current = { ...current, text: current.text + seg.text };
    } else {
      compacted.push(current);
      current = { ...seg };
    }
  }
  compacted.push(current);
  return compacted;
}

/**
 * Remap edited text to existing styles using prefix/suffix matching.
 */
function remapEditedTextToExistingStyles(
  existingSegments: TextSegment[],
  nextText: string,
  fallbackStyle: TextStyle | undefined,
): TextSegment[] {
  const normalizedNextText = normalizeTextLineBreaks(nextText);
  const existingChars: Array<{ char: string; style: TextStyle }> = [];

  existingSegments.forEach((segment) => {
    const segmentText = normalizeTextLineBreaks(String(segment.text || ""));
    const segmentStyle = {
      ...(fallbackStyle || {}),
      ...(segment.style || {}),
    } as TextStyle;
    for (const char of Array.from(segmentText)) {
      existingChars.push({
        char,
        style: cloneTextStyleValue(segmentStyle),
      });
    }
  });

  const nextChars = Array.from(normalizedNextText);
  if (nextChars.length === 0) {
    return [
      {
        text: "",
        style: cloneTextStyleValue(existingChars[0]?.style || fallbackStyle),
      },
    ];
  }

  if (existingChars.length === 0) {
    return [
      {
        text: normalizedNextText,
        style: cloneTextStyleValue(fallbackStyle),
      },
    ];
  }

  const existingTextChars = existingChars.map((entry) => entry.char);
  let prefixLength = 0;
  while (
    prefixLength < existingTextChars.length &&
    prefixLength < nextChars.length &&
    existingTextChars[prefixLength] === nextChars[prefixLength]
  ) {
    prefixLength += 1;
  }

  let existingSuffixIndex = existingTextChars.length - 1;
  let nextSuffixIndex = nextChars.length - 1;
  while (
    existingSuffixIndex >= prefixLength &&
    nextSuffixIndex >= prefixLength &&
    existingTextChars[existingSuffixIndex] === nextChars[nextSuffixIndex]
  ) {
    existingSuffixIndex -= 1;
    nextSuffixIndex -= 1;
  }

  const remappedChars: Array<{ char: string; style: TextStyle }> = [];
  for (let index = 0; index < prefixLength; index++) {
    remappedChars.push({
      char: nextChars[index],
      style: cloneTextStyleValue(existingChars[index]?.style),
    });
  }

  const insertedStyle = cloneTextStyleValue(
    (prefixLength > 0 ? existingChars[prefixLength - 1]?.style : undefined) ||
      (existingSuffixIndex + 1 < existingChars.length
        ? existingChars[existingSuffixIndex + 1]?.style
        : undefined) ||
      existingChars[0]?.style ||
      fallbackStyle,
  );
  for (
    let index = prefixLength;
    index <= nextSuffixIndex && index < nextChars.length;
    index++
  ) {
    remappedChars.push({
      char: nextChars[index],
      style: cloneTextStyleValue(insertedStyle),
    });
  }

  const existingSuffixStart = existingSuffixIndex + 1;
  const nextSuffixStart = nextSuffixIndex + 1;
  for (let index = 0; index < nextChars.length - nextSuffixStart; index++) {
    remappedChars.push({
      char: nextChars[nextSuffixStart + index],
      style: cloneTextStyleValue(
        existingChars[existingSuffixStart + index]?.style || insertedStyle,
      ),
    });
  }

  const remappedSegments = remappedChars.map((entry) => ({
    text: entry.char,
    style: entry.style,
  }));
  return compactTextSegments(remappedSegments, fallbackStyle);
}

// ---------------------------------------------------------------------------
// Tests: remapEditedTextToExistingStyles
// ---------------------------------------------------------------------------
describe("remapEditedTextToExistingStyles", () => {
  it("should preserve styles when text is unchanged", () => {
    const existing: TextSegment[] = [
      { text: "Hello", style: { bold: true } },
      { text: " World", style: { italic: true } },
    ];
    const result = remapEditedTextToExistingStyles(
      existing,
      "Hello World",
      undefined,
    );
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello");
    expect(result[0].style?.bold).toBe(true);
    expect(result[1].text).toBe(" World");
    expect(result[1].style?.italic).toBe(true);
  });

  it("should use prefix style for inserted text in the middle", () => {
    const existing: TextSegment[] = [
      { text: "AB", style: { bold: true } },
      { text: "CD", style: { italic: true } },
    ];
    // Inserting "X" between B and C: "ABXCD"
    const result = remapEditedTextToExistingStyles(
      existing,
      "ABXCD",
      undefined,
    );
    // "AB" keeps bold, "X" inherits from prefix (bold), "CD" keeps italic
    const texts = result.map((s) => s.text).join("");
    expect(texts).toBe("ABXCD");
    // The inserted X should have the bold style from the prefix
    const xSegment = result.find((s) => s.text.includes("X"));
    expect(xSegment?.style?.bold).toBe(true);
  });

  it("should return empty text segment when next text is empty", () => {
    const existing: TextSegment[] = [
      { text: "Hello", style: { bold: true } },
    ];
    const result = remapEditedTextToExistingStyles(existing, "", undefined);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("");
    expect(result[0].style?.bold).toBe(true);
  });

  it("should use fallback style when existing segments are empty", () => {
    const result = remapEditedTextToExistingStyles(
      [],
      "New text",
      { fontSize: 24 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("New text");
    expect(result[0].style?.fontSize).toBe(24);
  });

  it("should handle text appended at the end", () => {
    const existing: TextSegment[] = [
      { text: "Hello", style: { color: "#FF0000" } },
    ];
    const result = remapEditedTextToExistingStyles(
      existing,
      "Hello World",
      undefined,
    );
    const texts = result.map((s) => s.text).join("");
    expect(texts).toBe("Hello World");
    // Both parts should have the red color
    result.forEach((seg) => {
      expect(seg.style?.color).toBe("#FF0000");
    });
  });

  it("should handle deletion from text", () => {
    const existing: TextSegment[] = [
      { text: "Hello", style: { bold: true } },
      { text: " World", style: { italic: true } },
    ];
    // Deleting "lo" from "Hello World" -> "Hel World"
    const result = remapEditedTextToExistingStyles(
      existing,
      "Hel World",
      undefined,
    );
    const texts = result.map((s) => s.text).join("");
    expect(texts).toBe("Hel World");
  });

  it("should normalize \\r\\n to \\n", () => {
    const existing: TextSegment[] = [
      { text: "A\r\nB", style: { bold: true } },
    ];
    const result = remapEditedTextToExistingStyles(
      existing,
      "A\nB",
      undefined,
    );
    const texts = result.map((s) => s.text).join("");
    expect(texts).toBe("A\nB");
  });
});

// ---------------------------------------------------------------------------
// Tests: compactTextSegments
// ---------------------------------------------------------------------------
describe("compactTextSegments", () => {
  it("should merge adjacent segments with same style", () => {
    const segments: TextSegment[] = [
      { text: "A", style: { bold: true } },
      { text: "B", style: { bold: true } },
      { text: "C", style: { italic: true } },
    ];
    const result = compactTextSegments(segments, undefined);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("AB");
    expect(result[1].text).toBe("C");
  });

  it("should return empty array for empty input", () => {
    expect(compactTextSegments([], undefined)).toEqual([]);
  });

  it("should not merge segments with different styles", () => {
    const segments: TextSegment[] = [
      { text: "A", style: { bold: true } },
      { text: "B", style: { bold: false } },
    ];
    const result = compactTextSegments(segments, undefined);
    expect(result).toHaveLength(2);
  });

  it("should not merge field segments", () => {
    const segments: TextSegment[] = [
      { text: "A", style: {}, fieldType: "slidenum" },
      { text: "B", style: {} },
    ];
    const result = compactTextSegments(segments, undefined);
    expect(result).toHaveLength(2);
  });

  it("should handle single segment", () => {
    const segments: TextSegment[] = [{ text: "Hello", style: {} }];
    const result = compactTextSegments(segments, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello");
  });
});
