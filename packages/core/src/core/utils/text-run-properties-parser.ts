/**
 * Standalone parser utilities for `a:rPr` (text run properties) XML nodes.
 *
 * Extracts the pure parsing logic from the PptxHandlerRuntime mixin chain
 * into exported, testable functions.  Each function accepts a fast-xml-parser
 * object (attributes prefixed with `@_`) and returns populated fields on a
 * {@link TextStyle}.
 *
 * @module text-run-properties-parser
 */

import type { TextStyle, XmlObject } from "../types";
import type { UnderlineStyle } from "../types/common";

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

// ---------------------------------------------------------------------------
// Core run-property parsing
// ---------------------------------------------------------------------------

/**
 * Parse scalar run-level attributes from an `a:rPr` XML object.
 *
 * Handles: `@_sz`, `@_b`, `@_i`, `@_u`, `@_strike`, `@_cap`, `@_baseline`,
 * `@_kern`, `@_spc`, `@_lang`, `@_rtl`, `@_normalizeH`, `@_noProof`,
 * `@_dirty`, `@_err`, `@_smtClean`, `@_bmk`.
 */
export function parseRunPropertyAttributes(
  rPr: XmlObject | undefined,
): TextStyle {
  const style: TextStyle = {};
  if (!rPr) return style;

  // Font size — hundredths of a point → points → px (at 96 dpi)
  if (rPr["@_sz"] !== undefined) {
    const hundredths = parseInt(String(rPr["@_sz"]), 10);
    if (Number.isFinite(hundredths)) {
      const points = hundredths / 100;
      style.fontSize = points * (96 / 72);
    }
  }

  // Bold / Italic
  if (rPr["@_b"] !== undefined) {
    style.bold = rPr["@_b"] === "1";
  }
  if (rPr["@_i"] !== undefined) {
    style.italic = rPr["@_i"] === "1";
  }

  // Underline
  if (rPr["@_u"] !== undefined) {
    const underlineToken = String(rPr["@_u"] || "")
      .trim()
      .toLowerCase();
    style.underline =
      underlineToken.length > 0 &&
      underlineToken !== "none" &&
      underlineToken !== "0" &&
      underlineToken !== "false";
    if (style.underline) {
      const rawU = String(rPr["@_u"] || "").trim();
      if (rawU.length > 0 && rawU !== "none") {
        style.underlineStyle = rawU as UnderlineStyle;
      }
    }
  }

  // Strikethrough
  if (rPr["@_strike"] !== undefined) {
    const strikeToken = String(rPr["@_strike"] || "")
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

  // Text capitalization
  const capAttr = String(rPr["@_cap"] || "")
    .trim()
    .toLowerCase();
  if (capAttr === "all" || capAttr === "small") {
    style.textCaps = capAttr;
  }

  // Superscript / subscript baseline shift (thousandths of percent)
  if (rPr["@_baseline"] !== undefined) {
    const baselineVal = Number.parseInt(String(rPr["@_baseline"]), 10);
    if (Number.isFinite(baselineVal) && baselineVal !== 0) {
      style.baseline = baselineVal;
    }
  }

  // Character spacing (hundredths of a point)
  if (rPr["@_spc"] !== undefined) {
    const spcVal = Number.parseInt(String(rPr["@_spc"]), 10);
    if (Number.isFinite(spcVal)) {
      style.characterSpacing = spcVal;
    }
  }

  // Kerning threshold
  if (rPr["@_kern"] !== undefined) {
    const kernVal = Number.parseInt(String(rPr["@_kern"]), 10);
    if (Number.isFinite(kernVal)) {
      style.kerning = kernVal;
    }
  }

  // Language
  const langAttr = String(rPr["@_lang"] || "").trim();
  if (langAttr) {
    style.language = langAttr;
  }

  // RTL
  const runRtl = parseBoolAttr(rPr["@_rtl"]);
  if (runRtl !== undefined) {
    style.rtl = runRtl;
  }

  // Metadata flags
  const normalizeH = parseBoolAttr(rPr["@_normalizeH"]);
  if (normalizeH !== undefined) style.normalizeHeight = normalizeH;
  const noProof = parseBoolAttr(rPr["@_noProof"]);
  if (noProof !== undefined) style.noProof = noProof;
  const dirty = parseBoolAttr(rPr["@_dirty"]);
  if (dirty !== undefined) style.dirty = dirty;
  const err = parseBoolAttr(rPr["@_err"]);
  if (err !== undefined) style.spellingError = err;
  const smtClean = parseBoolAttr(rPr["@_smtClean"]);
  if (smtClean !== undefined) style.smartTagClean = smtClean;
  const bmk = String(rPr["@_bmk"] || "").trim();
  if (bmk) style.bookmark = bmk;

  return style;
}

/**
 * Parse font family child elements from `a:rPr`.
 *
 * Extracts `a:latin`, `a:ea`, `a:cs` typeface attributes.
 * Returns the primary font family (latin > ea > cs) plus per-script families.
 */
export function parseRunFontElements(
  rPr: XmlObject | undefined,
): Pick<TextStyle, "fontFamily" | "eastAsiaFont" | "complexScriptFont"> {
  const result: Pick<
    TextStyle,
    "fontFamily" | "eastAsiaFont" | "complexScriptFont"
  > = {};
  if (!rPr) return result;

  const latin = rPr["a:latin"];
  const eastAsian = rPr["a:ea"];
  const complexScript = rPr["a:cs"];

  const chosenTypeface =
    latin?.["@_typeface"] ||
    eastAsian?.["@_typeface"] ||
    complexScript?.["@_typeface"];

  if (typeof chosenTypeface === "string" && chosenTypeface.trim().length > 0) {
    result.fontFamily = chosenTypeface.trim();
  }

  if (
    typeof eastAsian?.["@_typeface"] === "string" &&
    eastAsian["@_typeface"].trim().length > 0
  ) {
    result.eastAsiaFont = eastAsian["@_typeface"].trim();
  }

  if (
    typeof complexScript?.["@_typeface"] === "string" &&
    complexScript["@_typeface"].trim().length > 0
  ) {
    result.complexScriptFont = complexScript["@_typeface"].trim();
  }

  return result;
}

/**
 * Parse underline colour from `a:uFill` or `a:uLn` child elements.
 *
 * Extracts a hex colour string from the solidFill inside `a:uFill` or
 * `a:uLn`.  This is a simplified extraction — the full runtime uses the
 * theme-aware `parseColor` method; this standalone function only handles
 * `a:srgbClr/@_val` for direct testing.
 */
export function parseRunUnderlineColor(
  rPr: XmlObject | undefined,
): string | undefined {
  if (!rPr) return undefined;

  const uFill = rPr["a:uFill"] as XmlObject | undefined;
  const uLn = rPr["a:uLn"] as XmlObject | undefined;
  const fillSource = uFill?.["a:solidFill"] || uLn?.["a:solidFill"];
  if (!fillSource) return undefined;

  const srgb = (fillSource as XmlObject)["a:srgbClr"] as
    | XmlObject
    | undefined;
  if (srgb?.["@_val"]) {
    return String(srgb["@_val"]);
  }
  return undefined;
}

/**
 * Parse text outline from `a:ln` child element.
 */
export function parseRunTextOutline(
  rPr: XmlObject | undefined,
): Pick<TextStyle, "textOutlineWidth" | "textOutlineColor"> {
  const result: Pick<TextStyle, "textOutlineWidth" | "textOutlineColor"> = {};
  if (!rPr) return result;

  const textLn = rPr["a:ln"] as XmlObject | undefined;
  if (!textLn) return result;

  const textOutlineW = Number.parseInt(String(textLn["@_w"] || ""), 10);
  if (Number.isFinite(textOutlineW) && textOutlineW > 0) {
    result.textOutlineWidth = textOutlineW / EMU_PER_PX;
  }

  const solidFill = textLn["a:solidFill"] as XmlObject | undefined;
  if (solidFill) {
    const srgb = solidFill["a:srgbClr"] as XmlObject | undefined;
    if (srgb?.["@_val"]) {
      result.textOutlineColor = String(srgb["@_val"]);
    }
  }

  return result;
}

/**
 * Parse hyperlink from `a:hlinkClick` child element.
 *
 * Extracts relationship ID, tooltip, action, and additional attributes.
 * Does NOT resolve the relationship target (requires a relationship map).
 */
export function parseRunHyperlink(
  rPr: XmlObject | undefined,
): Pick<
  TextStyle,
  | "hyperlinkRId"
  | "hyperlinkTooltip"
  | "hyperlinkAction"
  | "hyperlinkInvalidUrl"
  | "hyperlinkTargetFrame"
  | "hyperlinkHistory"
  | "hyperlinkHighlightClick"
  | "hyperlinkEndSound"
> {
  const result: Pick<
    TextStyle,
    | "hyperlinkRId"
    | "hyperlinkTooltip"
    | "hyperlinkAction"
    | "hyperlinkInvalidUrl"
    | "hyperlinkTargetFrame"
    | "hyperlinkHistory"
    | "hyperlinkHighlightClick"
    | "hyperlinkEndSound"
  > = {};
  if (!rPr) return result;

  const hlinkClick = rPr["a:hlinkClick"] as XmlObject | undefined;
  if (!hlinkClick) return result;

  const rId = String(
    hlinkClick["@_r:id"] || hlinkClick["@_id"] || "",
  ).trim();
  if (rId.length > 0) {
    result.hyperlinkRId = rId;
  }

  const tooltip = String(hlinkClick["@_tooltip"] || "").trim();
  if (tooltip) result.hyperlinkTooltip = tooltip;

  const action = String(hlinkClick["@_action"] || "").trim();
  if (action) result.hyperlinkAction = action;

  const invalidUrl = String(hlinkClick["@_invalidUrl"] || "").trim();
  if (invalidUrl) result.hyperlinkInvalidUrl = invalidUrl;

  const tgtFrame = String(hlinkClick["@_tgtFrame"] || "").trim();
  if (tgtFrame) result.hyperlinkTargetFrame = tgtFrame;

  if (hlinkClick["@_history"] !== undefined) {
    const hVal = String(hlinkClick["@_history"]).trim().toLowerCase();
    result.hyperlinkHistory = hVal !== "0" && hVal !== "false";
  }

  if (hlinkClick["@_highlightClick"] !== undefined) {
    const hcVal = String(hlinkClick["@_highlightClick"])
      .trim()
      .toLowerCase();
    result.hyperlinkHighlightClick = hcVal === "1" || hcVal === "true";
  }

  if (hlinkClick["@_endSnd"] !== undefined) {
    const esVal = String(hlinkClick["@_endSnd"]).trim().toLowerCase();
    result.hyperlinkEndSound = esVal === "1" || esVal === "true";
  }

  return result;
}

/**
 * Parse solidFill colour from `a:solidFill` child element.
 * Only handles direct `a:srgbClr` for standalone use.
 */
export function parseRunSolidFillColor(
  rPr: XmlObject | undefined,
): string | undefined {
  if (!rPr) return undefined;
  const solidFill = rPr["a:solidFill"] as XmlObject | undefined;
  if (!solidFill) return undefined;

  const srgb = solidFill["a:srgbClr"] as XmlObject | undefined;
  if (srgb?.["@_val"]) {
    return String(srgb["@_val"]);
  }
  return undefined;
}

/**
 * Parse symbol font from `a:sym` child element.
 */
export function parseRunSymbolFont(
  rPr: XmlObject | undefined,
): string | undefined {
  if (!rPr) return undefined;
  const symNode = rPr["a:sym"];
  if (!symNode) return undefined;
  const typeface =
    typeof symNode["@_typeface"] === "string"
      ? symNode["@_typeface"].trim()
      : "";
  return typeface.length > 0 ? typeface : undefined;
}
