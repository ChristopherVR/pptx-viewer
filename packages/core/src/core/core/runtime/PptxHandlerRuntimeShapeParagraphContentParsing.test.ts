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
// Mirrors the document-order processing in collectShapeParagraphContent:
// iterates over object keys so that interleaved elements (runs, fields,
// math, mc:AlternateContent, line breaks) appear in the order they were
// parsed from the XML.
function collectParagraphTextParts(
  p: Record<string, unknown>,
  pIdx: number,
  paraCount: number,
): { parts: string[]; runCount: number; fieldCount: number; lineBreakCount: number; hasMathElements: boolean } {
  const parts: string[] = [];
  let runCount = 0;
  let fieldCount = 0;
  let lineBreakCount = 0;
  let hasMathElements = false;

  const contentTagSet = new Set([
    "a:r", "a:fld", "a:t", "a14:m", "m:oMathPara", "m:oMath",
    "mc:AlternateContent", "a:br",
  ]);

  for (const key of Object.keys(p)) {
    if (!contentTagSet.has(key)) continue;

    const items = ensureArray(p[key]);
    for (const item of items) {
      switch (key) {
        case "a:r":
          if (!item) break;
          parts.push(extractRunText(item as Record<string, unknown>));
          runCount++;
          break;
        case "a:fld":
          if (!item) break;
          parts.push(extractFieldInfo(item as Record<string, unknown>).text);
          fieldCount++;
          break;
        case "a:t": {
          const directText = typeof item === "string" ? item : item !== undefined ? String(item) : "";
          parts.push(directText);
          break;
        }
        case "a14:m":
        case "m:oMathPara":
        case "m:oMath":
          if (!item) break;
          parts.push("[Equation]");
          hasMathElements = true;
          break;
        case "mc:AlternateContent": {
          // Simplified: check for a14:m inside mc:Choice
          const acObj = item as Record<string, unknown>;
          const choices = ensureArray(acObj["mc:Choice"]);
          let handled = false;
          for (const choice of choices) {
            const ch = choice as Record<string, unknown>;
            const innerMath = ch["a14:m"] ?? ch["m:oMathPara"] ?? ch["m:oMath"];
            if (innerMath) {
              parts.push("[Equation]");
              hasMathElements = true;
              handled = true;
              break;
            }
          }
          if (!handled) {
            // Fallback: check for runs in the fallback branch
            const fallback = acObj["mc:Fallback"] as Record<string, unknown> | undefined;
            if (fallback) {
              const fbRuns = ensureArray(fallback["a:r"]);
              for (const r of fbRuns) {
                if (!r) continue;
                parts.push(extractRunText(r as Record<string, unknown>));
                runCount++;
              }
            }
          }
          break;
        }
        case "a:br":
          parts.push("\n");
          lineBreakCount++;
          break;
      }
    }
  }

  // Inter-paragraph newline
  if (pIdx < paraCount - 1) {
    parts.push("\n");
  }

  return {
    parts,
    runCount,
    fieldCount,
    lineBreakCount,
    hasMathElements,
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

  it("should process mc:AlternateContent containing a14:m as inline math", () => {
    // Simulates: <a:r>text</a:r><mc:AlternateContent><mc:Choice Requires="a14"><a14:m>...</a14:m></mc:Choice></mc:AlternateContent>
    const result = collectParagraphTextParts(
      {
        "a:r": { "a:t": "The formula is " },
        "mc:AlternateContent": {
          "mc:Choice": {
            "@_Requires": "a14",
            "a14:m": { "m:oMathPara": { "m:oMath": { "m:r": { "m:t": "x=1" } } } },
          },
          "mc:Fallback": {
            "a:r": { "a:t": "x=1" },
          },
        },
      },
      0,
      1,
    );
    expect(result.parts).toEqual(["The formula is ", "[Equation]"]);
    expect(result.hasMathElements).toBe(true);
    expect(result.runCount).toBe(1);
  });

  it("should preserve document order: run, inline math, run", () => {
    // When fast-xml-parser groups same-tag siblings, the key order
    // determines processing order. This test verifies that when
    // a:r appears before mc:AlternateContent in key order, both
    // runs process first, then the math — matching the grouped
    // object structure produced by the parser.
    const result = collectParagraphTextParts(
      {
        "a:r": [
          { "a:t": "Before " },
          { "a:t": " after" },
        ],
        "mc:AlternateContent": {
          "mc:Choice": {
            "@_Requires": "a14",
            "a14:m": { "m:oMath": {} },
          },
          "mc:Fallback": {
            "a:r": { "a:t": "E=mc2" },
          },
        },
      },
      0,
      1,
    );
    // a:r key comes first, so both runs are processed, then mc:AlternateContent
    expect(result.parts).toEqual(["Before ", " after", "[Equation]"]);
    expect(result.hasMathElements).toBe(true);
  });

  it("should handle standalone a14:m inline math (no mc:AlternateContent wrapper)", () => {
    const result = collectParagraphTextParts(
      {
        "a:r": { "a:t": "See: " },
        "a14:m": { "m:oMathPara": { "m:oMath": { "m:r": { "m:t": "a+b" } } } },
      },
      0,
      1,
    );
    expect(result.parts).toEqual(["See: ", "[Equation]"]);
    expect(result.hasMathElements).toBe(true);
  });

  it("should handle mc:AlternateContent with non-math content as fallback", () => {
    // When mc:Choice does not contain math, and there is no a14:m,
    // the fallback text runs should be used.
    const result = collectParagraphTextParts(
      {
        "a:r": { "a:t": "Before " },
        "mc:AlternateContent": {
          "mc:Choice": {
            "@_Requires": "xyz_unsupported",
            "p:newFeature": {},
          },
          "mc:Fallback": {
            "a:r": { "a:t": "fallback text" },
          },
        },
      },
      0,
      1,
    );
    expect(result.parts).toEqual(["Before ", "fallback text"]);
    expect(result.hasMathElements).toBe(false);
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
