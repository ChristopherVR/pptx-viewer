import { describe, it, expect } from "vitest";
import type { TextStyle, PptxShapeLocks } from "../../types";

// Since these are protected methods on a deeply chained mixin, we extract
// their logic and test them directly.

const EMU_PER_PX = 9525;

// --- Extracted from parseShapeLocks ---
function parseShapeLocks(
  spLocks: Record<string, unknown> | undefined,
): PptxShapeLocks | undefined {
  if (!spLocks) return undefined;

  const locks: PptxShapeLocks = {};
  let hasAny = false;

  const boolAttr = (attr: string): boolean | undefined => {
    const raw = spLocks[attr];
    if (raw === undefined) return undefined;
    const val = String(raw).trim().toLowerCase();
    return val === "1" || val === "true";
  };

  const set = (attr: string, fn: (v: boolean) => void) => {
    const val = boolAttr(attr);
    if (val !== undefined) {
      fn(val);
      hasAny = true;
    }
  };

  set("@_noGrp", (v) => { locks.noGrouping = v; });
  set("@_noRot", (v) => { locks.noRotation = v; });
  set("@_noMove", (v) => { locks.noMove = v; });
  set("@_noResize", (v) => { locks.noResize = v; });
  set("@_noTextEdit", (v) => { locks.noTextEdit = v; });
  set("@_noSelect", (v) => { locks.noSelect = v; });
  set("@_noChangeAspect", (v) => { locks.noChangeAspect = v; });
  set("@_noEditPoints", (v) => { locks.noEditPoints = v; });
  set("@_noAdjustHandles", (v) => { locks.noAdjustHandles = v; });
  set("@_noChangeArrowheads", (v) => { locks.noChangeArrowheads = v; });
  set("@_noChangeShapeType", (v) => { locks.noChangeShapeType = v; });

  return hasAny ? locks : undefined;
}

// --- Extracted from textVerticalAlignFromDrawingValue ---
function textVerticalAlignFromDrawingValue(
  value: unknown,
): TextStyle["vAlign"] | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized === "t" || normalized === "top") return "top";
  if (normalized === "ctr" || normalized === "center") return "middle";
  if (normalized === "b" || normalized === "bottom") return "bottom";
  if (normalized === "dist" || normalized === "just") return "middle";
  return undefined;
}

// --- Extracted from textDirectionFromDrawingValue ---
function textDirectionFromDrawingValue(
  value: unknown,
): TextStyle["textDirection"] | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.length === 0 || normalized === "horz") return undefined;
  if (normalized === "vert270" || normalized === "wordartvertrtl") {
    return "vertical270";
  }
  if (
    normalized === "vert" ||
    normalized === "eavert" ||
    normalized === "mongolianvert" ||
    normalized === "wordartvert"
  ) {
    return "vertical";
  }
  return undefined;
}

// --- Extracted from normalizeTextColumnCount ---
function normalizeTextColumnCount(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, Math.min(16, Math.round(parsed)));
}

// --- Extracted from applyBodyProperties (partial — auto-fit parsing) ---
function parseAutoFit(
  bodyPr: Record<string, unknown>,
): Pick<TextStyle, "autoFit" | "autoFitMode" | "autoFitFontScale" | "autoFitLineSpacingReduction"> {
  const result: Pick<TextStyle, "autoFit" | "autoFitMode" | "autoFitFontScale" | "autoFitLineSpacingReduction"> = {};

  if (bodyPr["a:spAutoFit"] !== undefined) {
    result.autoFit = true;
    result.autoFitMode = "shrink";
  } else if (bodyPr["a:normAutofit"] !== undefined) {
    result.autoFit = true;
    result.autoFitMode = "normal";
    const fontScaleRaw = parseInt(
      String(
        (bodyPr["a:normAutofit"] as Record<string, unknown>)?.["@_fontScale"] || "",
      ),
      10,
    );
    if (Number.isFinite(fontScaleRaw) && fontScaleRaw > 0) {
      result.autoFitFontScale = fontScaleRaw / 100000;
    }
    const lnSpcReductionRaw = parseInt(
      String(
        (bodyPr["a:normAutofit"] as Record<string, unknown>)?.["@_lnSpcReduction"] || "",
      ),
      10,
    );
    if (Number.isFinite(lnSpcReductionRaw) && lnSpcReductionRaw > 0) {
      result.autoFitLineSpacingReduction = lnSpcReductionRaw / 100000;
    }
  } else if (bodyPr["a:noAutofit"] !== undefined) {
    result.autoFit = false;
    result.autoFitMode = "none";
  }

  return result;
}

