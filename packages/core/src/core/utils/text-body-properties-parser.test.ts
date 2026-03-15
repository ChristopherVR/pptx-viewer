/**
 * Spec-accurate tests for a:bodyPr (text body properties) parsing.
 *
 * Validates parsing of anchor (vertical alignment), vert (text direction),
 * wrap mode, insets (lIns/tIns/rIns/bIns), column count & spacing, autofit
 * modes (spAutoFit, normAutofit with fontScale, noAutofit), and overflow modes
 * from XML structures matching ECMA-376 Part 1, Section 21.1.2.1.1
 * (CT_TextBodyProperties).
 */
import { describe, it, expect } from "vitest";
import {
  parseBodyAnchor,
  parseBodyTextDirection,
  parseBodyColumnCount,
  parseBodyInsets,
  parseBodyWrap,
  parseBodyAutofit,
  parseBodyColumnSpacing,
  parseBodyHOverflow,
  parseBodyVertOverflow,
} from "./text-body-properties-parser";
import type { XmlObject } from "../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// parseBodyAnchor — anchor types: t, ctr, b, just, dist
// ---------------------------------------------------------------------------

describe("parseBodyAnchor — vertical alignment", () => {
  it("returns undefined for absent/empty value", () => {
    expect(parseBodyAnchor(undefined)).toBeUndefined();
    expect(parseBodyAnchor("")).toBeUndefined();
  });

  it('maps "t" to "top"', () => {
    expect(parseBodyAnchor("t")).toBe("top");
  });

  it('maps "top" to "top"', () => {
    expect(parseBodyAnchor("top")).toBe("top");
  });

  it('maps "ctr" to "middle"', () => {
    expect(parseBodyAnchor("ctr")).toBe("middle");
  });

  it('maps "center" to "middle"', () => {
    expect(parseBodyAnchor("center")).toBe("middle");
  });

  it('maps "b" to "bottom"', () => {
    expect(parseBodyAnchor("b")).toBe("bottom");
  });

  it('maps "bottom" to "bottom"', () => {
    expect(parseBodyAnchor("bottom")).toBe("bottom");
  });

  it('maps "just" to "middle" (justified anchoring)', () => {
    expect(parseBodyAnchor("just")).toBe("middle");
  });

  it('maps "dist" to "middle" (distributed anchoring)', () => {
    expect(parseBodyAnchor("dist")).toBe("middle");
  });

  it("returns undefined for unknown anchor value", () => {
    expect(parseBodyAnchor("xyz")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(parseBodyAnchor("CTR")).toBe("middle");
    expect(parseBodyAnchor("T")).toBe("top");
    expect(parseBodyAnchor("B")).toBe("bottom");
  });
});

// ---------------------------------------------------------------------------
// parseBodyTextDirection — vert modes
// ---------------------------------------------------------------------------

describe("parseBodyTextDirection — text direction / vertical modes", () => {
  it("returns undefined for absent value", () => {
    expect(parseBodyTextDirection(undefined)).toBeUndefined();
  });

  it('returns undefined for "horz" (horizontal — the default)', () => {
    expect(parseBodyTextDirection("horz")).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseBodyTextDirection("")).toBeUndefined();
  });

  it('maps "vert" to "vertical"', () => {
    expect(parseBodyTextDirection("vert")).toBe("vertical");
  });

  it('maps "eaVert" to "eaVert"', () => {
    expect(parseBodyTextDirection("eaVert")).toBe("eaVert");
  });

  it('maps "mongolianVert" to "mongolianVert"', () => {
    expect(parseBodyTextDirection("mongolianVert")).toBe("mongolianVert");
  });

  it('maps "wordArtVert" to "wordArtVert"', () => {
    expect(parseBodyTextDirection("wordArtVert")).toBe("wordArtVert");
  });

  it('maps "vert270" to "vertical270"', () => {
    expect(parseBodyTextDirection("vert270")).toBe("vertical270");
  });

  it('maps "wordArtVertRtl" to "wordArtVertRtl"', () => {
    expect(parseBodyTextDirection("wordArtVertRtl")).toBe("wordArtVertRtl");
  });

  it("is case-insensitive", () => {
    expect(parseBodyTextDirection("VERT")).toBe("vertical");
    expect(parseBodyTextDirection("Vert270")).toBe("vertical270");
  });
});

