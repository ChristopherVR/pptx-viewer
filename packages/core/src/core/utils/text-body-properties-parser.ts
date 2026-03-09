/**
 * Standalone parser utilities for `a:bodyPr` (text body properties) XML nodes.
 *
 * Extracts the pure parsing logic from PptxHandlerRuntime's
 * `applyBodyProperties` method into exported, testable functions.
 *
 * @module text-body-properties-parser
 */

import type { TextStyle, XmlObject } from "../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Vertical alignment (anchor)
// ---------------------------------------------------------------------------

/**
 * Map `a:bodyPr/@anchor` to a {@link TextStyle.vAlign} value.
 *
 * OOXML tokens: `t` (top), `ctr` (center/middle), `b` (bottom),
 * `just` and `dist` (both map to middle for rendering purposes).
 */
export function parseBodyAnchor(
  value: unknown,
): TextStyle["vAlign"] | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized === "t" || normalized === "top") return "top";
  if (normalized === "ctr" || normalized === "center") return "middle";
  if (normalized === "b" || normalized === "bottom") return "bottom";
  if (normalized === "dist" || normalized === "just") return "middle";
  return undefined;
}

// ---------------------------------------------------------------------------
// Text direction (vert)
// ---------------------------------------------------------------------------

/**
 * Map `a:bodyPr/@vert` to a {@link TextStyle.textDirection} value.
 *
 * - `horz` (or absent): undefined (horizontal, the default)
 * - `vert`, `eaVert`, `mongolianVert`, `wordArtVert`: `"vertical"`
 * - `vert270`, `wordArtVertRtl`: `"vertical270"`
 */
export function parseBodyTextDirection(
  value: unknown,
): TextStyle["textDirection"] | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
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

// ---------------------------------------------------------------------------
// Column count
// ---------------------------------------------------------------------------

/**
 * Parse and normalize `a:bodyPr/@numCol`.
 * Returns a column count clamped to [1, 16], or `undefined` if invalid.
 */
export function parseBodyColumnCount(
  value: unknown,
): number | undefined {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, Math.min(16, Math.round(parsed)));
}

// ---------------------------------------------------------------------------
// Insets
// ---------------------------------------------------------------------------

/**
 * Parse body text insets from `a:bodyPr` attributes.
 *
 * `@_lIns`, `@_tIns`, `@_rIns`, `@_bIns` are in EMU.
 * Returns values in pixels (EMU / 9525).
 */
export function parseBodyInsets(
  bodyPr: XmlObject | undefined,
): Pick<
  TextStyle,
  | "bodyInsetLeft"
  | "bodyInsetTop"
  | "bodyInsetRight"
  | "bodyInsetBottom"
> {
  const result: Pick<
    TextStyle,
    | "bodyInsetLeft"
    | "bodyInsetTop"
    | "bodyInsetRight"
    | "bodyInsetBottom"
  > = {};
  if (!bodyPr) return result;

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

// ---------------------------------------------------------------------------
// Wrapping mode
// ---------------------------------------------------------------------------

/**
 * Parse text wrapping from `a:bodyPr/@wrap`.
 */
export function parseBodyWrap(
  bodyPr: XmlObject | undefined,
): TextStyle["textWrap"] | undefined {
  if (!bodyPr) return undefined;
  const wrapAttr = String(bodyPr["@_wrap"] || "")
    .trim()
    .toLowerCase();
  if (wrapAttr === "none") return "none";
  if (wrapAttr === "square") return "square";
  return undefined;
}

// ---------------------------------------------------------------------------
// Auto-fit mode
// ---------------------------------------------------------------------------

/**
 * Parse autofit mode from `a:bodyPr` child elements.
 *
 * - `a:spAutoFit` → `{ autoFit: true, autoFitMode: "shrink" }`
 * - `a:normAutofit` → `{ autoFit: true, autoFitMode: "normal" }` with optional fontScale and lnSpcReduction
 * - `a:noAutofit` → `{ autoFit: false, autoFitMode: "none" }`
 */
export function parseBodyAutofit(
  bodyPr: XmlObject | undefined,
): Pick<
  TextStyle,
  | "autoFit"
  | "autoFitMode"
  | "autoFitFontScale"
  | "autoFitLineSpacingReduction"
> {
  const result: Pick<
    TextStyle,
    | "autoFit"
    | "autoFitMode"
    | "autoFitFontScale"
    | "autoFitLineSpacingReduction"
  > = {};
  if (!bodyPr) return result;

  if (bodyPr["a:spAutoFit"] !== undefined) {
    result.autoFit = true;
    result.autoFitMode = "shrink";
  } else if (bodyPr["a:normAutofit"] !== undefined) {
    result.autoFit = true;
    result.autoFitMode = "normal";
    const normAutofit = bodyPr["a:normAutofit"] as Record<string, unknown>;
    const fontScaleRaw = parseInt(
      String(normAutofit?.["@_fontScale"] || ""),
      10,
    );
    if (Number.isFinite(fontScaleRaw) && fontScaleRaw > 0) {
      result.autoFitFontScale = fontScaleRaw / 100000;
    }
    const lnSpcReductionRaw = parseInt(
      String(normAutofit?.["@_lnSpcReduction"] || ""),
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

// ---------------------------------------------------------------------------
// Column spacing
// ---------------------------------------------------------------------------

/**
 * Parse column spacing from `a:bodyPr/@spcCol` (EMU → px).
 */
export function parseBodyColumnSpacing(
  bodyPr: XmlObject | undefined,
): number | undefined {
  if (!bodyPr) return undefined;
  const spcColRaw = parseInt(String(bodyPr["@_spcCol"] || ""), 10);
  if (Number.isFinite(spcColRaw) && spcColRaw > 0) {
    return spcColRaw / EMU_PER_PX;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Overflow modes
// ---------------------------------------------------------------------------

/**
 * Parse horizontal overflow from `a:bodyPr/@hOverflow`.
 */
export function parseBodyHOverflow(
  bodyPr: XmlObject | undefined,
): TextStyle["hOverflow"] | undefined {
  if (!bodyPr) return undefined;
  const val = String(bodyPr["@_hOverflow"] || "").trim();
  if (val === "overflow" || val === "clip") return val;
  return undefined;
}

/**
 * Parse vertical overflow from `a:bodyPr/@vertOverflow`.
 */
export function parseBodyVertOverflow(
  bodyPr: XmlObject | undefined,
): TextStyle["vertOverflow"] | undefined {
  if (!bodyPr) return undefined;
  const val = String(bodyPr["@_vertOverflow"] || "").trim();
  if (val === "overflow" || val === "clip" || val === "ellipsis") return val;
  return undefined;
}
