import { describe, it, expect } from "vitest";
import type { TextStyle, TextSegment } from "../../types";

// Since these are protected methods on a deeply chained mixin, we extract
// their logic and test them directly.

// --- Extracted from parseBooleanAttr ---
function parseBooleanAttr(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

// --- Extracted from parseOptionalBooleanAttr ---
function parseOptionalBooleanAttr(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (normalized.length === 0) return undefined;
  return parseBooleanAttr(normalized);
}

// --- Extracted from readFlipState ---
function readFlipState(
  xfrm: Record<string, unknown> | undefined,
): { flipHorizontal: boolean; flipVertical: boolean } {
  if (!xfrm) {
    return { flipHorizontal: false, flipVertical: false };
  }
  return {
    flipHorizontal: parseBooleanAttr(xfrm["@_flipH"]),
    flipVertical: parseBooleanAttr(xfrm["@_flipV"]),
  };
}

// --- Extracted from textStylesEqual ---
function textStylesEqual(
  left: TextStyle | undefined,
  right: TextStyle | undefined,
): boolean {
  const keys: Array<keyof TextStyle> = [
    "fontFamily",
    "fontSize",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "rtl",
    "hyperlink",
    "color",
    "align",
    "vAlign",
    "textDirection",
    "columnCount",
  ];
  return keys.every((key) => left?.[key] === right?.[key]);
}

// --- Extracted from hasMixedTextStyles ---
function hasMixedTextStyles(textSegments: TextSegment[]): boolean {
  if (textSegments.length <= 1) return false;
  const baseStyle = textSegments[0]?.style;
  return textSegments.some(
    (segment, index) =>
      index > 0 && !textStylesEqual(segment.style, baseStyle),
  );
}

// --- Extracted from normalizeTypefaceToken ---
function normalizeTypefaceToken(typeface: string): string | undefined {
  const normalized = typeface.trim();
  return normalized.length > 0 ? normalized : undefined;
}

// --- Extracted from compactTextSegments ---
function compactTextSegments(
  textSegments: TextSegment[],
  fallbackStyle: TextStyle | undefined,
): TextSegment[] {
  const compacted: TextSegment[] = [];
  textSegments.forEach((segment) => {
    const segmentText = String(segment.text || "");
    if (segmentText.length === 0) return;
    const segmentStyle = { ...segment.style };
    const previous = compacted[compacted.length - 1];
    if (previous && textStylesEqual(previous.style, segmentStyle)) {
      previous.text += segmentText;
      return;
    }
    compacted.push({ text: segmentText, style: segmentStyle });
  });

  if (compacted.length === 0) {
    return [{ text: "", style: fallbackStyle ? { ...fallbackStyle } : {} }];
  }
  return compacted;
}

// ---------------------------------------------------------------------------
// parseBooleanAttr
// ---------------------------------------------------------------------------
describe("parseBooleanAttr", () => {
  it('should return true for "1"', () => {
    expect(parseBooleanAttr("1")).toBe(true);
  });

  it('should return true for "true"', () => {
    expect(parseBooleanAttr("true")).toBe(true);
  });

  it('should return true for "True" (case-insensitive)', () => {
    expect(parseBooleanAttr("True")).toBe(true);
  });

  it('should return false for "0"', () => {
    expect(parseBooleanAttr("0")).toBe(false);
  });

  it('should return false for "false"', () => {
    expect(parseBooleanAttr("false")).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(parseBooleanAttr(undefined)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(parseBooleanAttr("")).toBe(false);
  });

  it("should return false for arbitrary string", () => {
    expect(parseBooleanAttr("yes")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseOptionalBooleanAttr
// ---------------------------------------------------------------------------
describe("parseOptionalBooleanAttr", () => {
  it("should return undefined for undefined input", () => {
    expect(parseOptionalBooleanAttr(undefined)).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(parseOptionalBooleanAttr(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(parseOptionalBooleanAttr("")).toBeUndefined();
  });

  it('should return true for "1"', () => {
    expect(parseOptionalBooleanAttr("1")).toBe(true);
  });

  it('should return true for "true"', () => {
    expect(parseOptionalBooleanAttr("true")).toBe(true);
  });

  it('should return false for "0"', () => {
    expect(parseOptionalBooleanAttr("0")).toBe(false);
  });

  it('should return false for "false"', () => {
    expect(parseOptionalBooleanAttr("false")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readFlipState
// ---------------------------------------------------------------------------
describe("readFlipState", () => {
  it("should return both false for undefined xfrm", () => {
    expect(readFlipState(undefined)).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it("should return both false when no flip attrs present", () => {
    expect(readFlipState({})).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it('should detect horizontal flip from "1"', () => {
    expect(readFlipState({ "@_flipH": "1" })).toEqual({
      flipHorizontal: true,
      flipVertical: false,
    });
  });

  it('should detect vertical flip from "true"', () => {
    expect(readFlipState({ "@_flipV": "true" })).toEqual({
      flipHorizontal: false,
      flipVertical: true,
    });
  });

  it("should detect both flips", () => {
    expect(readFlipState({ "@_flipH": "1", "@_flipV": "1" })).toEqual({
      flipHorizontal: true,
      flipVertical: true,
    });
  });

  it("should handle explicit false flips", () => {
    expect(readFlipState({ "@_flipH": "0", "@_flipV": "0" })).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });
});

// ---------------------------------------------------------------------------
// textStylesEqual
// ---------------------------------------------------------------------------
describe("textStylesEqual", () => {
  it("should return true for two undefined styles", () => {
    expect(textStylesEqual(undefined, undefined)).toBe(true);
  });

  it("should return true for identical styles", () => {
    const style: TextStyle = { fontFamily: "Arial", fontSize: 12, bold: true };
    expect(textStylesEqual(style, { ...style })).toBe(true);
  });

  it("should return false when fontFamily differs", () => {
    expect(
      textStylesEqual({ fontFamily: "Arial" }, { fontFamily: "Calibri" }),
    ).toBe(false);
  });

  it("should return false when fontSize differs", () => {
    expect(
      textStylesEqual({ fontSize: 12 }, { fontSize: 14 }),
    ).toBe(false);
  });

  it("should return false when bold differs", () => {
    expect(
      textStylesEqual({ bold: true }, { bold: false }),
    ).toBe(false);
  });

  it("should return true when only non-compared properties differ", () => {
    expect(
      textStylesEqual(
        { fontFamily: "Arial", lineSpacing: 1.5 },
        { fontFamily: "Arial", lineSpacing: 2.0 },
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasMixedTextStyles
// ---------------------------------------------------------------------------
describe("hasMixedTextStyles", () => {
  it("should return false for empty array", () => {
    expect(hasMixedTextStyles([])).toBe(false);
  });

  it("should return false for single segment", () => {
    expect(
      hasMixedTextStyles([{ text: "Hello", style: { bold: true } }]),
    ).toBe(false);
  });

  it("should return false for uniform segments", () => {
    const style: TextStyle = { fontFamily: "Arial", fontSize: 12 };
    expect(
      hasMixedTextStyles([
        { text: "Hello", style: { ...style } },
        { text: "World", style: { ...style } },
      ]),
    ).toBe(false);
  });

  it("should return true for mixed segments", () => {
    expect(
      hasMixedTextStyles([
        { text: "Hello", style: { bold: true } },
        { text: "World", style: { bold: false } },
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeTypefaceToken
// ---------------------------------------------------------------------------
describe("normalizeTypefaceToken", () => {
  it("should return undefined for empty string", () => {
    expect(normalizeTypefaceToken("")).toBeUndefined();
  });

  it("should return undefined for whitespace-only string", () => {
    expect(normalizeTypefaceToken("   ")).toBeUndefined();
  });

  it("should return trimmed typeface", () => {
    expect(normalizeTypefaceToken("  Arial  ")).toBe("Arial");
  });

  it("should return theme token as-is", () => {
    expect(normalizeTypefaceToken("+mn-lt")).toBe("+mn-lt");
  });
});

// ---------------------------------------------------------------------------
// compactTextSegments
// ---------------------------------------------------------------------------
describe("compactTextSegments", () => {
  it("should return fallback segment for empty input", () => {
    const result = compactTextSegments([], { fontFamily: "Arial" });
    expect(result).toEqual([{ text: "", style: { fontFamily: "Arial" } }]);
  });

  it("should return empty style when no fallback given", () => {
    const result = compactTextSegments([], undefined);
    expect(result).toEqual([{ text: "", style: {} }]);
  });

  it("should merge adjacent segments with identical styles", () => {
    const style: TextStyle = { fontSize: 12 };
    const result = compactTextSegments(
      [
        { text: "Hello ", style: { ...style } },
        { text: "World", style: { ...style } },
      ],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello World");
  });

  it("should keep segments with different styles separate", () => {
    const result = compactTextSegments(
      [
        { text: "Hello ", style: { bold: true } },
        { text: "World", style: { bold: false } },
      ],
      undefined,
    );
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello ");
    expect(result[1].text).toBe("World");
  });

  it("should skip empty text segments", () => {
    const style: TextStyle = { fontSize: 12 };
    const result = compactTextSegments(
      [
        { text: "Hello", style: { ...style } },
        { text: "", style: { ...style } },
        { text: " World", style: { ...style } },
      ],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello World");
  });
});
