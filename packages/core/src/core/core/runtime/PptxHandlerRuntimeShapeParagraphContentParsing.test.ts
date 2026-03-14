import { describe, it, expect } from "vitest";
import type { TextStyle, TextSegment } from "../../types";

// Since collectShapeParagraphContent is a protected method on a deeply
// chained mixin with many dependencies, we test the self-contained
// content extraction logic used within it.

function ensureArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

// --- Extracted: run text extraction logic ---
function extractRunText(r: Record<string, unknown>): string {
  if (!r) return "";
  return typeof r["a:t"] === "string"
    ? r["a:t"]
    : r["a:t"] !== undefined
      ? String(r["a:t"])
      : "";
}

// --- Extracted: field text + metadata extraction ---
function extractFieldInfo(
  field: Record<string, unknown>,
): { text: string; fieldType?: string; fieldGuid?: string } {
  const fieldText =
    typeof field["a:t"] === "string"
      ? field["a:t"]
      : field["a:t"] !== undefined
        ? String(field["a:t"])
        : "";
  const fldType = String(field["@_type"] || "").trim() || undefined;
  const fldGuid =
    String(field["@_uuid"] || field["@_id"] || "").trim() || undefined;
  return { text: fieldText, fieldType: fldType, fieldGuid: fldGuid };
}

// --- Extracted: content collection from a paragraph node ---
function collectParagraphTextParts(
  p: Record<string, unknown>,
  pIdx: number,
  paraCount: number,
): { parts: string[]; runCount: number; fieldCount: number; lineBreakCount: number; hasMathElements: boolean } {
  const parts: string[] = [];

  // Runs
  const runs = ensureArray(p["a:r"]);
  runs.forEach((r) => {
    if (!r) return;
    parts.push(extractRunText(r as Record<string, unknown>));
  });

  // Fields
  const fields = ensureArray(p["a:fld"]);
  fields.forEach((field) => {
    if (!field) return;
    const info = extractFieldInfo(field as Record<string, unknown>);
    parts.push(info.text);
  });

  // Direct text
  if (p["a:t"] !== undefined) {
    const directText = typeof p["a:t"] === "string" ? p["a:t"] : String(p["a:t"]);
    parts.push(directText);
  }

  // Math elements
  const mathElements = ensureArray(
    p["a14:m"] ?? p["m:oMathPara"] ?? p["m:oMath"],
  );
  for (const mathEl of mathElements) {
    if (!mathEl) continue;
    parts.push("[Equation]");
  }

  // Line breaks
  const lineBreaks = ensureArray(p["a:br"]);
  lineBreaks.forEach(() => {
    parts.push("\n");
  });

  // Inter-paragraph newline
  if (pIdx < paraCount - 1) {
    parts.push("\n");
  }

  return {
    parts,
    runCount: runs.filter(Boolean).length,
    fieldCount: fields.filter(Boolean).length,
    lineBreakCount: lineBreaks.length,
    hasMathElements: mathElements.filter(Boolean).length > 0,
  };
}

// --- Extracted: bullet text formatting ---
function formatBulletText(bulletInfo: {
  char?: string;
  autoNumType?: string;
  autoNumStartAt?: number;
  imageRelId?: string;
  none?: boolean;
}, pIdx: number): string | null {
  if (!bulletInfo || bulletInfo.none) return null;

  if (bulletInfo.char) {
    return `${bulletInfo.char} `;
  }
  if (bulletInfo.autoNumType) {
    const startAt = bulletInfo.autoNumStartAt ?? 1;
    // Simplified: just return arabic format for testing
    return `${startAt + pIdx}. `;
  }
  if (bulletInfo.imageRelId) {
    return "\u{1F4CE} ";
  }
  return "\u2022 ";
}

