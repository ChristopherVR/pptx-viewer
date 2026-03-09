/**
 * Spec-accurate tests for a:pPr (paragraph properties) parsing.
 *
 * Validates parsing of alignment, RTL, indent levels, margins, line spacing,
 * space before/after, bullet types (buChar, buAutoNum with various types,
 * buFont, buClr, buSzPct, buSzPts), and tab stops from XML structures
 * matching ECMA-376 Part 1, Section 21.1.2.2.7 (CT_TextParagraphProperties).
 */
import { describe, it, expect } from "vitest";
import {
  parseAlignmentAttr,
  parseParagraphSpacingPx,
  parseLineSpacingMultiplier,
  parseLineSpacingExactPt,
  parseParagraphMargins,
  parseParagraphRtl,
  parseParagraphLevel,
  parseTabStops,
  parseParagraphExtraAttributes,
  parseBulletInfo,
} from "./paragraph-properties-parser";
import type { XmlObject } from "../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// parseAlignmentAttr — 5+ alignment types
// ---------------------------------------------------------------------------

describe("parseAlignmentAttr", () => {
  it("returns undefined for absent alignment", () => {
    expect(parseAlignmentAttr(undefined)).toBeUndefined();
  });

  it('maps "l" to "left"', () => {
    expect(parseAlignmentAttr("l")).toBe("left");
  });

  it('maps "ctr" to "center"', () => {
    expect(parseAlignmentAttr("ctr")).toBe("center");
  });

  it('maps "r" to "right"', () => {
    expect(parseAlignmentAttr("r")).toBe("right");
  });

  it('maps "just" to "justify"', () => {
    expect(parseAlignmentAttr("just")).toBe("justify");
  });

  it('maps "dist" to "dist"', () => {
    expect(parseAlignmentAttr("dist")).toBe("dist");
  });

  it('maps "thaiDist" to "thaiDist"', () => {
    expect(parseAlignmentAttr("thaiDist")).toBe("thaiDist");
  });

  it('maps "justLow" to "justLow"', () => {
    expect(parseAlignmentAttr("justLow")).toBe("justLow");
  });

  it("returns undefined for unknown alignment", () => {
    expect(parseAlignmentAttr("xyz")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseParagraphRtl
// ---------------------------------------------------------------------------

describe("parseParagraphRtl", () => {
  it("returns undefined for absent pPr", () => {
    expect(parseParagraphRtl(undefined)).toBeUndefined();
  });

  it('parses @_rtl="1" as true', () => {
    expect(parseParagraphRtl({ "@_rtl": "1" })).toBe(true);
  });

  it('parses @_rtl="0" as false', () => {
    expect(parseParagraphRtl({ "@_rtl": "0" })).toBe(false);
  });

  it("returns undefined when @_rtl absent", () => {
    expect(parseParagraphRtl({})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseParagraphLevel — 0 to 8
// ---------------------------------------------------------------------------

describe("parseParagraphLevel", () => {
  it("returns 0 for absent pPr", () => {
    expect(parseParagraphLevel(undefined)).toBe(0);
  });

  it("returns 0 when @_lvl is absent", () => {
    expect(parseParagraphLevel({})).toBe(0);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])(
    "parses @_lvl=%d correctly",
    (level) => {
      expect(parseParagraphLevel({ "@_lvl": String(level) })).toBe(level);
    },
  );

  it("clamps negative levels to 0", () => {
    expect(parseParagraphLevel({ "@_lvl": "-1" })).toBe(0);
  });

  it("clamps levels above 8 to 8", () => {
    expect(parseParagraphLevel({ "@_lvl": "10" })).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// parseParagraphMargins — marL, marR, indent in EMU
// ---------------------------------------------------------------------------

describe("parseParagraphMargins", () => {
  it("returns empty for absent pPr", () => {
    expect(parseParagraphMargins(undefined)).toEqual({});
  });

  it("parses @_marL in EMU to px", () => {
    // 914400 EMU = 96px (1 inch)
    const result = parseParagraphMargins({ "@_marL": "914400" });
    expect(result.paragraphMarginLeft).toBeCloseTo(914400 / EMU_PER_PX, 2);
  });

  it("parses @_marR in EMU to px", () => {
    const result = parseParagraphMargins({ "@_marR": "457200" });
    expect(result.paragraphMarginRight).toBeCloseTo(457200 / EMU_PER_PX, 2);
  });

  it("parses positive @_indent (first-line indent)", () => {
    // 457200 EMU = 0.5 inch = 48px
    const result = parseParagraphMargins({ "@_indent": "457200" });
    expect(result.paragraphIndent).toBeCloseTo(457200 / EMU_PER_PX, 2);
  });

  it("parses negative @_indent (hanging indent)", () => {
    // -342900 EMU = hanging indent
    const result = parseParagraphMargins({ "@_indent": "-342900" });
    expect(result.paragraphIndent).toBeCloseTo(-342900 / EMU_PER_PX, 2);
  });

  it("parses all three together", () => {
    const result = parseParagraphMargins({
      "@_marL": "914400",
      "@_marR": "457200",
      "@_indent": "-342900",
    });
    expect(result.paragraphMarginLeft).toBeCloseTo(914400 / EMU_PER_PX, 2);
    expect(result.paragraphMarginRight).toBeCloseTo(457200 / EMU_PER_PX, 2);
    expect(result.paragraphIndent).toBeCloseTo(-342900 / EMU_PER_PX, 2);
  });
});

// ---------------------------------------------------------------------------
// parseParagraphSpacingPx — a:spcBef / a:spcAft
// ---------------------------------------------------------------------------

describe("parseParagraphSpacingPx", () => {
  it("returns undefined for absent node", () => {
    expect(parseParagraphSpacingPx(undefined)).toBeUndefined();
  });

  it("parses a:spcPts val=1200 (12pt) to px", () => {
    // XML: <a:spcBef><a:spcPts val="1200"/></a:spcBef>
    const node: XmlObject = {
      "a:spcPts": { "@_val": "1200" },
    };
    const px = parseParagraphSpacingPx(node);
    // 1200 hundredths / 100 = 12pt, 12pt * (96/72) = 16px
    expect(px).toBeCloseTo(16, 1);
  });

  it("parses a:spcPts val=600 (6pt) to px", () => {
    const node: XmlObject = {
      "a:spcPts": { "@_val": "600" },
    };
    const px = parseParagraphSpacingPx(node);
    // 6pt * (96/72) = 8px
    expect(px).toBeCloseTo(8, 1);
  });

  it("returns undefined when a:spcPts is absent", () => {
    const node: XmlObject = {};
    expect(parseParagraphSpacingPx(node)).toBeUndefined();
  });

  it("returns undefined for non-numeric val", () => {
    const node: XmlObject = {
      "a:spcPts": { "@_val": "abc" },
    };
    expect(parseParagraphSpacingPx(node)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseLineSpacingMultiplier — a:lnSpc > a:spcPct
// ---------------------------------------------------------------------------

describe("parseLineSpacingMultiplier", () => {
  it("returns undefined for absent node", () => {
    expect(parseLineSpacingMultiplier(undefined)).toBeUndefined();
  });

  it("parses val=100000 (100%) to multiplier 1.0", () => {
    // XML: <a:lnSpc><a:spcPct val="100000"/></a:lnSpc>
    const node: XmlObject = {
      "a:spcPct": { "@_val": "100000" },
    };
    expect(parseLineSpacingMultiplier(node)).toBeCloseTo(1.0, 5);
  });

  it("parses val=150000 (150%) to multiplier 1.5", () => {
    const node: XmlObject = {
      "a:spcPct": { "@_val": "150000" },
    };
    expect(parseLineSpacingMultiplier(node)).toBeCloseTo(1.5, 5);
  });

  it("parses val=200000 (200%) to multiplier 2.0", () => {
    const node: XmlObject = {
      "a:spcPct": { "@_val": "200000" },
    };
    expect(parseLineSpacingMultiplier(node)).toBeCloseTo(2.0, 5);
  });

  it("clamps extremely small values to 0.1", () => {
    const node: XmlObject = {
      "a:spcPct": { "@_val": "1000" },
    };
    // 1000 / 100000 = 0.01, clamped to 0.1
    expect(parseLineSpacingMultiplier(node)).toBeCloseTo(0.1, 5);
  });

  it("clamps extremely large values to 5", () => {
    const node: XmlObject = {
      "a:spcPct": { "@_val": "1000000" },
    };
    // 1000000 / 100000 = 10, clamped to 5
    expect(parseLineSpacingMultiplier(node)).toBeCloseTo(5, 5);
  });
});

// ---------------------------------------------------------------------------
// parseLineSpacingExactPt — a:lnSpc > a:spcPts
// ---------------------------------------------------------------------------

describe("parseLineSpacingExactPt", () => {
  it("returns undefined for absent node", () => {
    expect(parseLineSpacingExactPt(undefined)).toBeUndefined();
  });

  it("parses val=1200 (12pt exact) to 12", () => {
    // XML: <a:lnSpc><a:spcPts val="1200"/></a:lnSpc>
    const node: XmlObject = {
      "a:spcPts": { "@_val": "1200" },
    };
    expect(parseLineSpacingExactPt(node)).toBe(12);
  });

  it("parses val=2400 (24pt exact) to 24", () => {
    const node: XmlObject = {
      "a:spcPts": { "@_val": "2400" },
    };
    expect(parseLineSpacingExactPt(node)).toBe(24);
  });

  it("returns undefined for val=0", () => {
    const node: XmlObject = {
      "a:spcPts": { "@_val": "0" },
    };
    expect(parseLineSpacingExactPt(node)).toBeUndefined();
  });

  it("returns undefined for negative val", () => {
    const node: XmlObject = {
      "a:spcPts": { "@_val": "-100" },
    };
    expect(parseLineSpacingExactPt(node)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseTabStops — a:tabLst > a:tab
// ---------------------------------------------------------------------------

describe("parseTabStops", () => {
  it("returns undefined for absent pPr", () => {
    expect(parseTabStops(undefined)).toBeUndefined();
  });

  it("returns undefined when a:tabLst is absent", () => {
    expect(parseTabStops({})).toBeUndefined();
  });

  it("parses a single tab stop", () => {
    // XML: <a:pPr><a:tabLst><a:tab pos="914400" algn="l"/></a:tabLst></a:pPr>
    const pPr: XmlObject = {
      "a:tabLst": {
        "a:tab": { "@_pos": "914400", "@_algn": "l" },
      },
    };
    const tabs = parseTabStops(pPr);
    expect(tabs).toHaveLength(1);
    expect(tabs![0].position).toBeCloseTo(914400 / EMU_PER_PX, 2);
    expect(tabs![0].align).toBe("l");
  });

  it("parses multiple tab stops with different alignments", () => {
    const pPr: XmlObject = {
      "a:tabLst": {
        "a:tab": [
          { "@_pos": "914400", "@_algn": "l" },
          { "@_pos": "1828800", "@_algn": "ctr" },
          { "@_pos": "2743200", "@_algn": "r" },
          { "@_pos": "3657600", "@_algn": "dec" },
        ],
      },
    };
    const tabs = parseTabStops(pPr);
    expect(tabs).toHaveLength(4);
    expect(tabs![0].align).toBe("l");
    expect(tabs![1].align).toBe("ctr");
    expect(tabs![2].align).toBe("r");
    expect(tabs![3].align).toBe("dec");
  });

  it("parses tab with leader", () => {
    const pPr: XmlObject = {
      "a:tabLst": {
        "a:tab": { "@_pos": "914400", "@_algn": "r", "@_leader": "dot" },
      },
    };
    const tabs = parseTabStops(pPr);
    expect(tabs).toHaveLength(1);
    expect(tabs![0].leader).toBe("dot");
  });

  it("parses tab leader types: dot, hyphen, underscore", () => {
    const pPr: XmlObject = {
      "a:tabLst": {
        "a:tab": [
          { "@_pos": "100000", "@_algn": "l", "@_leader": "dot" },
          { "@_pos": "200000", "@_algn": "l", "@_leader": "hyphen" },
          { "@_pos": "300000", "@_algn": "l", "@_leader": "underscore" },
        ],
      },
    };
    const tabs = parseTabStops(pPr);
    expect(tabs).toHaveLength(3);
    expect(tabs![0].leader).toBe("dot");
    expect(tabs![1].leader).toBe("hyphen");
    expect(tabs![2].leader).toBe("underscore");
  });

  it("defaults alignment to 'l' when absent", () => {
    const pPr: XmlObject = {
      "a:tabLst": {
        "a:tab": { "@_pos": "914400" },
      },
    };
    const tabs = parseTabStops(pPr);
    expect(tabs![0].align).toBe("l");
  });
});

// ---------------------------------------------------------------------------
// parseParagraphExtraAttributes
// ---------------------------------------------------------------------------

describe("parseParagraphExtraAttributes", () => {
  it("returns empty for absent pPr", () => {
    expect(parseParagraphExtraAttributes(undefined)).toEqual({});
  });

  it("parses @_defTabSz in EMU to px", () => {
    // 914400 EMU = 96px (1 inch)
    const result = parseParagraphExtraAttributes({ "@_defTabSz": "914400" });
    expect(result.defaultTabSize).toBeCloseTo(914400 / EMU_PER_PX, 2);
  });

  it('parses @_eaLnBrk="1" as eaLineBreak=true', () => {
    const result = parseParagraphExtraAttributes({ "@_eaLnBrk": "1" });
    expect(result.eaLineBreak).toBe(true);
  });

  it('parses @_latinLnBrk="0" as latinLineBreak=false', () => {
    const result = parseParagraphExtraAttributes({ "@_latinLnBrk": "0" });
    expect(result.latinLineBreak).toBe(false);
  });

  it('parses @_fontAlgn="base" as fontAlignment', () => {
    const result = parseParagraphExtraAttributes({ "@_fontAlgn": "base" });
    expect(result.fontAlignment).toBe("base");
  });

  it('parses @_hangingPunct="1" as hangingPunctuation=true', () => {
    const result = parseParagraphExtraAttributes({ "@_hangingPunct": "1" });
    expect(result.hangingPunctuation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseBulletInfo — a:buChar, a:buAutoNum, a:buNone
// ---------------------------------------------------------------------------

describe("parseBulletInfo", () => {
  it("returns null for absent pPr", () => {
    expect(parseBulletInfo(undefined)).toBeNull();
  });

  it("returns { none: true } for a:buNone", () => {
    const pPr: XmlObject = { "a:buNone": {} };
    expect(parseBulletInfo(pPr)).toEqual({ none: true });
  });

  // ── Character bullets ────────────────────────────────────────────────────

  it("parses a:buChar with bullet character", () => {
    // XML: <a:pPr><a:buChar char="\u2022"/></a:pPr>
    const pPr: XmlObject = {
      "a:buChar": { "@_char": "\u2022" },
    };
    const info = parseBulletInfo(pPr);
    expect(info).not.toBeNull();
    expect(info!.char).toBe("\u2022");
  });

  it("parses a:buChar with dash character", () => {
    const pPr: XmlObject = {
      "a:buChar": { "@_char": "-" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.char).toBe("-");
  });

  it("parses a:buChar with arrow character", () => {
    const pPr: XmlObject = {
      "a:buChar": { "@_char": "\u00BB" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.char).toBe("\u00BB");
  });

  it("parses a:buChar with buFont", () => {
    // XML:
    // <a:pPr>
    //   <a:buFont typeface="Wingdings"/>
    //   <a:buChar char="q"/>
    // </a:pPr>
    const pPr: XmlObject = {
      "a:buFont": { "@_typeface": "Wingdings" },
      "a:buChar": { "@_char": "q" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.char).toBe("q");
    expect(info!.fontFamily).toBe("Wingdings");
  });

  it("parses a:buChar with buSzPct", () => {
    // XML:
    // <a:pPr>
    //   <a:buSzPct val="100000"/>
    //   <a:buChar char="\u2022"/>
    // </a:pPr>
    const pPr: XmlObject = {
      "a:buSzPct": { "@_val": "100000" },
      "a:buChar": { "@_char": "\u2022" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.sizePercent).toBe(100); // 100000 / 1000 = 100
  });

  it("parses a:buChar with buSzPts", () => {
    const pPr: XmlObject = {
      "a:buSzPts": { "@_val": "1800" },
      "a:buChar": { "@_char": "\u2022" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.sizePts).toBe(18); // 1800 / 100 = 18pt
  });

  it("parses a:buChar with buClr (srgbClr)", () => {
    // XML:
    // <a:pPr>
    //   <a:buClr><a:srgbClr val="00B0F0"/></a:buClr>
    //   <a:buChar char="\u2022"/>
    // </a:pPr>
    const pPr: XmlObject = {
      "a:buClr": {
        "a:srgbClr": { "@_val": "00B0F0" },
      },
      "a:buChar": { "@_char": "\u2022" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.color).toBe("00B0F0");
  });

  it("parses a:buChar with all styling properties", () => {
    const pPr: XmlObject = {
      "a:buFont": { "@_typeface": "Symbol" },
      "a:buSzPct": { "@_val": "75000" },
      "a:buClr": { "a:srgbClr": { "@_val": "FF0000" } },
      "a:buChar": { "@_char": "\u2713" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.char).toBe("\u2713");
    expect(info!.fontFamily).toBe("Symbol");
    expect(info!.sizePercent).toBe(75);
    expect(info!.color).toBe("FF0000");
  });

  // ── Auto-numbered bullets ────────────────────────────────────────────────

  it("parses a:buAutoNum with arabicPeriod", () => {
    // XML: <a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr>
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "arabicPeriod" },
    };
    const info = parseBulletInfo(pPr, 0);
    expect(info!.autoNumType).toBe("arabicPeriod");
    expect(info!.autoNumStartAt).toBe(1);
    expect(info!.paragraphIndex).toBe(0);
  });

  it("parses a:buAutoNum with alphaUcPeriod and startAt", () => {
    // XML: <a:pPr><a:buAutoNum type="alphaUcPeriod" startAt="2"/></a:pPr>
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "alphaUcPeriod", "@_startAt": "2" },
    };
    const info = parseBulletInfo(pPr, 3);
    expect(info!.autoNumType).toBe("alphaUcPeriod");
    expect(info!.autoNumStartAt).toBe(2);
    expect(info!.paragraphIndex).toBe(3);
  });

  it("parses a:buAutoNum with romanUcPeriod", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "romanUcPeriod" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("romanUcPeriod");
  });

  it("parses a:buAutoNum with romanLcPeriod", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "romanLcPeriod" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("romanLcPeriod");
  });

  it("parses a:buAutoNum with alphaLcPeriod", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "alphaLcPeriod" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("alphaLcPeriod");
  });

  it("parses a:buAutoNum with arabicParenR", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "arabicParenR" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("arabicParenR");
  });

  it("parses a:buAutoNum with arabicParenBoth", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "arabicParenBoth" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("arabicParenBoth");
  });

  it("parses a:buAutoNum with alphaLcParenR", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "alphaLcParenR" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("alphaLcParenR");
  });

  it("parses a:buAutoNum with alphaUcParenR", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "alphaUcParenR" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumType).toBe("alphaUcParenR");
  });

  it("parses a:buAutoNum with styling (font, color, size)", () => {
    const pPr: XmlObject = {
      "a:buFont": { "@_typeface": "Arial" },
      "a:buClr": { "a:srgbClr": { "@_val": "333333" } },
      "a:buSzPct": { "@_val": "80000" },
      "a:buAutoNum": { "@_type": "arabicPeriod", "@_startAt": "5" },
    };
    const info = parseBulletInfo(pPr, 2);
    expect(info!.autoNumType).toBe("arabicPeriod");
    expect(info!.autoNumStartAt).toBe(5);
    expect(info!.fontFamily).toBe("Arial");
    expect(info!.color).toBe("333333");
    expect(info!.sizePercent).toBe(80);
    expect(info!.paragraphIndex).toBe(2);
  });

  it("defaults autoNumStartAt to 1 when absent", () => {
    const pPr: XmlObject = {
      "a:buAutoNum": { "@_type": "arabicPeriod" },
    };
    const info = parseBulletInfo(pPr);
    expect(info!.autoNumStartAt).toBe(1);
  });

  // ── No bullet found ──────────────────────────────────────────────────────

  it("returns null when no bullet elements present", () => {
    const pPr: XmlObject = { "@_algn": "l" };
    expect(parseBulletInfo(pPr)).toBeNull();
  });
});
