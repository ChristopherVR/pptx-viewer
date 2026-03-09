/**
 * Spec-accurate tests for a:rPr (text run properties) parsing.
 *
 * Validates that all scalar attributes and child elements of the DrawingML
 * `a:rPr` element are parsed correctly from fast-xml-parser object structures
 * matching ECMA-376 Part 1, Section 21.1.2.3.9 (CT_TextCharacterProperties).
 *
 * Uses the `@_` prefix convention for attributes and nested objects for
 * child elements, matching fast-xml-parser output.
 */
import { describe, it, expect } from "vitest";
import {
  parseRunPropertyAttributes,
  parseRunFontElements,
  parseRunUnderlineColor,
  parseRunTextOutline,
  parseRunHyperlink,
  parseRunSolidFillColor,
  parseRunSymbolFont,
} from "./text-run-properties-parser";
import type { XmlObject } from "../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// parseRunPropertyAttributes — scalar attributes
// ---------------------------------------------------------------------------

describe("parseRunPropertyAttributes — scalar attributes", () => {
  it("returns empty style for undefined input", () => {
    const style = parseRunPropertyAttributes(undefined);
    expect(style).toEqual({});
  });

  it("returns empty style for empty object", () => {
    const style = parseRunPropertyAttributes({});
    expect(style).toEqual({});
  });

  // ── Font size ────────────────────────────────────────────────────────────

  it("parses @_sz=2400 (24pt) to fontSize in px", () => {
    // XML: <a:rPr sz="2400"/>
    const rPr: XmlObject = { "@_sz": "2400" };
    const style = parseRunPropertyAttributes(rPr);
    // 2400 hundredths / 100 = 24pt, 24pt * (96/72) = 32px
    expect(style.fontSize).toBeCloseTo(32, 1);
  });

  it("parses @_sz=1000 (10pt) to fontSize in px", () => {
    const rPr: XmlObject = { "@_sz": "1000" };
    const style = parseRunPropertyAttributes(rPr);
    // 10pt * (96/72) ≈ 13.33px
    expect(style.fontSize).toBeCloseTo(13.333, 2);
  });

  it("parses @_sz=4400 (44pt) for large heading", () => {
    const rPr: XmlObject = { "@_sz": "4400" };
    const style = parseRunPropertyAttributes(rPr);
    // 44pt * (96/72) ≈ 58.67px
    expect(style.fontSize).toBeCloseTo(58.667, 1);
  });

  // ── Bold / Italic ────────────────────────────────────────────────────────

  it('parses @_b="1" as bold=true', () => {
    const rPr: XmlObject = { "@_b": "1" };
    const style = parseRunPropertyAttributes(rPr);
    expect(style.bold).toBe(true);
  });

  it('parses @_b="0" as bold=false', () => {
    const rPr: XmlObject = { "@_b": "0" };
    const style = parseRunPropertyAttributes(rPr);
    expect(style.bold).toBe(false);
  });

  it('parses @_i="1" as italic=true', () => {
    const rPr: XmlObject = { "@_i": "1" };
    const style = parseRunPropertyAttributes(rPr);
    expect(style.italic).toBe(true);
  });

  it('parses @_i="0" as italic=false', () => {
    const rPr: XmlObject = { "@_i": "0" };
    const style = parseRunPropertyAttributes(rPr);
    expect(style.italic).toBe(false);
  });

  // ── Underline (all 18 types per ST_TextUnderlineType) ────────────────────

  it('parses @_u="sng" as underline=true, underlineStyle="sng"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "sng" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("sng");
  });

  it('parses @_u="dbl" as underline=true, underlineStyle="dbl"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dbl" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dbl");
  });

  it('parses @_u="heavy" as underline=true, underlineStyle="heavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "heavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("heavy");
  });

  it('parses @_u="dotted"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dotted" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dotted");
  });

  it('parses @_u="dottedHeavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dottedHeavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dottedHeavy");
  });

  it('parses @_u="dash"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dash" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dash");
  });

  it('parses @_u="dashHeavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dashHeavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dashHeavy");
  });

  it('parses @_u="dashLong"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dashLong" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dashLong");
  });

  it('parses @_u="dashLongHeavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dashLongHeavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dashLongHeavy");
  });

  it('parses @_u="dotDash"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dotDash" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dotDash");
  });

  it('parses @_u="dotDashHeavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dotDashHeavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dotDashHeavy");
  });

  it('parses @_u="dotDotDash"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "dotDotDash" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dotDotDash");
  });

  it('parses @_u="dotDotDashHeavy"', () => {
    const style = parseRunPropertyAttributes({
      "@_u": "dotDotDashHeavy",
    });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("dotDotDashHeavy");
  });

  it('parses @_u="wavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "wavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("wavy");
  });

  it('parses @_u="wavyHeavy"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "wavyHeavy" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("wavyHeavy");
  });

  it('parses @_u="wavyDbl"', () => {
    const style = parseRunPropertyAttributes({ "@_u": "wavyDbl" });
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("wavyDbl");
  });

  it('parses @_u="none" as underline=false', () => {
    const style = parseRunPropertyAttributes({ "@_u": "none" });
    expect(style.underline).toBe(false);
    expect(style.underlineStyle).toBeUndefined();
  });

  it("does not set underline when @_u is absent", () => {
    const style = parseRunPropertyAttributes({});
    expect(style.underline).toBeUndefined();
    expect(style.underlineStyle).toBeUndefined();
  });

  // ── Strikethrough ────────────────────────────────────────────────────────

  it('parses @_strike="sngStrike" as strikethrough=true, strikeType="sngStrike"', () => {
    const style = parseRunPropertyAttributes({ "@_strike": "sngStrike" });
    expect(style.strikethrough).toBe(true);
    expect(style.strikeType).toBe("sngStrike");
  });

  it('parses @_strike="dblStrike" as strikethrough=true, strikeType="dblStrike"', () => {
    const style = parseRunPropertyAttributes({ "@_strike": "dblStrike" });
    expect(style.strikethrough).toBe(true);
    expect(style.strikeType).toBe("dblStrike");
  });

  it('parses @_strike="noStrike" as strikethrough=false', () => {
    const style = parseRunPropertyAttributes({ "@_strike": "noStrike" });
    expect(style.strikethrough).toBe(false);
    expect(style.strikeType).toBeUndefined();
  });

  // ── Text caps ────────────────────────────────────────────────────────────

  it('parses @_cap="all" as textCaps="all"', () => {
    const style = parseRunPropertyAttributes({ "@_cap": "all" });
    expect(style.textCaps).toBe("all");
  });

  it('parses @_cap="small" as textCaps="small"', () => {
    const style = parseRunPropertyAttributes({ "@_cap": "small" });
    expect(style.textCaps).toBe("small");
  });

  it('parses @_cap="none" — does not set textCaps', () => {
    const style = parseRunPropertyAttributes({ "@_cap": "none" });
    expect(style.textCaps).toBeUndefined();
  });

  // ── Baseline (superscript/subscript) ─────────────────────────────────────

  it("parses @_baseline=30000 for superscript", () => {
    const style = parseRunPropertyAttributes({ "@_baseline": "30000" });
    expect(style.baseline).toBe(30000);
  });

  it("parses @_baseline=-25000 for subscript", () => {
    const style = parseRunPropertyAttributes({ "@_baseline": "-25000" });
    expect(style.baseline).toBe(-25000);
  });

  it("does not set baseline when value is 0", () => {
    const style = parseRunPropertyAttributes({ "@_baseline": "0" });
    expect(style.baseline).toBeUndefined();
  });

  // ── Character spacing ────────────────────────────────────────────────────

  it("parses @_spc=300 (3pt spacing)", () => {
    const style = parseRunPropertyAttributes({ "@_spc": "300" });
    expect(style.characterSpacing).toBe(300);
  });

  it("parses @_spc=-100 (negative/condensed spacing)", () => {
    const style = parseRunPropertyAttributes({ "@_spc": "-100" });
    expect(style.characterSpacing).toBe(-100);
  });

  it("parses @_spc=0 (zero spacing)", () => {
    const style = parseRunPropertyAttributes({ "@_spc": "0" });
    expect(style.characterSpacing).toBe(0);
  });

  // ── Kerning ──────────────────────────────────────────────────────────────

  it("parses @_kern=1200 (12pt kerning threshold)", () => {
    const style = parseRunPropertyAttributes({ "@_kern": "1200" });
    expect(style.kerning).toBe(1200);
  });

  it("parses @_kern=0 (no kerning)", () => {
    const style = parseRunPropertyAttributes({ "@_kern": "0" });
    expect(style.kerning).toBe(0);
  });

  // ── Language ─────────────────────────────────────────────────────────────

  it('parses @_lang="en-US"', () => {
    const style = parseRunPropertyAttributes({ "@_lang": "en-US" });
    expect(style.language).toBe("en-US");
  });

  it('parses @_lang="ja-JP"', () => {
    const style = parseRunPropertyAttributes({ "@_lang": "ja-JP" });
    expect(style.language).toBe("ja-JP");
  });

  // ── RTL ──────────────────────────────────────────────────────────────────

  it('parses @_rtl="1" as rtl=true', () => {
    const style = parseRunPropertyAttributes({ "@_rtl": "1" });
    expect(style.rtl).toBe(true);
  });

  it('parses @_rtl="0" as rtl=false', () => {
    const style = parseRunPropertyAttributes({ "@_rtl": "0" });
    expect(style.rtl).toBe(false);
  });

  // ── Metadata flags ──────────────────────────────────────────────────────

  it('parses @_dirty="1" as dirty=true', () => {
    const style = parseRunPropertyAttributes({ "@_dirty": "1" });
    expect(style.dirty).toBe(true);
  });

  it('parses @_noProof="1" as noProof=true', () => {
    const style = parseRunPropertyAttributes({ "@_noProof": "1" });
    expect(style.noProof).toBe(true);
  });

  it('parses @_smtClean="1" as smartTagClean=true', () => {
    const style = parseRunPropertyAttributes({ "@_smtClean": "1" });
    expect(style.smartTagClean).toBe(true);
  });

  it('parses @_err="1" as spellingError=true', () => {
    const style = parseRunPropertyAttributes({ "@_err": "1" });
    expect(style.spellingError).toBe(true);
  });

  it('parses @_normalizeH="1" as normalizeHeight=true', () => {
    const style = parseRunPropertyAttributes({ "@_normalizeH": "1" });
    expect(style.normalizeHeight).toBe(true);
  });

  it('parses @_bmk="slide3" as bookmark', () => {
    const style = parseRunPropertyAttributes({ "@_bmk": "slide3" });
    expect(style.bookmark).toBe("slide3");
  });

  // ── Combined attributes ──────────────────────────────────────────────────

  it("parses a fully-populated a:rPr with all attributes", () => {
    // XML: <a:rPr lang="en-US" sz="2400" b="1" i="1" u="sng"
    //        strike="dblStrike" cap="all" baseline="30000"
    //        kern="1200" spc="300"/>
    const rPr: XmlObject = {
      "@_lang": "en-US",
      "@_sz": "2400",
      "@_b": "1",
      "@_i": "1",
      "@_u": "sng",
      "@_strike": "dblStrike",
      "@_cap": "all",
      "@_baseline": "30000",
      "@_kern": "1200",
      "@_spc": "300",
    };
    const style = parseRunPropertyAttributes(rPr);
    expect(style.language).toBe("en-US");
    expect(style.fontSize).toBeCloseTo(32, 1);
    expect(style.bold).toBe(true);
    expect(style.italic).toBe(true);
    expect(style.underline).toBe(true);
    expect(style.underlineStyle).toBe("sng");
    expect(style.strikethrough).toBe(true);
    expect(style.strikeType).toBe("dblStrike");
    expect(style.textCaps).toBe("all");
    expect(style.baseline).toBe(30000);
    expect(style.kerning).toBe(1200);
    expect(style.characterSpacing).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// parseRunFontElements — a:latin, a:ea, a:cs
// ---------------------------------------------------------------------------

describe("parseRunFontElements — font child elements", () => {
  it("returns empty for undefined input", () => {
    expect(parseRunFontElements(undefined)).toEqual({});
  });

  it("parses a:latin typeface", () => {
    // XML: <a:rPr><a:latin typeface="Arial Black" pitchFamily="34"/></a:rPr>
    const rPr: XmlObject = {
      "a:latin": { "@_typeface": "Arial Black", "@_pitchFamily": "34" },
    };
    const result = parseRunFontElements(rPr);
    expect(result.fontFamily).toBe("Arial Black");
  });

  it("parses a:ea typeface as eastAsiaFont", () => {
    // XML: <a:rPr><a:ea typeface="MS Gothic"/></a:rPr>
    const rPr: XmlObject = {
      "a:ea": { "@_typeface": "MS Gothic" },
    };
    const result = parseRunFontElements(rPr);
    expect(result.fontFamily).toBe("MS Gothic");
    expect(result.eastAsiaFont).toBe("MS Gothic");
  });

  it("parses a:cs typeface as complexScriptFont", () => {
    // XML: <a:rPr><a:cs typeface="Arial"/></a:rPr>
    const rPr: XmlObject = {
      "a:cs": { "@_typeface": "Arial" },
    };
    const result = parseRunFontElements(rPr);
    expect(result.fontFamily).toBe("Arial");
    expect(result.complexScriptFont).toBe("Arial");
  });

  it("a:latin takes priority over a:ea and a:cs for fontFamily", () => {
    const rPr: XmlObject = {
      "a:latin": { "@_typeface": "Calibri" },
      "a:ea": { "@_typeface": "MS Gothic" },
      "a:cs": { "@_typeface": "Arial" },
    };
    const result = parseRunFontElements(rPr);
    expect(result.fontFamily).toBe("Calibri");
    expect(result.eastAsiaFont).toBe("MS Gothic");
    expect(result.complexScriptFont).toBe("Arial");
  });

  it("ignores empty/whitespace-only typeface", () => {
    const rPr: XmlObject = {
      "a:latin": { "@_typeface": "  " },
    };
    const result = parseRunFontElements(rPr);
    expect(result.fontFamily).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseRunUnderlineColor — a:uFill, a:uLn
// ---------------------------------------------------------------------------

describe("parseRunUnderlineColor", () => {
  it("returns undefined for absent uFill/uLn", () => {
    expect(parseRunUnderlineColor({})).toBeUndefined();
  });

  it("extracts color from a:uFill > a:solidFill > a:srgbClr", () => {
    // XML:
    // <a:rPr>
    //   <a:uFill><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:uFill>
    // </a:rPr>
    const rPr: XmlObject = {
      "a:uFill": {
        "a:solidFill": {
          "a:srgbClr": { "@_val": "FF0000" },
        },
      },
    };
    expect(parseRunUnderlineColor(rPr)).toBe("FF0000");
  });

  it("extracts color from a:uLn > a:solidFill > a:srgbClr", () => {
    const rPr: XmlObject = {
      "a:uLn": {
        "a:solidFill": {
          "a:srgbClr": { "@_val": "00B0F0" },
        },
      },
    };
    expect(parseRunUnderlineColor(rPr)).toBe("00B0F0");
  });
});

// ---------------------------------------------------------------------------
// parseRunTextOutline — a:ln
// ---------------------------------------------------------------------------

describe("parseRunTextOutline", () => {
  it("returns empty for absent a:ln", () => {
    expect(parseRunTextOutline({})).toEqual({});
  });

  it("parses outline width from a:ln/@_w (EMU to px)", () => {
    // 12700 EMU = 12700/9525 ≈ 1.333px
    const rPr: XmlObject = {
      "a:ln": { "@_w": "12700" },
    };
    const result = parseRunTextOutline(rPr);
    expect(result.textOutlineWidth).toBeCloseTo(12700 / EMU_PER_PX, 3);
  });

  it("parses outline width and color together", () => {
    const rPr: XmlObject = {
      "a:ln": {
        "@_w": "19050",
        "a:solidFill": {
          "a:srgbClr": { "@_val": "333333" },
        },
      },
    };
    const result = parseRunTextOutline(rPr);
    expect(result.textOutlineWidth).toBeCloseTo(19050 / EMU_PER_PX, 3);
    expect(result.textOutlineColor).toBe("333333");
  });
});

// ---------------------------------------------------------------------------
// parseRunHyperlink — a:hlinkClick
// ---------------------------------------------------------------------------

describe("parseRunHyperlink", () => {
  it("returns empty for absent a:hlinkClick", () => {
    expect(parseRunHyperlink({})).toEqual({});
  });

  it("parses @_r:id relationship ID", () => {
    // XML: <a:rPr><a:hlinkClick r:id="rId1"/></a:rPr>
    const rPr: XmlObject = {
      "a:hlinkClick": { "@_r:id": "rId1" },
    };
    const result = parseRunHyperlink(rPr);
    expect(result.hyperlinkRId).toBe("rId1");
  });

  it("parses tooltip attribute", () => {
    const rPr: XmlObject = {
      "a:hlinkClick": {
        "@_r:id": "rId2",
        "@_tooltip": "Click here",
      },
    };
    const result = parseRunHyperlink(rPr);
    expect(result.hyperlinkRId).toBe("rId2");
    expect(result.hyperlinkTooltip).toBe("Click here");
  });

  it("parses action attribute", () => {
    const rPr: XmlObject = {
      "a:hlinkClick": {
        "@_r:id": "rId3",
        "@_action": "ppaction://hlinksldjump",
      },
    };
    const result = parseRunHyperlink(rPr);
    expect(result.hyperlinkAction).toBe("ppaction://hlinksldjump");
  });

  it("parses all hyperlink attributes", () => {
    const rPr: XmlObject = {
      "a:hlinkClick": {
        "@_r:id": "rId1",
        "@_tooltip": "Go here",
        "@_action": "ppaction://hlinksldjump",
        "@_invalidUrl": "bad://link",
        "@_tgtFrame": "_blank",
        "@_history": "1",
        "@_highlightClick": "1",
        "@_endSnd": "0",
      },
    };
    const result = parseRunHyperlink(rPr);
    expect(result.hyperlinkRId).toBe("rId1");
    expect(result.hyperlinkTooltip).toBe("Go here");
    expect(result.hyperlinkAction).toBe("ppaction://hlinksldjump");
    expect(result.hyperlinkInvalidUrl).toBe("bad://link");
    expect(result.hyperlinkTargetFrame).toBe("_blank");
    expect(result.hyperlinkHistory).toBe(true);
    expect(result.hyperlinkHighlightClick).toBe(true);
    expect(result.hyperlinkEndSound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRunSolidFillColor — a:solidFill
// ---------------------------------------------------------------------------

describe("parseRunSolidFillColor", () => {
  it("returns undefined for absent solidFill", () => {
    expect(parseRunSolidFillColor({})).toBeUndefined();
  });

  it("parses a:solidFill > a:srgbClr color", () => {
    // XML: <a:rPr><a:solidFill><a:srgbClr val="FF5733"/></a:solidFill></a:rPr>
    const rPr: XmlObject = {
      "a:solidFill": {
        "a:srgbClr": { "@_val": "FF5733" },
      },
    };
    expect(parseRunSolidFillColor(rPr)).toBe("FF5733");
  });
});

// ---------------------------------------------------------------------------
// parseRunSymbolFont — a:sym
// ---------------------------------------------------------------------------

describe("parseRunSymbolFont", () => {
  it("returns undefined for absent a:sym", () => {
    expect(parseRunSymbolFont({})).toBeUndefined();
  });

  it("parses a:sym typeface", () => {
    // XML: <a:rPr><a:sym typeface="Wingdings"/></a:rPr>
    const rPr: XmlObject = {
      "a:sym": { "@_typeface": "Wingdings" },
    };
    expect(parseRunSymbolFont(rPr)).toBe("Wingdings");
  });

  it("returns undefined for empty typeface", () => {
    const rPr: XmlObject = {
      "a:sym": { "@_typeface": "" },
    };
    expect(parseRunSymbolFont(rPr)).toBeUndefined();
  });
});
