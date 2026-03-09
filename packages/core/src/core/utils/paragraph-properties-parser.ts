/**
 * Standalone parser utilities for `a:pPr` (paragraph properties) XML nodes.
 *
 * Extracts pure parsing logic from the PptxHandlerRuntime mixin chain into
 * exported, testable functions.  Mirrors the runtime's
 * `resolveShapeParagraphStyle`, `parseParagraphSpacingPx`,
 * `parseLineSpacingMultiplier`, `parseLineSpacingExactPt`, and bullet parsing.
 *
 * @module paragraph-properties-parser
 */

import type { BulletInfo, TextStyle, XmlObject } from "../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Boolean helper
// ---------------------------------------------------------------------------

function parseBoolAttr(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return normalized === "1" || normalized === "true";
}

function pointsToPixels(points: number): number {
  return points * (96 / 72);
}

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

const ALIGN_MAP: Record<string, TextStyle["align"]> = {
  l: "left",
  ctr: "center",
  r: "right",
  just: "justify",
  justify: "justify",
  justLow: "justLow",
  dist: "dist",
  thaiDist: "thaiDist",
};

/**
 * Map an OOXML `a:pPr/@algn` token to its {@link TextStyle.align} value.
 */
export function parseAlignmentAttr(
  algn: string | undefined,
): TextStyle["align"] | undefined {
  if (!algn) return undefined;
  return ALIGN_MAP[algn] || undefined;
}

// ---------------------------------------------------------------------------
// Spacing helpers
// ---------------------------------------------------------------------------

/**
 * Parse paragraph spacing from an `a:spcBef` or `a:spcAft` node.
 *
 * Looks for `a:spcPts/@_val` (hundredths of a point) and converts
 * to pixels (at 96 dpi).  Returns `undefined` when absent/invalid.
 */
export function parseParagraphSpacingPx(
  spacingNode: XmlObject | undefined,
): number | undefined {
  if (!spacingNode) return undefined;
  const spcPts = spacingNode["a:spcPts"] as XmlObject | undefined;
  const raw = Number.parseInt(String(spcPts?.["@_val"] || ""), 10);
  if (Number.isFinite(raw)) {
    return pointsToPixels(raw / 100);
  }
  return undefined;
}

/**
 * Parse proportional line spacing from `a:lnSpc > a:spcPct/@_val`.
 *
 * The OOXML value is in 1/100000ths (i.e. 150000 = 150%).  Returns a
 * multiplier clamped to [0.1, 5].
 */
export function parseLineSpacingMultiplier(
  lineSpacingNode: XmlObject | undefined,
): number | undefined {
  if (!lineSpacingNode) return undefined;
  const spcPct = lineSpacingNode["a:spcPct"] as XmlObject | undefined;
  const raw = Number.parseInt(String(spcPct?.["@_val"] || ""), 10);
  if (Number.isFinite(raw)) {
    return Math.max(0.1, Math.min(5, raw / 100000));
  }
  return undefined;
}

/**
 * Parse exact line spacing from `a:lnSpc > a:spcPts/@_val`.
 *
 * The OOXML value is in hundredths of a point.  Returns the value in points.
 */