// ---------------------------------------------------------------------------
// parseBodyColumnCount
// ---------------------------------------------------------------------------

describe("parseBodyColumnCount", () => {
  it("returns undefined for absent value", () => {
    expect(parseBodyColumnCount(undefined)).toBeUndefined();
  });

  it("parses string '2' to 2", () => {
    expect(parseBodyColumnCount("2")).toBe(2);
  });

  it("parses number 3 to 3", () => {
    expect(parseBodyColumnCount(3)).toBe(3);
  });

  it("clamps minimum to 1", () => {
    expect(parseBodyColumnCount("0")).toBe(1);
    expect(parseBodyColumnCount("-1")).toBe(1);
  });

  it("clamps maximum to 16", () => {
    expect(parseBodyColumnCount("20")).toBe(16);
    expect(parseBodyColumnCount("100")).toBe(16);
  });

  it("rounds fractional values", () => {
    expect(parseBodyColumnCount(2.7)).toBe(3);
    expect(parseBodyColumnCount(2.3)).toBe(2);
  });

  it("returns undefined for non-numeric string", () => {
    expect(parseBodyColumnCount("abc")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBodyInsets — lIns, tIns, rIns, bIns in EMU
// ---------------------------------------------------------------------------

describe("parseBodyInsets — EMU to px conversion", () => {
  it("returns empty for absent bodyPr", () => {
    expect(parseBodyInsets(undefined)).toEqual({});
  });

  it("returns empty when no inset attributes present", () => {
    expect(parseBodyInsets({})).toEqual({});
  });

  it("parses lIns=91440 (0.1 inch)", () => {
    // XML: <a:bodyPr lIns="91440"/>
    const bodyPr: XmlObject = { "@_lIns": "91440" };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetLeft).toBeCloseTo(91440 / EMU_PER_PX, 3);
  });

  it("parses tIns=45720 (0.05 inch)", () => {
    const bodyPr: XmlObject = { "@_tIns": "45720" };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetTop).toBeCloseTo(45720 / EMU_PER_PX, 3);
  });

  it("parses rIns=91440", () => {
    const bodyPr: XmlObject = { "@_rIns": "91440" };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetRight).toBeCloseTo(91440 / EMU_PER_PX, 3);
  });

  it("parses bIns=45720", () => {
    const bodyPr: XmlObject = { "@_bIns": "45720" };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetBottom).toBeCloseTo(45720 / EMU_PER_PX, 3);
  });

  it("parses all four insets together", () => {
    // XML: <a:bodyPr lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>
    const bodyPr: XmlObject = {
      "@_lIns": "91440",
      "@_tIns": "45720",
      "@_rIns": "91440",
      "@_bIns": "45720",
    };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetLeft).toBeCloseTo(91440 / EMU_PER_PX, 3);
    expect(result.bodyInsetTop).toBeCloseTo(45720 / EMU_PER_PX, 3);
    expect(result.bodyInsetRight).toBeCloseTo(91440 / EMU_PER_PX, 3);
    expect(result.bodyInsetBottom).toBeCloseTo(45720 / EMU_PER_PX, 3);
  });

  it("parses zero insets (lIns=0)", () => {
    const bodyPr: XmlObject = { "@_lIns": "0" };
    const result = parseBodyInsets(bodyPr);
    expect(result.bodyInsetLeft).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseBodyWrap
// ---------------------------------------------------------------------------

describe("parseBodyWrap — text wrapping mode", () => {
  it("returns undefined for absent bodyPr", () => {
    expect(parseBodyWrap(undefined)).toBeUndefined();
  });

  it("returns undefined when @_wrap is absent", () => {
    expect(parseBodyWrap({})).toBeUndefined();
  });

  it('parses "square" wrapping', () => {
    expect(parseBodyWrap({ "@_wrap": "square" })).toBe("square");
  });

  it('parses "none" wrapping', () => {
    expect(parseBodyWrap({ "@_wrap": "none" })).toBe("none");
  });

  it("is case-insensitive", () => {
    expect(parseBodyWrap({ "@_wrap": "SQUARE" })).toBe("square");
    expect(parseBodyWrap({ "@_wrap": "None" })).toBe("none");
  });

  it("returns undefined for unknown wrap mode", () => {
    expect(parseBodyWrap({ "@_wrap": "tight" })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBodyAutofit — spAutoFit, normAutofit, noAutofit
// ---------------------------------------------------------------------------

describe("parseBodyAutofit — autofit modes", () => {
  it("returns empty when no autofit element present", () => {
    const result = parseBodyAutofit({});
    expect(result.autoFit).toBeUndefined();
    expect(result.autoFitMode).toBeUndefined();
  });

  it("returns empty for undefined bodyPr", () => {
    const result = parseBodyAutofit(undefined);
    expect(result.autoFit).toBeUndefined();
  });

  it('parses a:spAutoFit as autoFitMode="shrink"', () => {
    // XML: <a:bodyPr><a:spAutoFit/></a:bodyPr>
    const bodyPr: XmlObject = { "a:spAutoFit": {} };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFit).toBe(true);
    expect(result.autoFitMode).toBe("shrink");
  });

  it('parses a:noAutofit as autoFitMode="none"', () => {
    // XML: <a:bodyPr><a:noAutofit/></a:bodyPr>
    const bodyPr: XmlObject = { "a:noAutofit": {} };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFit).toBe(false);
    expect(result.autoFitMode).toBe("none");
  });

  it('parses a:normAutofit as autoFitMode="normal"', () => {
    // XML: <a:bodyPr><a:normAutofit/></a:bodyPr>
    const bodyPr: XmlObject = { "a:normAutofit": {} };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFit).toBe(true);
    expect(result.autoFitMode).toBe("normal");
  });

  it("parses a:normAutofit with fontScale=90000 (90%)", () => {
    // XML: <a:bodyPr><a:normAutofit fontScale="90000"/></a:bodyPr>
    const bodyPr: XmlObject = {
      "a:normAutofit": { "@_fontScale": "90000" },
    };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFit).toBe(true);
    expect(result.autoFitMode).toBe("normal");
    expect(result.autoFitFontScale).toBeCloseTo(0.9, 5);
  });

  it("parses a:normAutofit with fontScale=62500 (62.5%)", () => {
    const bodyPr: XmlObject = {
      "a:normAutofit": { "@_fontScale": "62500" },
    };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFitFontScale).toBeCloseTo(0.625, 5);
  });

  it("parses a:normAutofit with lnSpcReduction=20000 (20%)", () => {
    // XML: <a:bodyPr><a:normAutofit lnSpcReduction="20000"/></a:bodyPr>
    const bodyPr: XmlObject = {
      "a:normAutofit": { "@_lnSpcReduction": "20000" },
    };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFitLineSpacingReduction).toBeCloseTo(0.2, 5);
  });

  it("parses a:normAutofit with both fontScale and lnSpcReduction", () => {
    const bodyPr: XmlObject = {
      "a:normAutofit": {
        "@_fontScale": "75000",
        "@_lnSpcReduction": "10000",
      },
    };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFitFontScale).toBeCloseTo(0.75, 5);
    expect(result.autoFitLineSpacingReduction).toBeCloseTo(0.1, 5);
  });

  it("does not set fontScale for normAutofit without fontScale attr", () => {
    const bodyPr: XmlObject = { "a:normAutofit": {} };
    const result = parseBodyAutofit(bodyPr);
    expect(result.autoFitFontScale).toBeUndefined();
    expect(result.autoFitLineSpacingReduction).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBodyColumnSpacing
// ---------------------------------------------------------------------------

describe("parseBodyColumnSpacing", () => {
  it("returns undefined for absent bodyPr", () => {
    expect(parseBodyColumnSpacing(undefined)).toBeUndefined();
  });

  it("returns undefined when @_spcCol is absent", () => {
    expect(parseBodyColumnSpacing({})).toBeUndefined();
  });

  it("parses @_spcCol=914400 (1 inch) to px", () => {
    const bodyPr: XmlObject = { "@_spcCol": "914400" };
    const result = parseBodyColumnSpacing(bodyPr);
    expect(result).toBeCloseTo(914400 / EMU_PER_PX, 3);
  });

  it("returns undefined for zero spacing", () => {
    const bodyPr: XmlObject = { "@_spcCol": "0" };
    expect(parseBodyColumnSpacing(bodyPr)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBodyHOverflow / parseBodyVertOverflow
// ---------------------------------------------------------------------------

describe("parseBodyHOverflow", () => {
  it("returns undefined for absent bodyPr", () => {
    expect(parseBodyHOverflow(undefined)).toBeUndefined();
  });

  it('parses "overflow"', () => {
    expect(parseBodyHOverflow({ "@_hOverflow": "overflow" })).toBe("overflow");
  });

  it('parses "clip"', () => {
    expect(parseBodyHOverflow({ "@_hOverflow": "clip" })).toBe("clip");
  });

  it("returns undefined for unknown value", () => {
    expect(parseBodyHOverflow({ "@_hOverflow": "wrap" })).toBeUndefined();
  });
});

describe("parseBodyVertOverflow", () => {
  it("returns undefined for absent bodyPr", () => {
    expect(parseBodyVertOverflow(undefined)).toBeUndefined();
  });

  it('parses "overflow"', () => {
    expect(parseBodyVertOverflow({ "@_vertOverflow": "overflow" })).toBe(
      "overflow",
    );
  });

  it('parses "clip"', () => {
    expect(parseBodyVertOverflow({ "@_vertOverflow": "clip" })).toBe("clip");
  });

  it('parses "ellipsis"', () => {
    expect(parseBodyVertOverflow({ "@_vertOverflow": "ellipsis" })).toBe(
      "ellipsis",
    );
  });

  it("returns undefined for unknown value", () => {
    expect(parseBodyVertOverflow({ "@_vertOverflow": "scroll" })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: combined bodyPr parsing
// ---------------------------------------------------------------------------

describe("combined bodyPr parsing — realistic structure", () => {
  it("parses a fully-populated bodyPr XML node", () => {
    // XML:
    // <a:bodyPr rtlCol="0" anchor="ctr" vert="vert" wrap="square"
    //           lIns="91440" tIns="45720" rIns="91440" bIns="45720"
    //           numCol="2" spcCol="914400">
    //   <a:normAutofit fontScale="90000"/>
    // </a:bodyPr>
    const bodyPr: XmlObject = {
      "@_anchor": "ctr",
      "@_vert": "vert",
      "@_wrap": "square",
      "@_lIns": "91440",
      "@_tIns": "45720",
      "@_rIns": "91440",
      "@_bIns": "45720",
      "@_numCol": "2",
      "@_spcCol": "914400",
      "@_hOverflow": "clip",
      "@_vertOverflow": "ellipsis",
      "a:normAutofit": { "@_fontScale": "90000" },
    };

    // Anchor
    expect(parseBodyAnchor(bodyPr["@_anchor"])).toBe("middle");

    // Text direction
    expect(parseBodyTextDirection(bodyPr["@_vert"])).toBe("vertical");

    // Wrapping
    expect(parseBodyWrap(bodyPr)).toBe("square");

    // Insets
    const insets = parseBodyInsets(bodyPr);
    expect(insets.bodyInsetLeft).toBeCloseTo(91440 / EMU_PER_PX, 3);
    expect(insets.bodyInsetTop).toBeCloseTo(45720 / EMU_PER_PX, 3);

    // Columns
    expect(parseBodyColumnCount(bodyPr["@_numCol"])).toBe(2);
    expect(parseBodyColumnSpacing(bodyPr)).toBeCloseTo(914400 / EMU_PER_PX, 3);

    // Autofit
    const autofit = parseBodyAutofit(bodyPr);
    expect(autofit.autoFit).toBe(true);
    expect(autofit.autoFitMode).toBe("normal");
    expect(autofit.autoFitFontScale).toBeCloseTo(0.9, 5);

    // Overflow
    expect(parseBodyHOverflow(bodyPr)).toBe("clip");
    expect(parseBodyVertOverflow(bodyPr)).toBe("ellipsis");
  });
});
