import { describe, it, expect } from "vitest";
import {
  extractCellText,
  parseParagraphAlignment,
  extractTableCellStyle,
} from "./table-cell-style";

// ── extractCellText ───────────────────────────────────────────────────

describe("extractCellText", () => {
  it("returns empty string for undefined input", () => {
    expect(extractCellText(undefined)).toBe("");
  });

  it("returns empty string when no txBody", () => {
    expect(extractCellText({})).toBe("");
  });

  it("returns empty string when no paragraphs", () => {
    expect(extractCellText({ "a:txBody": {} })).toBe("");
  });

  it("extracts text from a single run in a single paragraph", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": { "a:t": "Hello" },
        },
      },
    };
    expect(extractCellText(cellXml)).toBe("Hello");
  });

  it("concatenates text from multiple runs", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": [{ "a:t": "Hello " }, { "a:t": "World" }],
        },
      },
    };
    expect(extractCellText(cellXml)).toBe("Hello World");
  });

  it("joins multiple paragraphs with newlines", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": [
          { "a:r": { "a:t": "Line 1" } },
          { "a:r": { "a:t": "Line 2" } },
        ],
      },
    };
    expect(extractCellText(cellXml)).toBe("Line 1\nLine 2");
  });

  it("extracts text from field elements", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:fld": { "a:t": "Field Value" },
        },
      },
    };
    expect(extractCellText(cellXml)).toBe("Field Value");
  });

  it("combines runs and fields", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": { "a:t": "Text " },
          "a:fld": { "a:t": "123" },
        },
      },
    };
    expect(extractCellText(cellXml)).toBe("Text 123");
  });

  it("converts non-string text values to string", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": { "a:t": 42 },
        },
      },
    };
    expect(extractCellText(cellXml)).toBe("42");
  });

  it("handles empty paragraphs gracefully", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": [
          { "a:r": { "a:t": "First" } },
          {}, // Empty paragraph
          { "a:r": { "a:t": "Third" } },
        ],
      },
    };
    expect(extractCellText(cellXml)).toBe("First\n\nThird");
  });
});

// ── parseParagraphAlignment ───────────────────────────────────────────

describe("parseParagraphAlignment", () => {
  it('returns "center" for "ctr"', () => {
    expect(parseParagraphAlignment("ctr")).toBe("center");
  });

  it('returns "center" for "CTR" (case-insensitive)', () => {
    expect(parseParagraphAlignment("CTR")).toBe("center");
  });

  it('returns "right" for "r"', () => {
    expect(parseParagraphAlignment("r")).toBe("right");
  });

  it('returns "justify" for "just"', () => {
    expect(parseParagraphAlignment("just")).toBe("justify");
  });

  it('returns "justify" for "justify"', () => {
    expect(parseParagraphAlignment("justify")).toBe("justify");
  });

  it('returns "left" for empty string', () => {
    expect(parseParagraphAlignment("")).toBe("left");
  });

  it('returns "left" for undefined', () => {
    expect(parseParagraphAlignment(undefined)).toBe("left");
  });

  it('returns "left" for unknown value', () => {
    expect(parseParagraphAlignment("unknown")).toBe("left");
  });

  it('returns "left" for "l"', () => {
    expect(parseParagraphAlignment("l")).toBe("left");
  });
});

// ── extractTableCellStyle ─────────────────────────────────────────────

describe("extractTableCellStyle", () => {
  it("returns fallback style when cell has no body", () => {
    const fallback = { fontSize: 12, color: "black" };
    const result = extractTableCellStyle({}, fallback);
    expect(result.fontSize).toBe(12);
    expect(result.color).toBe("black");
  });

  it("extracts font size from run properties", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_sz": "2400" }, // 24pt → 24 * (96/72) = 32px
            "a:t": "Text",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontSize).toBeCloseTo(32, 0);
  });

  it("extracts bold from run properties", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_b": "1" },
            "a:t": "Bold",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontWeight).toBe(700);
  });

  it("extracts non-bold from run properties", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_b": "0" },
            "a:t": "Normal",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontWeight).toBe(400);
  });

  it("extracts italic from run properties", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_i": "1" },
            "a:t": "Italic",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontStyle).toBe("italic");
  });

  it("extracts underline from run properties", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_u": "sng" },
            "a:t": "Underline",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.textDecorationLine).toBe("underline");
  });

  it("extracts font family from Latin typeface", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {
              "a:latin": { "@_typeface": "Arial" },
            },
            "a:t": "Text",
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontFamily).toBe("Arial");
  });

  it("extracts paragraph alignment", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:pPr": { "@_algn": "ctr" },
          "a:r": { "a:t": "Centered" },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.textAlign).toBe("center");
  });

  it("extracts cell background from solid fill", () => {
    const cellXml = {
      "a:tcPr": {
        "a:solidFill": {
          "a:srgbClr": { "@_val": "FF5733" },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.backgroundColor).toContain("FF5733");
  });

  it("extracts cell padding from margins", () => {
    const cellXml = {
      "a:tcPr": {
        "@_marL": "91440", // ~7px
        "@_marR": "91440",
        "@_marT": "45720", // ~4px
        "@_marB": "45720",
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.paddingLeft).toBeDefined();
    expect(result.paddingRight).toBeDefined();
    expect(result.paddingTop).toBeDefined();
    expect(result.paddingBottom).toBeDefined();
  });

  it("extracts vertical alignment from anchor attribute", () => {
    const cellXml = {
      "a:tcPr": { "@_anchor": "ctr" },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.verticalAlign).toBe("middle");
  });

  it('maps anchor "b" to bottom vertical alignment', () => {
    const cellXml = {
      "a:tcPr": { "@_anchor": "b" },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.verticalAlign).toBe("bottom");
  });

  it('maps anchor "t" to top vertical alignment', () => {
    const cellXml = {
      "a:tcPr": { "@_anchor": "t" },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.verticalAlign).toBe("top");
  });

  it("extracts vertical writing mode", () => {
    const cellXml = {
      "a:tcPr": { "@_vert": "vert" },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.writingMode).toBe("vertical-rl");
  });

  it("extracts vert270 writing mode", () => {
    const cellXml = {
      "a:tcPr": { "@_vert": "vert270" },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.writingMode).toBe("vertical-lr");
  });

  it("falls back to defRPr when no run properties exist", () => {
    const cellXml = {
      "a:txBody": {
        "a:p": {
          "a:pPr": {
            "a:defRPr": { "@_sz": "1800" }, // 18pt → 24px
          },
        },
      },
    };
    const result = extractTableCellStyle(cellXml, {});
    expect(result.fontSize).toBeCloseTo(24, 0);
  });
});