export function parseLineSpacingExactPt(
  lineSpacingNode: XmlObject | undefined,
): number | undefined {
  if (!lineSpacingNode) return undefined;
  const spcPts = lineSpacingNode["a:spcPts"] as XmlObject | undefined;
  const raw = Number.parseInt(String(spcPts?.["@_val"] || ""), 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw / 100;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Margins and indentation
// ---------------------------------------------------------------------------

/**
 * Parse paragraph margins and indent from `a:pPr` attributes.
 *
 * `@_marL`, `@_marR` are in EMU; `@_indent` is in EMU (may be negative
 * for hanging indent).
 */
export function parseParagraphMargins(
  pPr: XmlObject | undefined,
): Pick<
  TextStyle,
  "paragraphMarginLeft" | "paragraphMarginRight" | "paragraphIndent"
> {
  const result: Pick<
    TextStyle,
    "paragraphMarginLeft" | "paragraphMarginRight" | "paragraphIndent"
  > = {};
  if (!pPr) return result;

  if (pPr["@_marL"] !== undefined) {
    const marL = Number.parseInt(String(pPr["@_marL"]), 10);
    if (Number.isFinite(marL)) {
      result.paragraphMarginLeft = marL / EMU_PER_PX;
    }
  }

  if (pPr["@_marR"] !== undefined) {
    const marR = Number.parseInt(String(pPr["@_marR"]), 10);
    if (Number.isFinite(marR)) {
      result.paragraphMarginRight = marR / EMU_PER_PX;
    }
  }

  if (pPr["@_indent"] !== undefined) {
    const indent = Number.parseInt(String(pPr["@_indent"]), 10);
    if (Number.isFinite(indent)) {
      result.paragraphIndent = indent / EMU_PER_PX;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// RTL + level
// ---------------------------------------------------------------------------

/**
 * Parse RTL direction from `a:pPr/@_rtl`.
 */
export function parseParagraphRtl(
  pPr: XmlObject | undefined,
): boolean | undefined {
  if (!pPr) return undefined;
  return parseBoolAttr(pPr["@_rtl"]);
}

/**
 * Parse paragraph level from `a:pPr/@_lvl`.
 * Returns 0-8 (clamped).
 */
export function parseParagraphLevel(
  pPr: XmlObject | undefined,
): number {
  if (!pPr) return 0;
  const level = Number.parseInt(String(pPr["@_lvl"] || "0"), 10);
  return Number.isFinite(level) ? Math.min(Math.max(level, 0), 8) : 0;
}

// ---------------------------------------------------------------------------
// Tab stops
// ---------------------------------------------------------------------------

/**
 * Parse tab stops from `a:pPr > a:tabLst > a:tab`.
 *
 * Each tab has `@_pos` (EMU), `@_algn`, and optional `@_leader`.
 */
export function parseTabStops(
  pPr: XmlObject | undefined,
): TextStyle["tabStops"] | undefined {
  if (!pPr) return undefined;
  const tabLst = pPr["a:tabLst"] as XmlObject | undefined;
  if (!tabLst) return undefined;

  const tabNodes: XmlObject[] = Array.isArray(tabLst["a:tab"])
    ? tabLst["a:tab"]
    : tabLst["a:tab"]
      ? [tabLst["a:tab"]]
      : [];

  if (tabNodes.length === 0) return undefined;

  return tabNodes
    .filter((t) => t?.["@_pos"] !== undefined)
    .map((t) => {
      const posRaw = Number.parseInt(String(t["@_pos"]), 10);
      const position = Number.isFinite(posRaw) ? posRaw / EMU_PER_PX : 0;
      const algn = String(t["@_algn"] || "l").trim();
      const align =
        algn === "ctr" || algn === "r" || algn === "dec"
          ? (algn as "ctr" | "r" | "dec")
          : ("l" as const);
      const leaderVal = String(t["@_leader"] || "").trim();
      const leader =
        leaderVal === "dot" ||
        leaderVal === "hyphen" ||
        leaderVal === "underscore"
          ? leaderVal
          : undefined;
      return { position, align, ...(leader ? { leader } : {}) };
    });
}

// ---------------------------------------------------------------------------
// Additional paragraph attributes
// ---------------------------------------------------------------------------

/**
 * Parse additional paragraph-level attributes from `a:pPr`.
 *
 * Handles: `@_defTabSz`, `@_eaLnBrk`, `@_latinLnBrk`, `@_fontAlgn`,
 * `@_hangingPunct`.
 */
export function parseParagraphExtraAttributes(
  pPr: XmlObject | undefined,
): Pick<
  TextStyle,
  | "defaultTabSize"
  | "eaLineBreak"
  | "latinLineBreak"
  | "fontAlignment"
  | "hangingPunctuation"
> {
  const result: Pick<
    TextStyle,
    | "defaultTabSize"
    | "eaLineBreak"
    | "latinLineBreak"
    | "fontAlignment"
    | "hangingPunctuation"
  > = {};
  if (!pPr) return result;

  if (pPr["@_defTabSz"] !== undefined) {
    const defTabSz = Number.parseInt(String(pPr["@_defTabSz"]), 10);
    if (Number.isFinite(defTabSz)) {
      result.defaultTabSize = defTabSz / EMU_PER_PX;
    }
  }

  const eaVal = parseBoolAttr(pPr["@_eaLnBrk"]);
  if (eaVal !== undefined) result.eaLineBreak = eaVal;

  const latVal = parseBoolAttr(pPr["@_latinLnBrk"]);
  if (latVal !== undefined) result.latinLineBreak = latVal;

  if (pPr["@_fontAlgn"] !== undefined) {
    const fontAlgn = String(pPr["@_fontAlgn"]).trim();
    if (fontAlgn) result.fontAlignment = fontAlgn;
  }

  const hpVal = parseBoolAttr(pPr["@_hangingPunct"]);
  if (hpVal !== undefined) result.hangingPunctuation = hpVal;

  return result;
}

// ---------------------------------------------------------------------------
// Bullet parsing
// ---------------------------------------------------------------------------

/**
 * Parse bullet info from paragraph-level properties.
 *
 * Handles `a:buNone`, `a:buChar`, `a:buAutoNum`, along with shared
 * properties `a:buFont`, `a:buSzPct`, `a:buSzPts`, `a:buClr`.
 */
export function parseBulletInfo(
  pPr: XmlObject | undefined,
  paragraphIndex: number = 0,
): BulletInfo | null {
  if (!pPr) return null;

  // Explicit none
  if (pPr["a:buNone"]) return { none: true };

  // Shared styling
  const buFont = pPr["a:buFont"] as XmlObject | undefined;
  const fontFamily = buFont?.["@_typeface"]
    ? String(buFont["@_typeface"])
    : undefined;

  const buSzPct = pPr["a:buSzPct"] as XmlObject | undefined;
  let sizePercent: number | undefined;
  if (buSzPct?.["@_val"] !== undefined) {
    const pctRaw = Number.parseInt(String(buSzPct["@_val"]), 10);
    if (Number.isFinite(pctRaw)) {
      sizePercent = pctRaw / 1000;
    }
  }

  const buSzPts = pPr["a:buSzPts"] as XmlObject | undefined;
  let sizePts: number | undefined;
  if (buSzPts?.["@_val"] !== undefined) {
    const ptsRaw = Number.parseInt(String(buSzPts["@_val"]), 10);
    if (Number.isFinite(ptsRaw)) {
      sizePts = ptsRaw / 100;
    }
  }

  const buClr = pPr["a:buClr"] as XmlObject | undefined;
  let color: string | undefined;
  if (buClr) {
    const srgb = buClr["a:srgbClr"] as XmlObject | undefined;
    if (srgb?.["@_val"]) {
      color = String(srgb["@_val"]);
    }
  }

  // Character bullet
  const buChar = pPr["a:buChar"] as XmlObject | undefined;
  if (buChar?.["@_char"]) {
    const char = String(buChar["@_char"]);
    if (char.length > 0) {
      return { char, fontFamily, sizePercent, sizePts, color };
    }
  }

  // Auto-numbered bullet
  const autoNum = pPr["a:buAutoNum"] as XmlObject | undefined;
  if (autoNum) {
    const autoNumType = autoNum["@_type"]
      ? String(autoNum["@_type"])
      : undefined;
    const startAtRaw = Number.parseInt(
      String(autoNum["@_startAt"] || "1"),
      10,
    );
    const autoNumStartAt = Number.isFinite(startAtRaw) ? startAtRaw : 1;
    return {
      autoNumType,
      autoNumStartAt,
      paragraphIndex,
      fontFamily,
      sizePercent,
      sizePts,
      color,
    };
  }

  // No bullet
  return null;
}
