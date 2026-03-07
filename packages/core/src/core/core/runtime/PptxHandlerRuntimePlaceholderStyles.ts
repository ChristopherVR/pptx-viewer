import { XmlObject, PlaceholderTextLevelStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSlideUtils";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse a single `a:lvlXpPr` node into a structured
   * {@link PlaceholderTextLevelStyle}.
   */
  protected parsePlaceholderLevelStyle(
    levelProps: XmlObject | undefined,
  ): PlaceholderTextLevelStyle | null {
    if (!levelProps) return null;

    const style: PlaceholderTextLevelStyle = {};

    // Paragraph-level properties
    const alignRaw = String(levelProps["@_algn"] || "")
      .trim()
      .toLowerCase();
    if (alignRaw.length > 0) {
      const alignMap: Record<string, string> = {
        l: "left",
        ctr: "center",
        r: "right",
        just: "justify",
      };
      style.alignment = alignMap[alignRaw] ?? alignRaw;
    }

    const marLRaw = levelProps["@_marL"];
    if (marLRaw !== undefined) {
      const marL = Number.parseInt(String(marLRaw), 10);
      if (Number.isFinite(marL)) {
        style.marginLeft = marL / PptxHandlerRuntime.EMU_PER_PX;
      }
    }

    const indentRaw = levelProps["@_indent"];
    if (indentRaw !== undefined) {
      const indent = Number.parseInt(String(indentRaw), 10);
      if (Number.isFinite(indent)) {
        style.indent = indent / PptxHandlerRuntime.EMU_PER_PX;
      }
    }

    // Line spacing
    const lnSpc = levelProps["a:lnSpc"] as XmlObject | undefined;
    if (lnSpc) {
      const multiplier = this.parseLineSpacingMultiplier(lnSpc);
      if (multiplier !== undefined) {
        style.lineSpacing = multiplier;
      } else {
        const exactPt = this.parseLineSpacingExactPt(lnSpc);
        if (exactPt !== undefined) {
          style.lineSpacingExactPt = exactPt;
        }
      }
    }

    // Spacing before / after
    const spcBef = this.parseParagraphSpacingPx(
      levelProps["a:spcBef"] as XmlObject | undefined,
    );
    if (spcBef !== undefined) style.spaceBefore = spcBef;

    const spcAft = this.parseParagraphSpacingPx(
      levelProps["a:spcAft"] as XmlObject | undefined,
    );
    if (spcAft !== undefined) style.spaceAfter = spcAft;

    // Bullet properties
    const buChar = levelProps["a:buChar"] as XmlObject | undefined;
    if (buChar?.["@_char"]) {
      style.bulletChar = String(buChar["@_char"]);
    }

    const buAutoNum = levelProps["a:buAutoNum"] as XmlObject | undefined;
    if (buAutoNum?.["@_type"]) {
      style.bulletAutoNumType = String(buAutoNum["@_type"]);
    }

    const buFont = levelProps["a:buFont"] as XmlObject | undefined;
    if (buFont?.["@_typeface"]) {
      style.bulletFontFamily = String(buFont["@_typeface"]);
    }

    const buSzPct = levelProps["a:buSzPct"] as XmlObject | undefined;
    if (buSzPct?.["@_val"] !== undefined) {
      const pctRaw = Number.parseInt(String(buSzPct["@_val"]), 10);
      if (Number.isFinite(pctRaw)) {
        style.bulletSizePercent = pctRaw / 1000;
      }
    }

    // Bullet colour
    const buClr = levelProps["a:buClr"] as XmlObject | undefined;
    if (buClr) {
      const srgb = buClr["a:srgbClr"] as XmlObject | undefined;
      if (srgb?.["@_val"]) {
        style.bulletColor = String(srgb["@_val"]);
      }
    }

    // Bullet size in points
    const buSzPts = levelProps["a:buSzPts"] as XmlObject | undefined;
    if (buSzPts?.["@_val"] !== undefined) {
      const ptsRaw = Number.parseInt(String(buSzPts["@_val"]), 10);
      if (Number.isFinite(ptsRaw)) {
        style.bulletSizePts = ptsRaw / 100;
      }
    }

    // Bullet suppression
    if (levelProps["a:buNone"]) {
      style.bulletNone = true;
    }

    // Default run properties (font, size, bold, italic, color)
    const defRPr = levelProps["a:defRPr"] as XmlObject | undefined;
    if (defRPr) {
      if (defRPr["@_sz"] !== undefined) {
        const hundredths = Number.parseInt(String(defRPr["@_sz"]), 10);
        if (Number.isFinite(hundredths)) {
          style.fontSize = (hundredths / 100) * (96 / 72);
        }
      }
      if (defRPr["@_b"] !== undefined) {
        style.bold = defRPr["@_b"] === "1" || defRPr["@_b"] === true;
      }
      if (defRPr["@_i"] !== undefined) {
        style.italic = defRPr["@_i"] === "1" || defRPr["@_i"] === true;
      }

      const color = this.parseColor(
        defRPr["a:solidFill"] as XmlObject | undefined,
      );
      if (color) style.color = color;

      const latin = defRPr["a:latin"] as XmlObject | undefined;
      if (latin?.["@_typeface"]) {
        const typeface = String(latin["@_typeface"]);
        const resolved = this.resolveThemeTypeface(typeface);
        style.fontFamily = resolved ?? typeface;
      }
    }

    // Return null if nothing useful was captured
    const hasValues = Object.keys(style).length > 0;
    return hasValues ? style : null;
  }
}
