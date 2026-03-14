import { describe, it, expect } from "vitest";
import type { TextStyle, TextSegment } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeTextStyleUtils
// Pure re-implementations for direct testing of style comparison, segment
// compaction, and boolean attribute parsing.
// ---------------------------------------------------------------------------

const STYLE_KEYS: Array<keyof TextStyle> = [
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

function textStylesEqual(
  left: TextStyle | undefined,
  right: TextStyle | undefined,
): boolean {
  return STYLE_KEYS.every((key) => left?.[key] === right?.[key]);
}

function hasMixedTextStyles(textSegments: TextSegment[]): boolean {
  if (textSegments.length <= 1) return false;
  const baseStyle = textSegments[0]?.style;
  return textSegments.some(
    (segment, index) =>
      index > 0 && !textStylesEqual(segment.style, baseStyle),
  );
}

function areTextSegmentsUniform(
  textSegments: TextSegment[] | undefined,
): boolean {
  if (!textSegments || textSegments.length <= 1) return true;
  return !hasMixedTextStyles(textSegments);
}

function parseBooleanAttr(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true";
}

function parseOptionalBooleanAttr(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (normalized.length === 0) return undefined;
  return parseBooleanAttr(normalized);
}

function normalizeTypefaceToken(typeface: string): string | undefined {
  const normalized = typeface.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveThemeTypeface(
  typeface: string | undefined,
  themeFontMap: Record<string, string>,
): string | undefined {
  const normalized = normalizeTypefaceToken(typeface || "");
  if (!normalized) return undefined;
  if (normalized.startsWith("+")) {
    const token = normalized.slice(1).toLowerCase();
    const resolved = themeFontMap[token];
    if (resolved) return resolved;
  }
  return normalized;
}

function cloneTextStyleValue(style: TextStyle | undefined): TextStyle {
  return style ? { ...style } : {};
}

function compactTextSegments(
  textSegments: TextSegment[],
  fallbackStyle: TextStyle | undefined,
): TextSegment[] {
  const compacted: TextSegment[] = [];
  textSegments.forEach((segment) => {
    const segmentText = String(segment.text || "");
    if (segmentText.length === 0) return;
    const segmentStyle = cloneTextStyleValue(segment.style);
    const previous = compacted[compacted.length - 1];
    if (previous && textStylesEqual(previous.style, segmentStyle)) {
      previous.text += segmentText;
      return;
    }
    compacted.push({
      text: segmentText,
      style: segmentStyle,
    });
  });

  if (compacted.length === 0) {
    return [
      {
        text: "",
        style: cloneTextStyleValue(fallbackStyle),
      },
    ];
  }
  return compacted;
}

// ---------------------------------------------------------------------------
// textStylesEqual
// ---------------------------------------------------------------------------
describe("textStylesEqual", () => {
  it("should return true for two undefined styles", () => {
    expect(textStylesEqual(undefined, undefined)).toBe(true);
  });

  it("should return true for identical styles", () => {
    const a: TextStyle = { fontFamily: "Arial", fontSize: 16, bold: true };
    const b: TextStyle = { fontFamily: "Arial", fontSize: 16, bold: true };
    expect(textStylesEqual(a, b)).toBe(true);
  });

  it("should return false when fontFamily differs", () => {
    const a: TextStyle = { fontFamily: "Arial" };
    const b: TextStyle = { fontFamily: "Calibri" };
    expect(textStylesEqual(a, b)).toBe(false);
  });

  it("should return false when fontSize differs", () => {
    const a: TextStyle = { fontSize: 12 };
    const b: TextStyle = { fontSize: 14 };
    expect(textStylesEqual(a, b)).toBe(false);
  });

  it("should return false when bold differs", () => {
    const a: TextStyle = { bold: true };
    const b: TextStyle = { bold: false };
    expect(textStylesEqual(a, b)).toBe(false);
  });

  it("should ignore non-compared keys like textCaps", () => {
    const a: TextStyle = { fontFamily: "Arial", textCaps: "all" };
    const b: TextStyle = { fontFamily: "Arial", textCaps: "small" };
    expect(textStylesEqual(a, b)).toBe(true);
  });

  it("should compare color correctly", () => {
    const a: TextStyle = { color: "#FF0000" };
    const b: TextStyle = { color: "#00FF00" };
    expect(textStylesEqual(a, b)).toBe(false);
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
      hasMixedTextStyles([{ text: "hello", style: { bold: true } }]),
    ).toBe(false);
  });

  it("should return false when all segments have same style", () => {
    expect(
      hasMixedTextStyles([
        { text: "a", style: { bold: true } },
        { text: "b", style: { bold: true } },
      ]),
    ).toBe(false);
  });

  it("should return true when segments have different styles", () => {
    expect(
      hasMixedTextStyles([
        { text: "a", style: { bold: true } },
        { text: "b", style: { bold: false } },
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// areTextSegmentsUniform
// ---------------------------------------------------------------------------
describe("areTextSegmentsUniform", () => {
  it("should return true for undefined segments", () => {
    expect(areTextSegmentsUniform(undefined)).toBe(true);
  });

  it("should return true for single segment", () => {
    expect(
      areTextSegmentsUniform([{ text: "hi", style: {} }]),
    ).toBe(true);
  });

  it("should return true when styles are uniform", () => {
    expect(
      areTextSegmentsUniform([
        { text: "a", style: { italic: true } },
        { text: "b", style: { italic: true } },
      ]),
    ).toBe(true);
  });

  it("should return false when styles differ", () => {
    expect(
      areTextSegmentsUniform([
        { text: "a", style: { italic: true } },
        { text: "b", style: { italic: false } },
      ]),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseBooleanAttr
// ---------------------------------------------------------------------------
describe("parseBooleanAttr", () => {
  it("should return true for '1'", () => {
    expect(parseBooleanAttr("1")).toBe(true);
  });

  it("should return true for 'true'", () => {
    expect(parseBooleanAttr("true")).toBe(true);
  });

  it("should return true for 'TRUE' (case insensitive)", () => {
    expect(parseBooleanAttr("TRUE")).toBe(true);
  });

  it("should return false for '0'", () => {
    expect(parseBooleanAttr("0")).toBe(false);
  });

  it("should return false for 'false'", () => {
    expect(parseBooleanAttr("false")).toBe(false);
  });

  it("should return false for undefined/null", () => {
    expect(parseBooleanAttr(undefined)).toBe(false);
    expect(parseBooleanAttr(null)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(parseBooleanAttr("")).toBe(false);
  });

  it("should handle whitespace", () => {
    expect(parseBooleanAttr("  1  ")).toBe(true);
    expect(parseBooleanAttr("  true  ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseOptionalBooleanAttr
// ---------------------------------------------------------------------------
describe("parseOptionalBooleanAttr", () => {
  it("should return undefined for undefined", () => {
    expect(parseOptionalBooleanAttr(undefined)).toBeUndefined();
  });

  it("should return undefined for null", () => {
    expect(parseOptionalBooleanAttr(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(parseOptionalBooleanAttr("")).toBeUndefined();
  });

  it("should return true for '1'", () => {
    expect(parseOptionalBooleanAttr("1")).toBe(true);
  });

  it("should return false for '0'", () => {
    expect(parseOptionalBooleanAttr("0")).toBe(false);
  });

  it("should return true for 'true'", () => {
    expect(parseOptionalBooleanAttr("true")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeTypefaceToken
// ---------------------------------------------------------------------------
describe("normalizeTypefaceToken", () => {
  it("should return trimmed value for non-empty string", () => {
    expect(normalizeTypefaceToken("  Arial  ")).toBe("Arial");
  });

  it("should return undefined for empty string", () => {
    expect(normalizeTypefaceToken("")).toBeUndefined();
  });

  it("should return undefined for whitespace-only string", () => {
    expect(normalizeTypefaceToken("   ")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveThemeTypeface
// ---------------------------------------------------------------------------
describe("resolveThemeTypeface", () => {
  const themeFontMap = {
    "mn-lt": "Calibri",
    "mj-lt": "Calibri Light",
    "mn-ea": "MS Gothic",
  };

  it("should return undefined for undefined typeface", () => {
    expect(resolveThemeTypeface(undefined, themeFontMap)).toBeUndefined();
  });

  it("should return undefined for empty typeface", () => {
    expect(resolveThemeTypeface("", themeFontMap)).toBeUndefined();
  });

  it("should resolve +mn-lt to Calibri from theme map", () => {
    expect(resolveThemeTypeface("+mn-lt", themeFontMap)).toBe("Calibri");
  });

  it("should resolve +mj-lt to Calibri Light from theme map", () => {
    expect(resolveThemeTypeface("+mj-lt", themeFontMap)).toBe(
      "Calibri Light",
    );
  });

  it("should return literal typeface if not a theme token", () => {
    expect(resolveThemeTypeface("Arial", themeFontMap)).toBe("Arial");
  });

  it("should return literal typeface starting with + but not in map", () => {
    expect(resolveThemeTypeface("+mn-cs", themeFontMap)).toBe("+mn-cs");
  });
});

// ---------------------------------------------------------------------------
// compactTextSegments
// ---------------------------------------------------------------------------
describe("compactTextSegments", () => {
  it("should return fallback segment for empty input", () => {
    const result = compactTextSegments([], { bold: true });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("");
    expect(result[0].style).toEqual({ bold: true });
  });

  it("should skip segments with empty text", () => {
    const result = compactTextSegments(
      [
        { text: "", style: { bold: true } },
        { text: "hello", style: { bold: true } },
      ],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("hello");
  });

  it("should merge adjacent segments with the same style", () => {
    const result = compactTextSegments(
      [
        { text: "Hello ", style: { bold: true } },
        { text: "World", style: { bold: true } },
      ],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello World");
  });

  it("should not merge segments with different styles", () => {
    const result = compactTextSegments(
      [
        { text: "Hello ", style: { bold: true } },
        { text: "World", style: { bold: false } },
      ],
      undefined,
    );
    expect(result).toHaveLength(2);
  });

  it("should merge three consecutive same-style segments", () => {
    const style: TextStyle = { fontSize: 16 };
    const result = compactTextSegments(
      [
        { text: "a", style },
        { text: "b", style },
        { text: "c", style },
      ],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abc");
  });

  it("should handle mixed merge/split correctly", () => {
    const result = compactTextSegments(
      [
        { text: "a", style: { bold: true } },
        { text: "b", style: { bold: true } },
        { text: "c", style: { italic: true } },
        { text: "d", style: { italic: true } },
      ],
      undefined,
    );
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("ab");
    expect(result[1].text).toBe("cd");
  });
});