// --- Extracted from applyBodyProperties (body insets) ---
function parseBodyInsets(
  bodyPr: Record<string, unknown>,
): Pick<TextStyle, "bodyInsetLeft" | "bodyInsetTop" | "bodyInsetRight" | "bodyInsetBottom"> {
  const result: Pick<TextStyle, "bodyInsetLeft" | "bodyInsetTop" | "bodyInsetRight" | "bodyInsetBottom"> = {};
  const parseInset = (attr: string): number | undefined => {
    const raw = bodyPr[attr];
    if (raw === undefined) return undefined;
    const val = Number.parseInt(String(raw), 10);
    return Number.isFinite(val) ? val / EMU_PER_PX : undefined;
  };
  const lIns = parseInset("@_lIns");
  if (lIns !== undefined) result.bodyInsetLeft = lIns;
  const tIns = parseInset("@_tIns");
  if (tIns !== undefined) result.bodyInsetTop = tIns;
  const rIns = parseInset("@_rIns");
  if (rIns !== undefined) result.bodyInsetRight = rIns;
  const bIns = parseInset("@_bIns");
  if (bIns !== undefined) result.bodyInsetBottom = bIns;
  return result;
}

// --- Extracted from applyBodyProperties (text wrap) ---
function parseTextWrap(
  bodyPr: Record<string, unknown>,
): TextStyle["textWrap"] | undefined {
  const wrapAttr = String(bodyPr["@_wrap"] || "").trim().toLowerCase();
  if (wrapAttr === "none") return "none";
  if (wrapAttr === "square") return "square";
  return undefined;
}

// --- Extracted from applyBodyProperties (overflow) ---
function parseOverflow(
  bodyPr: Record<string, unknown>,
): Pick<TextStyle, "hOverflow" | "vertOverflow"> {
  const result: Pick<TextStyle, "hOverflow" | "vertOverflow"> = {};
  const hOverflow = String(bodyPr["@_hOverflow"] || "").trim();
  if (hOverflow === "overflow" || hOverflow === "clip") {
    result.hOverflow = hOverflow;
  }
  const vertOverflow = String(bodyPr["@_vertOverflow"] || "").trim();
  if (vertOverflow === "overflow" || vertOverflow === "clip" || vertOverflow === "ellipsis") {
    result.vertOverflow = vertOverflow;
  }
  return result;
}

// ---------------------------------------------------------------------------
// parseShapeLocks
// ---------------------------------------------------------------------------
describe("parseShapeLocks", () => {
  it("should return undefined for undefined input", () => {
    expect(parseShapeLocks(undefined)).toBeUndefined();
  });

  it("should return undefined for empty object", () => {
    expect(parseShapeLocks({})).toBeUndefined();
  });

  it("should parse noMove=true from '1'", () => {
    const result = parseShapeLocks({ "@_noMove": "1" });
    expect(result).toEqual({ noMove: true });
  });

  it("should parse noMove=true from 'true'", () => {
    const result = parseShapeLocks({ "@_noMove": "true" });
    expect(result).toEqual({ noMove: true });
  });

  it("should parse noMove=false from '0'", () => {
    const result = parseShapeLocks({ "@_noMove": "0" });
    expect(result).toEqual({ noMove: false });
  });

  it("should parse noMove=false from 'false'", () => {
    const result = parseShapeLocks({ "@_noMove": "false" });
    expect(result).toEqual({ noMove: false });
  });

  it("should parse all lock attributes", () => {
    const result = parseShapeLocks({
      "@_noGrp": "1",
      "@_noRot": "1",
      "@_noMove": "1",
      "@_noResize": "1",
      "@_noTextEdit": "1",
      "@_noSelect": "1",
      "@_noChangeAspect": "1",
      "@_noEditPoints": "1",
      "@_noAdjustHandles": "1",
      "@_noChangeArrowheads": "1",
      "@_noChangeShapeType": "1",
    });
    expect(result).toEqual({
      noGrouping: true,
      noRotation: true,
      noMove: true,
      noResize: true,
      noTextEdit: true,
      noSelect: true,
      noChangeAspect: true,
      noEditPoints: true,
      noAdjustHandles: true,
      noChangeArrowheads: true,
      noChangeShapeType: true,
    });
  });

  it("should handle mixed true and false values", () => {
    const result = parseShapeLocks({
      "@_noMove": "1",
      "@_noResize": "0",
    });
    expect(result).toEqual({ noMove: true, noResize: false });
  });
});

