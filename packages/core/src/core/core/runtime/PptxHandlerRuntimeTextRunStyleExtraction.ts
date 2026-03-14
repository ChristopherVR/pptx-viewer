import { TextStyle, XmlObject } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTextRunEffects";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected extractTextRunStyle(
    runProperties: XmlObject | undefined,
    align: TextStyle["align"],
    relationshipMap?: Map<string, string>,
  ): TextStyle {
    const style: TextStyle = { align };
    if (!runProperties) {
      return style;
    }

    if (runProperties["@_sz"]) {
      const points = parseInt(runProperties["@_sz"]) / 100;
      style.fontSize = points * (96 / 72);
    }

    if (runProperties["@_b"] !== undefined) {
      style.bold = runProperties["@_b"] === "1";
    }
    if (runProperties["@_i"] !== undefined) {
      style.italic = runProperties["@_i"] === "1";
    }
    if (runProperties["@_u"] !== undefined) {
      const underlineToken = String(runProperties["@_u"] || "")
        .trim()
        .toLowerCase();
      style.underline =
        underlineToken.length > 0 &&
        underlineToken !== "none" &&
        underlineToken !== "0" &&
        underlineToken !== "false";
      // Preserve the specific underline style variant
      if (style.underline) {
        const rawU = String(runProperties["@_u"] || "").trim();
        if (rawU.length > 0 && rawU !== "none") {
          style.underlineStyle = rawU as TextStyle["underlineStyle"];
        }
      }
    }
    // Underline colour (a:uFill > a:solidFill or a:uLn > a:solidFill)
    const uFill = runProperties["a:uFill"] as XmlObject | undefined;
    const uLn = runProperties["a:uLn"] as XmlObject | undefined;
    const underlineColorSource = uFill?.["a:solidFill"] || uLn?.["a:solidFill"];
    if (underlineColorSource) {
      const underlineColor = this.parseColor(underlineColorSource as XmlObject);
      if (underlineColor) {
        style.underlineColor = underlineColor;
      }
    }
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
    // Text outline (a:rPr > a:ln)
    const textLn = runProperties["a:ln"] as XmlObject | undefined;
    if (textLn) {
      const textOutlineW = Number.parseInt(String(textLn["@_w"] || ""), 10);
      if (Number.isFinite(textOutlineW) && textOutlineW > 0) {
        style.textOutlineWidth = textOutlineW / PptxHandlerRuntime.EMU_PER_PX;
      }
      const textOutlineFill = textLn["a:solidFill"] as XmlObject | undefined;
      if (textOutlineFill) {
        const outlineColor = this.parseColor(textOutlineFill);
        if (outlineColor) {
          style.textOutlineColor = outlineColor;
        }
      }
    }
    // No fill on text run (a:rPr > a:noFill) — hollow/outline-only text
    if (runProperties["a:noFill"] !== undefined) {
      style.textFillNone = true;
    }
    // Superscript / subscript baseline shift (percentage)
    if (runProperties["@_baseline"] !== undefined) {
      const baselineVal = Number.parseInt(
        String(runProperties["@_baseline"]),
        10,
      );
      if (Number.isFinite(baselineVal) && baselineVal !== 0) {
        style.baseline = baselineVal;
      }
    }
    // Character spacing (hundredths of a point)
    if (runProperties["@_spc"] !== undefined) {
      const spcVal = Number.parseInt(String(runProperties["@_spc"]), 10);
      if (Number.isFinite(spcVal)) {
        style.characterSpacing = spcVal;
      }
    }
    // Kerning threshold
    if (runProperties["@_kern"] !== undefined) {
      const kernVal = Number.parseInt(String(runProperties["@_kern"]), 10);
      if (Number.isFinite(kernVal)) {
        style.kerning = kernVal;
      }
    }
    // Text highlight colour
    if (runProperties["a:highlight"]) {
      const highlightHex = this.parseColor(runProperties["a:highlight"]);
      if (highlightHex) {
        style.highlightColor = highlightHex;
      }
    }
    // Text fill variants (gradient/pattern on a:rPr)
    const textFillVariants = this.extractTextFillVariants(runProperties);
    if (textFillVariants.textFillGradient) {
      style.textFillGradient = textFillVariants.textFillGradient;
      style.textFillGradientStops = textFillVariants.textFillGradientStops;
      style.textFillGradientAngle = textFillVariants.textFillGradientAngle;
      style.textFillGradientType = textFillVariants.textFillGradientType;
    }
    if (textFillVariants.textFillPattern) {
      style.textFillPattern = textFillVariants.textFillPattern;
      style.textFillPatternForeground =
        textFillVariants.textFillPatternForeground;
      style.textFillPatternBackground =
        textFillVariants.textFillPatternBackground;
    }
    const runRtl = this.parseOptionalBooleanAttr(runProperties["@_rtl"]);
    if (runRtl !== undefined) {
      style.rtl = runRtl;
    }

    const latin = runProperties["a:latin"];
    const eastAsian = runProperties["a:ea"];
    const complexScript = runProperties["a:cs"];
    const chosenTypeface =
      latin?.["@_typeface"] ||
      eastAsian?.["@_typeface"] ||
      complexScript?.["@_typeface"];
    const resolvedTypeface = this.resolveThemeTypeface(
      typeof chosenTypeface === "string" ? chosenTypeface : undefined,
    );
    if (resolvedTypeface) {
      style.fontFamily = resolvedTypeface;
    }

    // Store per-script font families for Unicode font fallback
    const eaTypeface = this.resolveThemeTypeface(
      typeof eastAsian?.["@_typeface"] === "string"
        ? eastAsian["@_typeface"]
        : undefined,
    );
    if (eaTypeface) {
      style.eastAsiaFont = eaTypeface;
    }
    const csTypeface = this.resolveThemeTypeface(
      typeof complexScript?.["@_typeface"] === "string"
        ? complexScript["@_typeface"]
        : undefined,
    );
    if (csTypeface) {
      style.complexScriptFont = csTypeface;
    }

    const solidFill = runProperties["a:solidFill"];
    if (solidFill) {
      style.color = this.parseColor(solidFill);
    }

    // Hyperlinks (a:hlinkClick, a:hlinkMouseOver)
    this.applyHyperlinkStyle(style, runProperties, relationshipMap);

    // Text caps (@cap)
    const capAttr = String(runProperties["@_cap"] || "")
      .trim()
      .toLowerCase();
    if (capAttr === "all" || capAttr === "small") {
      style.textCaps = capAttr;
    }

    // Symbol font (a:sym)
    const symNode = runProperties["a:sym"];
    if (symNode) {
      const symTypeface = this.normalizeTypefaceToken(
        typeof symNode["@_typeface"] === "string" ? symNode["@_typeface"] : "",
      );
      if (symTypeface) {
        style.symbolFont = symTypeface;
      }
    }

    // Language (@lang)
    const langAttr = String(runProperties["@_lang"] || "").trim();
    if (langAttr) {
      style.language = langAttr;
    }

    // Run metadata attributes
    const normalizeH = this.parseOptionalBooleanAttr(runProperties["@_normalizeH"]);
    if (normalizeH !== undefined) style.normalizeHeight = normalizeH;
    const noProof = this.parseOptionalBooleanAttr(runProperties["@_noProof"]);
    if (noProof !== undefined) style.noProof = noProof;
    const dirty = this.parseOptionalBooleanAttr(runProperties["@_dirty"]);
    if (dirty !== undefined) style.dirty = dirty;
    const err = this.parseOptionalBooleanAttr(runProperties["@_err"]);
    if (err !== undefined) style.spellingError = err;
    const smtClean = this.parseOptionalBooleanAttr(runProperties["@_smtClean"]);
    if (smtClean !== undefined) style.smartTagClean = smtClean;
    const bmk = String(runProperties["@_bmk"] || "").trim();
    if (bmk) style.bookmark = bmk;

    // Text run effects (a:effectLst on a:rPr)
    const runEffectList = runProperties["a:effectLst"] as XmlObject | undefined;
    if (runEffectList) {
      this.applyTextRunEffects(style, runEffectList);
    }

    return style;
  }
}