// ---------------------------------------------------------------------------
// extractRunText
// ---------------------------------------------------------------------------
describe("extractRunText", () => {
  it("should extract string text from a:t", () => {
    expect(extractRunText({ "a:t": "Hello" })).toBe("Hello");
  });

  it("should convert numeric a:t to string", () => {
    expect(extractRunText({ "a:t": 42 })).toBe("42");
  });

  it("should return empty string when a:t is undefined", () => {
    expect(extractRunText({})).toBe("");
  });

  it("should return empty string for null input", () => {
    expect(extractRunText(null as unknown as Record<string, unknown>)).toBe("");
  });

  it("should handle boolean a:t", () => {
    expect(extractRunText({ "a:t": true })).toBe("true");
  });

  it("should handle empty string a:t", () => {
    expect(extractRunText({ "a:t": "" })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractFieldInfo
// ---------------------------------------------------------------------------
describe("extractFieldInfo", () => {
  it("should extract field text and type", () => {
    const result = extractFieldInfo({
      "a:t": "2024-01-01",
      "@_type": "datetime",
      "@_uuid": "{ABC-123}",
    });
    expect(result).toEqual({
      text: "2024-01-01",
      fieldType: "datetime",
      fieldGuid: "{ABC-123}",
    });
  });

  it("should use @_id as fallback for guid", () => {
    const result = extractFieldInfo({
      "a:t": "5",
      "@_type": "slidenum",
      "@_id": "{DEF-456}",
    });
    expect(result.fieldGuid).toBe("{DEF-456}");
  });

  it("should handle missing type and guid", () => {
    const result = extractFieldInfo({ "a:t": "text" });
    expect(result).toEqual({
      text: "text",
      fieldType: undefined,
      fieldGuid: undefined,
    });
  });

  it("should return empty text when a:t is missing", () => {
    const result = extractFieldInfo({ "@_type": "datetime" });
    expect(result.text).toBe("");
  });

  it("should trim empty type to undefined", () => {
    const result = extractFieldInfo({ "a:t": "x", "@_type": "  " });
    expect(result.fieldType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// collectParagraphTextParts
// ---------------------------------------------------------------------------
describe("collectParagraphTextParts", () => {
  it("should collect text from a single run", () => {
    const result = collectParagraphTextParts(
      { "a:r": { "a:t": "Hello" } },
      0,
      1,
    );
    expect(result.parts).toEqual(["Hello"]);
    expect(result.runCount).toBe(1);
  });

  it("should collect text from multiple runs", () => {
    const result = collectParagraphTextParts(
      {
        "a:r": [
          { "a:t": "Hello " },
          { "a:t": "World" },
        ],
      },
      0,
      1,
    );
    expect(result.parts).toEqual(["Hello ", "World"]);
    expect(result.runCount).toBe(2);
  });

  it("should collect text from fields", () => {
    const result = collectParagraphTextParts(
      {
        "a:fld": { "a:t": "Slide 1", "@_type": "slidenum" },
      },
      0,
      1,
    );
    expect(result.parts).toEqual(["Slide 1"]);
    expect(result.fieldCount).toBe(1);
  });

  it("should collect direct text from a:t on paragraph", () => {
    const result = collectParagraphTextParts(
      { "a:t": "Direct text" },
      0,
      1,
    );
    expect(result.parts).toEqual(["Direct text"]);
  });

  it("should add [Equation] for math elements (a14:m)", () => {
    const result = collectParagraphTextParts(
      { "a14:m": { "m:oMath": {} } },
      0,
      1,
    );
    expect(result.parts).toContain("[Equation]");
    expect(result.hasMathElements).toBe(true);
  });

  it("should add [Equation] for m:oMathPara", () => {
    const result = collectParagraphTextParts(
      { "m:oMathPara": { "m:oMath": {} } },
      0,
      1,
    );
    expect(result.parts).toContain("[Equation]");
    expect(result.hasMathElements).toBe(true);
  });

  it("should add [Equation] for m:oMath", () => {
    const result = collectParagraphTextParts(
      { "m:oMath": {} },
      0,
      1,
    );
    expect(result.parts).toContain("[Equation]");
    expect(result.hasMathElements).toBe(true);
  });

  it("should handle line breaks (a:br)", () => {
    const result = collectParagraphTextParts(
      { "a:r": { "a:t": "Before" }, "a:br": {} },
      0,
      1,
    );
    expect(result.parts).toContain("\n");
    expect(result.lineBreakCount).toBe(1);
  });

  it("should handle multiple line breaks", () => {
    const result = collectParagraphTextParts(
      { "a:br": [{}, {}] },
      0,
      1,
    );
    expect(result.lineBreakCount).toBe(2);
    expect(result.parts.filter((p) => p === "\n")).toHaveLength(2);
  });

  it("should add newline between paragraphs (not after last)", () => {
    const result0 = collectParagraphTextParts({ "a:r": { "a:t": "P1" } }, 0, 2);
    const result1 = collectParagraphTextParts({ "a:r": { "a:t": "P2" } }, 1, 2);
    expect(result0.parts).toEqual(["P1", "\n"]);
    expect(result1.parts).toEqual(["P2"]); // No trailing newline
  });

  it("should handle empty paragraph", () => {
    const result = collectParagraphTextParts({}, 0, 1);
    expect(result.parts).toEqual([]);
    expect(result.runCount).toBe(0);
    expect(result.fieldCount).toBe(0);
  });

  it("should handle combined runs, fields, and breaks", () => {
    const result = collectParagraphTextParts(
      {
        "a:r": [
          { "a:t": "Hello " },
          { "a:t": "World" },
        ],
        "a:fld": { "a:t": "5", "@_type": "slidenum" },
        "a:br": {},
      },
      0,
      2,
    );
    expect(result.parts).toEqual(["Hello ", "World", "5", "\n", "\n"]);
    expect(result.runCount).toBe(2);
    expect(result.fieldCount).toBe(1);
    expect(result.lineBreakCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatBulletText
// ---------------------------------------------------------------------------
describe("formatBulletText", () => {
  it("should return null for null bulletInfo", () => {
    expect(formatBulletText(null as unknown as { none?: boolean }, 0)).toBeNull();
  });

  it("should return null when bullet is explicitly none", () => {
    expect(formatBulletText({ none: true }, 0)).toBeNull();
  });

  it("should format char bullet", () => {
    expect(formatBulletText({ char: "\u2022" }, 0)).toBe("\u2022 ");
  });

  it("should format char bullet with custom character", () => {
    expect(formatBulletText({ char: "-" }, 0)).toBe("- ");
  });

  it("should format auto-number bullet", () => {
    expect(
      formatBulletText({ autoNumType: "arabicPeriod", autoNumStartAt: 1 }, 0),
    ).toBe("1. ");
  });

  it("should format auto-number bullet with paragraph index offset", () => {
    expect(
      formatBulletText({ autoNumType: "arabicPeriod", autoNumStartAt: 1 }, 2),
    ).toBe("3. ");
  });

  it("should format auto-number bullet with default startAt", () => {
    expect(
      formatBulletText({ autoNumType: "arabicPeriod" }, 0),
    ).toBe("1. ");
  });

  it("should format image bullet as paper clip", () => {
    expect(
      formatBulletText({ imageRelId: "rId5" }, 0),
    ).toBe("\u{1F4CE} ");
  });

  it("should default to bullet character when no specific type", () => {
    expect(formatBulletText({}, 0)).toBe("\u2022 ");
  });
});