// ---------------------------------------------------------------------------
// textVerticalAlignFromDrawingValue
// ---------------------------------------------------------------------------
describe("textVerticalAlignFromDrawingValue", () => {
  it("should return undefined for undefined", () => {
    expect(textVerticalAlignFromDrawingValue(undefined)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(textVerticalAlignFromDrawingValue("")).toBeUndefined();
  });

  it('should return "top" for "t"', () => {
    expect(textVerticalAlignFromDrawingValue("t")).toBe("top");
  });

  it('should return "top" for "top"', () => {
    expect(textVerticalAlignFromDrawingValue("top")).toBe("top");
  });

  it('should return "middle" for "ctr"', () => {
    expect(textVerticalAlignFromDrawingValue("ctr")).toBe("middle");
  });

  it('should return "bottom" for "b"', () => {
    expect(textVerticalAlignFromDrawingValue("b")).toBe("bottom");
  });

  it('should return "middle" for "dist"', () => {
    expect(textVerticalAlignFromDrawingValue("dist")).toBe("middle");
  });

  it('should return "middle" for "just"', () => {
    expect(textVerticalAlignFromDrawingValue("just")).toBe("middle");
  });

  it("should return undefined for unknown values", () => {
    expect(textVerticalAlignFromDrawingValue("unknown")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// textDirectionFromDrawingValue
// ---------------------------------------------------------------------------
describe("textDirectionFromDrawingValue", () => {
  it("should return undefined for undefined", () => {
    expect(textDirectionFromDrawingValue(undefined)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(textDirectionFromDrawingValue("")).toBeUndefined();
  });

  it('should return undefined for "horz" (horizontal is default)', () => {
    expect(textDirectionFromDrawingValue("horz")).toBeUndefined();
  });

  it('should return "vertical" for "vert"', () => {
    expect(textDirectionFromDrawingValue("vert")).toBe("vertical");
  });

  it('should return "vertical" for "eaVert"', () => {
    expect(textDirectionFromDrawingValue("eaVert")).toBe("vertical");
  });

  it('should return "vertical" for "mongolianVert"', () => {
    expect(textDirectionFromDrawingValue("mongolianVert")).toBe("vertical");
  });

  it('should return "vertical" for "wordArtVert"', () => {
    expect(textDirectionFromDrawingValue("wordArtVert")).toBe("vertical");
  });

  it('should return "vertical270" for "vert270"', () => {
    expect(textDirectionFromDrawingValue("vert270")).toBe("vertical270");
  });

  it('should return "vertical270" for "wordArtVertRtl"', () => {
    expect(textDirectionFromDrawingValue("wordArtVertRtl")).toBe("vertical270");
  });
});

// ---------------------------------------------------------------------------
// normalizeTextColumnCount
// ---------------------------------------------------------------------------
describe("normalizeTextColumnCount", () => {
  it("should return undefined for undefined", () => {
    expect(normalizeTextColumnCount(undefined)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(normalizeTextColumnCount("")).toBeUndefined();
  });

  it("should return undefined for non-numeric string", () => {
    expect(normalizeTextColumnCount("abc")).toBeUndefined();
  });

  it("should parse '2' as 2", () => {
    expect(normalizeTextColumnCount("2")).toBe(2);
  });

  it("should parse numeric input directly", () => {
    expect(normalizeTextColumnCount(3)).toBe(3);
  });

  it("should clamp to minimum of 1", () => {
    expect(normalizeTextColumnCount(0)).toBe(1);
    expect(normalizeTextColumnCount(-5)).toBe(1);
  });

  it("should clamp to maximum of 16", () => {
    expect(normalizeTextColumnCount(20)).toBe(16);
    expect(normalizeTextColumnCount(100)).toBe(16);
  });

  it("should round fractional values", () => {
    expect(normalizeTextColumnCount(2.7)).toBe(3);
    expect(normalizeTextColumnCount(2.3)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// parseAutoFit
// ---------------------------------------------------------------------------
describe("parseAutoFit", () => {
  it("should parse a:spAutoFit as shrink mode", () => {
    const result = parseAutoFit({ "a:spAutoFit": {} });
    expect(result).toEqual({ autoFit: true, autoFitMode: "shrink" });
  });

  it("should parse a:noAutofit as none mode", () => {
    const result = parseAutoFit({ "a:noAutofit": {} });
    expect(result).toEqual({ autoFit: false, autoFitMode: "none" });
  });

  it("should parse a:normAutofit as normal mode", () => {
    const result = parseAutoFit({ "a:normAutofit": {} });
    expect(result).toEqual({ autoFit: true, autoFitMode: "normal" });
  });

  it("should parse font scale from a:normAutofit", () => {
    const result = parseAutoFit({
      "a:normAutofit": { "@_fontScale": "75000" },
    });
    expect(result.autoFitFontScale).toBe(0.75);
  });

  it("should parse line spacing reduction from a:normAutofit", () => {
    const result = parseAutoFit({
      "a:normAutofit": { "@_lnSpcReduction": "20000" },
    });
    expect(result.autoFitLineSpacingReduction).toBe(0.2);
  });

  it("should return empty object when no autofit node is present", () => {
    const result = parseAutoFit({});
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseBodyInsets
// ---------------------------------------------------------------------------
describe("parseBodyInsets", () => {
  it("should return empty object when no insets are present", () => {
    expect(parseBodyInsets({})).toEqual({});
  });

  it("should parse all four insets", () => {
    const result = parseBodyInsets({
      "@_lIns": "91440",
      "@_tIns": "45720",
      "@_rIns": "91440",
      "@_bIns": "45720",
    });
    expect(result.bodyInsetLeft).toBeCloseTo(91440 / EMU_PER_PX, 2);
    expect(result.bodyInsetTop).toBeCloseTo(45720 / EMU_PER_PX, 2);
    expect(result.bodyInsetRight).toBeCloseTo(91440 / EMU_PER_PX, 2);
    expect(result.bodyInsetBottom).toBeCloseTo(45720 / EMU_PER_PX, 2);
  });

  it("should parse zero insets", () => {
    const result = parseBodyInsets({
      "@_lIns": "0",
      "@_tIns": "0",
      "@_rIns": "0",
      "@_bIns": "0",
    });
    expect(result.bodyInsetLeft).toBe(0);
    expect(result.bodyInsetTop).toBe(0);
    expect(result.bodyInsetRight).toBe(0);
    expect(result.bodyInsetBottom).toBe(0);
  });

  it("should ignore non-numeric inset values", () => {
    const result = parseBodyInsets({ "@_lIns": "abc" });
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseTextWrap
// ---------------------------------------------------------------------------
describe("parseTextWrap", () => {
  it("should return undefined for empty/missing wrap", () => {
    expect(parseTextWrap({})).toBeUndefined();
  });

  it('should return "none" for wrap=none', () => {
    expect(parseTextWrap({ "@_wrap": "none" })).toBe("none");
  });

  it('should return "square" for wrap=square', () => {
    expect(parseTextWrap({ "@_wrap": "square" })).toBe("square");
  });

  it("should return undefined for unknown wrap values", () => {
    expect(parseTextWrap({ "@_wrap": "tight" })).toBeUndefined();
  });

  it("should be case-insensitive", () => {
    expect(parseTextWrap({ "@_wrap": "None" })).toBe("none");
    expect(parseTextWrap({ "@_wrap": "SQUARE" })).toBe("square");
  });
});

// ---------------------------------------------------------------------------
// parseOverflow
// ---------------------------------------------------------------------------
describe("parseOverflow", () => {
  it("should return empty object when no overflow is present", () => {
    expect(parseOverflow({})).toEqual({});
  });

  it("should parse horizontal overflow", () => {
    expect(parseOverflow({ "@_hOverflow": "overflow" })).toEqual({
      hOverflow: "overflow",
    });
    expect(parseOverflow({ "@_hOverflow": "clip" })).toEqual({
      hOverflow: "clip",
    });
  });

  it("should parse vertical overflow", () => {
    expect(parseOverflow({ "@_vertOverflow": "overflow" })).toEqual({
      vertOverflow: "overflow",
    });
    expect(parseOverflow({ "@_vertOverflow": "clip" })).toEqual({
      vertOverflow: "clip",
    });
    expect(parseOverflow({ "@_vertOverflow": "ellipsis" })).toEqual({
      vertOverflow: "ellipsis",
    });
  });

  it("should ignore unknown overflow values", () => {
    expect(parseOverflow({ "@_hOverflow": "unknown" })).toEqual({});
    expect(parseOverflow({ "@_vertOverflow": "unknown" })).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseTextWarpAdjustments — extracted from applyBodyProperties (prstTxWarp)
// ---------------------------------------------------------------------------

/**
 * Extracted logic for parsing adjustment values from a:prstTxWarp/a:avLst/a:gd.
 */
function parseTextWarpAdjustments(
  prstTxWarp: Record<string, unknown> | undefined,
): Pick<TextStyle, "textWarpPreset" | "textWarpAdj" | "textWarpAdj2"> {
  const result: Pick<TextStyle, "textWarpPreset" | "textWarpAdj" | "textWarpAdj2"> = {};
  if (!prstTxWarp) return result;

  const warpPreset = String(prstTxWarp["@_prst"] || "").trim();
  if (warpPreset.length > 0 && warpPreset !== "textNoShape") {
    result.textWarpPreset = warpPreset as TextStyle["textWarpPreset"];
  }

  const avLst = prstTxWarp["a:avLst"] as Record<string, unknown> | undefined;
  if (avLst) {
    const gdRaw = avLst["a:gd"];
    const gdArr = Array.isArray(gdRaw) ? gdRaw : gdRaw ? [gdRaw] : [];
    for (const gd of gdArr) {
      const gdObj = gd as Record<string, unknown>;
      const name = String(gdObj["@_name"] || "").trim();
      const fmla = String(gdObj["@_fmla"] || "").trim();
      const valMatch = fmla.match(/^val\s+(-?\d+)$/);
      if (!valMatch) continue;
      const val = parseInt(valMatch[1], 10);
      if (!Number.isFinite(val)) continue;
      if (name === "adj") {
        result.textWarpAdj = val;
      } else if (name === "adj2") {
        result.textWarpAdj2 = val;
      }
    }
  }
  return result;
}

/**
 * Extracted logic for serialising textWarp adj values back to XML node structure.
 */
function buildTextWarpXmlNode(
  textStyle: Pick<TextStyle, "textWarpPreset" | "textWarpAdj" | "textWarpAdj2">,
): Record<string, unknown> | undefined {
  if (!textStyle.textWarpPreset) return undefined;
  const node: Record<string, unknown> = {
    "@_prst": textStyle.textWarpPreset,
  };
  const adjGds: Record<string, unknown>[] = [];
  if (textStyle.textWarpAdj !== undefined && Number.isFinite(textStyle.textWarpAdj)) {
    adjGds.push({ "@_name": "adj", "@_fmla": `val ${textStyle.textWarpAdj}` });
  }
  if (textStyle.textWarpAdj2 !== undefined && Number.isFinite(textStyle.textWarpAdj2)) {
    adjGds.push({ "@_name": "adj2", "@_fmla": `val ${textStyle.textWarpAdj2}` });
  }
  if (adjGds.length > 0) {
    node["a:avLst"] = { "a:gd": adjGds.length === 1 ? adjGds[0] : adjGds };
  }
  return node;
}

describe("parseTextWarpAdjustments", () => {
  it("should return empty object when prstTxWarp is undefined", () => {
    expect(parseTextWarpAdjustments(undefined)).toEqual({});
  });

  it("should parse preset name without adjustment values", () => {
    const result = parseTextWarpAdjustments({ "@_prst": "textArchUp" });
    expect(result).toEqual({ textWarpPreset: "textArchUp" });
  });

  it("should skip textNoShape preset", () => {
    const result = parseTextWarpAdjustments({ "@_prst": "textNoShape" });
    expect(result).toEqual({});
  });

  it("should parse single adj value", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textInflate",
      "a:avLst": {
        "a:gd": { "@_name": "adj", "@_fmla": "val 25000" },
      },
    });
    expect(result).toEqual({
      textWarpPreset: "textInflate",
      textWarpAdj: 25000,
    });
  });

  it("should parse both adj and adj2 values", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textWave1",
      "a:avLst": {
        "a:gd": [
          { "@_name": "adj", "@_fmla": "val 12500" },
          { "@_name": "adj2", "@_fmla": "val 0" },
        ],
      },
    });
    expect(result).toEqual({
      textWarpPreset: "textWave1",
      textWarpAdj: 12500,
      textWarpAdj2: 0,
    });
  });

  it("should handle negative adjustment values", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textCurveUp",
      "a:avLst": {
        "a:gd": { "@_name": "adj", "@_fmla": "val -10000" },
      },
    });
    expect(result).toEqual({
      textWarpPreset: "textCurveUp",
      textWarpAdj: -10000,
    });
  });

  it("should skip guide definitions with non-val formulas", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textArchUp",
      "a:avLst": {
        "a:gd": { "@_name": "adj", "@_fmla": "*/adj 100 200" },
      },
    });
    expect(result).toEqual({ textWarpPreset: "textArchUp" });
  });

  it("should handle empty avLst", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textDeflate",
      "a:avLst": {},
    });
    expect(result).toEqual({ textWarpPreset: "textDeflate" });
  });

  it("should ignore guide definitions with unknown names", () => {
    const result = parseTextWarpAdjustments({
      "@_prst": "textCircle",
      "a:avLst": {
        "a:gd": { "@_name": "adj3", "@_fmla": "val 50000" },
      },
    });
    expect(result).toEqual({ textWarpPreset: "textCircle" });
  });
});

describe("buildTextWarpXmlNode (save round-trip)", () => {
  it("should return undefined when no preset is set", () => {
    expect(buildTextWarpXmlNode({})).toBeUndefined();
  });

  it("should build node with preset only when no adj values", () => {
    const node = buildTextWarpXmlNode({ textWarpPreset: "textArchUp" });
    expect(node).toEqual({ "@_prst": "textArchUp" });
  });

  it("should include adj in avLst", () => {
    const node = buildTextWarpXmlNode({
      textWarpPreset: "textInflate",
      textWarpAdj: 25000,
    });
    expect(node).toEqual({
      "@_prst": "textInflate",
      "a:avLst": {
        "a:gd": { "@_name": "adj", "@_fmla": "val 25000" },
      },
    });
  });

  it("should include both adj and adj2 in avLst as array", () => {
    const node = buildTextWarpXmlNode({
      textWarpPreset: "textWave1",
      textWarpAdj: 12500,
      textWarpAdj2: 0,
    });
    expect(node).toEqual({
      "@_prst": "textWave1",
      "a:avLst": {
        "a:gd": [
          { "@_name": "adj", "@_fmla": "val 12500" },
          { "@_name": "adj2", "@_fmla": "val 0" },
        ],
      },
    });
  });

  it("round-trip: parse → build produces equivalent structure", () => {
    const input = {
      "@_prst": "textWave1",
      "a:avLst": {
        "a:gd": [
          { "@_name": "adj", "@_fmla": "val 12500" },
          { "@_name": "adj2", "@_fmla": "val 0" },
        ],
      },
    };
    const parsed = parseTextWarpAdjustments(input);
    const rebuilt = buildTextWarpXmlNode(parsed);
    expect(rebuilt).toEqual(input);
  });

  it("round-trip: single adj value", () => {
    const input = {
      "@_prst": "textInflate",
      "a:avLst": {
        "a:gd": { "@_name": "adj", "@_fmla": "val 37500" },
      },
    };
    const parsed = parseTextWarpAdjustments(input);
    const rebuilt = buildTextWarpXmlNode(parsed);
    expect(rebuilt).toEqual(input);
  });
});
