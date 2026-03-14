import { describe, it, expect } from "vitest";
import type { TextStyle, XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeTextRunStyleExtraction.extractTextRunStyle
// Pure re-implementation of the style extraction logic for direct testing.
// Stubs parseColor, resolveThemeTypeface, etc.
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

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

/**
 * Simplified extractTextRunStyle focusing on numeric parsing, boolean flags,
 * and structural extraction. Stubs are used for color/theme resolution.
 */
function extractTextRunStyle(
  runProperties: XmlObject | undefined,
  align: TextStyle["align"],
): TextStyle {
  const style: TextStyle = { align };
  if (!runProperties) return style;

  // Font size
  if (runProperties["@_sz"]) {
    const points = parseInt(runProperties["@_sz"]) / 100;
    style.fontSize = points * (96 / 72);
  }

  // Bold
  if (runProperties["@_b"] !== undefined) {
    style.bold = runProperties["@_b"] === "1";
  }

  // Italic
  if (runProperties["@_i"] !== undefined) {
    style.italic = runProperties["@_i"] === "1";
  }

  // Underline
  if (runProperties["@_u"] !== undefined) {
    const underlineToken = String(runProperties["@_u"] || "")
      .trim()
      .toLowerCase();
    style.underline =
      underlineToken.length > 0 &&
      underlineToken !== "none" &&
      underlineToken !== "0" &&
      underlineToken !== "false";
    if (style.underline) {
      const rawU = String(runProperties["@_u"] || "").trim();
      if (rawU.length > 0 && rawU !== "none") {
        style.underlineStyle = rawU as TextStyle["underlineStyle"];
      }
    }
  }

  // Underline colour
  const uFill = runProperties["a:uFill"] as XmlObject | undefined;
  const uLn = runProperties["a:uLn"] as XmlObject | undefined;
  const underlineColorSource = uFill?.["a:solidFill"] || uLn?.["a:solidFill"];
  if (underlineColorSource) {
    const srgb = (underlineColorSource as XmlObject)["a:srgbClr"] as XmlObject | undefined;
    if (srgb?.["@_val"]) {
      style.underlineColor = `#${srgb["@_val"]}`;
    }
  }

  // Strikethrough
  if (runProperties["@_strike"] !== undefined) {
    const strikeToken = String(runProperties["@_strike"] || "")
      .trim()
      .toLowerCase();
    style.strikethrough =
      strikeToken.length > 0 &&
      strikeToken !== "nostrike" &&
      strikeToken !== "none" &&
      strikeToken !== "0" &&
      strikeToken !== "false";
    if (style.strikethrough) {
      style.strikeType =
        strikeToken === "dblstrike" ? "dblStrike" : "sngStrike";
    }
  }

  // Text outline
  const textLn = runProperties["a:ln"] as XmlObject | undefined;
  if (textLn) {
    const textOutlineW = Number.parseInt(String(textLn["@_w"] || ""), 10);
    if (Number.isFinite(textOutlineW) && textOutlineW > 0) {
      style.textOutlineWidth = textOutlineW / EMU_PER_PX;
    }
  }

  // No fill
  if (runProperties["a:noFill"] !== undefined) {
    style.textFillNone = true;
  }

  // Baseline (super/subscript)
  if (runProperties["@_baseline"] !== undefined) {
    const baselineVal = Number.parseInt(
      String(runProperties["@_baseline"]),
      10,
    );
    if (Number.isFinite(baselineVal) && baselineVal !== 0) {
      style.baseline = baselineVal;
    }
  }

  // Character spacing
  if (runProperties["@_spc"] !== undefined) {
    const spcVal = Number.parseInt(String(runProperties["@_spc"]), 10);
    if (Number.isFinite(spcVal)) {
      style.characterSpacing = spcVal;
    }
  }

  // Kerning
  if (runProperties["@_kern"] !== undefined) {
    const kernVal = Number.parseInt(String(runProperties["@_kern"]), 10);
    if (Number.isFinite(kernVal)) {
      style.kerning = kernVal;
    }
  }

  // Text caps
  const capAttr = String(runProperties["@_cap"] || "")
    .trim()
    .toLowerCase();
  if (capAttr === "all" || capAttr === "small") {
    style.textCaps = capAttr;
  }

  // Symbol font
  const symNode = runProperties["a:sym"];
  if (symNode) {
    const symTypeface = normalizeTypefaceToken(
      typeof symNode["@_typeface"] === "string" ? symNode["@_typeface"] : "",
    );
    if (symTypeface) {
      style.symbolFont = symTypeface;
    }
  }

  // Language
  const langAttr = String(runProperties["@_lang"] || "").trim();
  if (langAttr) {
    style.language = langAttr;
  }

  // Font family from latin typeface
  const latin = runProperties["a:latin"];
  if (latin?.["@_typeface"] && typeof latin["@_typeface"] === "string") {
    const tf = latin["@_typeface"].trim();
    if (tf.length > 0 && !tf.startsWith("+")) {
      style.fontFamily = tf;
    }
  }

  // Metadata attributes
  const normalizeH = parseOptionalBooleanAttr(runProperties["@_normalizeH"]);
  if (normalizeH !== undefined) style.normalizeHeight = normalizeH;
  const noProof = parseOptionalBooleanAttr(runProperties["@_noProof"]);
  if (noProof !== undefined) style.noProof = noProof;
  const dirty = parseOptionalBooleanAttr(runProperties["@_dirty"]);
  if (dirty !== undefined) style.dirty = dirty;
  const err = parseOptionalBooleanAttr(runProperties["@_err"]);
  if (err !== undefined) style.spellingError = err;
  const smtClean = parseOptionalBooleanAttr(runProperties["@_smtClean"]);
  if (smtClean !== undefined) style.smartTagClean = smtClean;
  const bmk = String(runProperties["@_bmk"] || "").trim();
  if (bmk) style.bookmark = bmk;

  // RTL
  const runRtl = parseOptionalBooleanAttr(runProperties["@_rtl"]);
  if (runRtl !== undefined) {
    style.rtl = runRtl;
  }

  return style;
}

// ---------------------------------------------------------------------------
// extractTextRunStyle
// ---------------------------------------------------------------------------
describe("extractTextRunStyle", () => {
  it("should return default style with only align when properties are undefined", () => {
    const result = extractTextRunStyle(undefined, "left");
    expect(result).toEqual({ align: "left" });
  });

  it("should return default style with only align when properties are empty", () => {
    const result = extractTextRunStyle({}, "center");
    expect(result).toEqual({ align: "center" });
  });

  describe("font size", () => {
    it("should convert hundredths of a point to pixels (96/72 factor)", () => {
      // sz = 1200 = 12pt => 12 * (96/72) = 16px
      const result = extractTextRunStyle({ "@_sz": "1200" }, "left");
      expect(result.fontSize).toBe(16);
    });

    it("should handle 24pt correctly", () => {
      // sz = 2400 = 24pt => 24 * (96/72) = 32px
      const result = extractTextRunStyle({ "@_sz": "2400" }, "left");
      expect(result.fontSize).toBe(32);
    });

    it("should handle small font sizes", () => {
      // sz = 800 = 8pt => 8 * (96/72) = 10.667
      const result = extractTextRunStyle({ "@_sz": "800" }, "left");
      expect(result.fontSize).toBeCloseTo(10.667, 2);
    });
  });

  describe("bold and italic", () => {
    it("should set bold to true for @_b='1'", () => {
      const result = extractTextRunStyle({ "@_b": "1" }, "left");
      expect(result.bold).toBe(true);
    });

    it("should set bold to false for @_b='0'", () => {
      const result = extractTextRunStyle({ "@_b": "0" }, "left");
      expect(result.bold).toBe(false);
    });

    it("should set italic to true for @_i='1'", () => {
      const result = extractTextRunStyle({ "@_i": "1" }, "left");
      expect(result.italic).toBe(true);
    });

    it("should set italic to false for @_i='0'", () => {
      const result = extractTextRunStyle({ "@_i": "0" }, "left");
      expect(result.italic).toBe(false);
    });
  });

  describe("underline", () => {
    it("should set underline to true for 'sng'", () => {
      const result = extractTextRunStyle({ "@_u": "sng" }, "left");
      expect(result.underline).toBe(true);
      expect(result.underlineStyle).toBe("sng");
    });

    it("should set underline to true for 'dbl'", () => {
      const result = extractTextRunStyle({ "@_u": "dbl" }, "left");
      expect(result.underline).toBe(true);
      expect(result.underlineStyle).toBe("dbl");
    });

    it("should set underline to false for 'none'", () => {
      const result = extractTextRunStyle({ "@_u": "none" }, "left");
      expect(result.underline).toBe(false);
    });

    it("should set underline to false for '0'", () => {
      const result = extractTextRunStyle({ "@_u": "0" }, "left");
      expect(result.underline).toBe(false);
    });

    it("should set underline to false for 'false'", () => {
      const result = extractTextRunStyle({ "@_u": "false" }, "left");
      expect(result.underline).toBe(false);
    });

    it("should parse underline color from a:uFill", () => {
      const result = extractTextRunStyle(
        {
          "@_u": "sng",
          "a:uFill": {
            "a:solidFill": {
              "a:srgbClr": { "@_val": "FF0000" },
            },
          },
        },
        "left",
      );
      expect(result.underlineColor).toBe("#FF0000");
    });

    it("should parse underline color from a:uLn as fallback", () => {
      const result = extractTextRunStyle(
        {
          "@_u": "sng",
          "a:uLn": {
            "a:solidFill": {
              "a:srgbClr": { "@_val": "00FF00" },
            },
          },
        },
        "left",
      );
      expect(result.underlineColor).toBe("#00FF00");
    });
  });

  describe("strikethrough", () => {
    it("should set strikethrough and strikeType for sngStrike", () => {
      const result = extractTextRunStyle(
        { "@_strike": "sngStrike" },
        "left",
      );
      expect(result.strikethrough).toBe(true);
      expect(result.strikeType).toBe("sngStrike");
    });

    it("should set strikeType to dblStrike for dblStrike", () => {
      const result = extractTextRunStyle(
        { "@_strike": "dblStrike" },
        "left",
      );
      expect(result.strikethrough).toBe(true);
      expect(result.strikeType).toBe("dblStrike");
    });

    it("should not set strikethrough for noStrike", () => {
      const result = extractTextRunStyle(
        { "@_strike": "noStrike" },
        "left",
      );
      expect(result.strikethrough).toBe(false);
    });
  });

  describe("text outline", () => {
    it("should parse outline width from a:ln @_w", () => {
      const result = extractTextRunStyle(
        { "a:ln": { "@_w": "19050" } }, // 2px
        "left",
      );
      expect(result.textOutlineWidth).toBeCloseTo(2);
    });

    it("should not set outline width for zero width", () => {
      const result = extractTextRunStyle(
        { "a:ln": { "@_w": "0" } },
        "left",
      );
      expect(result.textOutlineWidth).toBeUndefined();
    });
  });

  describe("text fill none", () => {
    it("should set textFillNone when a:noFill is present", () => {
      const result = extractTextRunStyle({ "a:noFill": {} }, "left");
      expect(result.textFillNone).toBe(true);
    });
  });

  describe("baseline (super/subscript)", () => {
    it("should set positive baseline for superscript", () => {
      const result = extractTextRunStyle(
        { "@_baseline": "30000" },
        "left",
      );
      expect(result.baseline).toBe(30000);
    });

    it("should set negative baseline for subscript", () => {
      const result = extractTextRunStyle(
        { "@_baseline": "-25000" },
        "left",
      );
      expect(result.baseline).toBe(-25000);
    });

    it("should not set baseline for zero value", () => {
      const result = extractTextRunStyle(
        { "@_baseline": "0" },
        "left",
      );
      expect(result.baseline).toBeUndefined();
    });
  });

  describe("character spacing", () => {
    it("should parse character spacing", () => {
      const result = extractTextRunStyle(
        { "@_spc": "300" },
        "left",
      );
      expect(result.characterSpacing).toBe(300);
    });

    it("should parse negative character spacing", () => {
      const result = extractTextRunStyle(
        { "@_spc": "-100" },
        "left",
      );
      expect(result.characterSpacing).toBe(-100);
    });
  });

  describe("kerning", () => {
    it("should parse kerning threshold", () => {
      const result = extractTextRunStyle(
        { "@_kern": "1200" },
        "left",
      );
      expect(result.kerning).toBe(1200);
    });
  });

  describe("text caps", () => {
    it("should set textCaps to 'all' for @_cap='all'", () => {
      const result = extractTextRunStyle({ "@_cap": "all" }, "left");
      expect(result.textCaps).toBe("all");
    });

    it("should set textCaps to 'small' for @_cap='small'", () => {
      const result = extractTextRunStyle({ "@_cap": "small" }, "left");
      expect(result.textCaps).toBe("small");
    });

    it("should not set textCaps for other values", () => {
      const result = extractTextRunStyle({ "@_cap": "none" }, "left");
      expect(result.textCaps).toBeUndefined();
    });
  });

  describe("symbol font", () => {
    it("should parse symbol font typeface", () => {
      const result = extractTextRunStyle(
        { "a:sym": { "@_typeface": "Wingdings" } },
        "left",
      );
      expect(result.symbolFont).toBe("Wingdings");
    });

    it("should skip empty symbol font typeface", () => {
      const result = extractTextRunStyle(
        { "a:sym": { "@_typeface": "  " } },
        "left",
      );
      expect(result.symbolFont).toBeUndefined();
    });
  });

  describe("language", () => {
    it("should parse language attribute", () => {
      const result = extractTextRunStyle(
        { "@_lang": "en-US" },
        "left",
      );
      expect(result.language).toBe("en-US");
    });
  });

  describe("font family", () => {
    it("should parse latin typeface", () => {
      const result = extractTextRunStyle(
        { "a:latin": { "@_typeface": "Calibri" } },
        "left",
      );
      expect(result.fontFamily).toBe("Calibri");
    });
  });

  describe("metadata attributes", () => {
    it("should parse noProof flag", () => {
      const result = extractTextRunStyle(
        { "@_noProof": "1" },
        "left",
      );
      expect(result.noProof).toBe(true);
    });

    it("should parse dirty flag", () => {
      const result = extractTextRunStyle(
        { "@_dirty": "0" },
        "left",
      );
      expect(result.dirty).toBe(false);
    });

    it("should parse spelling error flag", () => {
      const result = extractTextRunStyle(
        { "@_err": "1" },
        "left",
      );
      expect(result.spellingError).toBe(true);
    });

    it("should parse smartTagClean flag", () => {
      const result = extractTextRunStyle(
        { "@_smtClean": "true" },
        "left",
      );
      expect(result.smartTagClean).toBe(true);
    });

    it("should parse bookmark attribute", () => {
      const result = extractTextRunStyle(
        { "@_bmk": "bookmark1" },
        "left",
      );
      expect(result.bookmark).toBe("bookmark1");
    });

    it("should parse normalizeHeight flag", () => {
      const result = extractTextRunStyle(
        { "@_normalizeH": "1" },
        "left",
      );
      expect(result.normalizeHeight).toBe(true);
    });
  });

  describe("RTL", () => {
    it("should parse rtl=1 as true", () => {
      const result = extractTextRunStyle(
        { "@_rtl": "1" },
        "left",
      );
      expect(result.rtl).toBe(true);
    });

    it("should parse rtl=0 as false", () => {
      const result = extractTextRunStyle(
        { "@_rtl": "0" },
        "left",
      );
      expect(result.rtl).toBe(false);
    });
  });
});
