import {
  XmlObject,
  TextStyle,
  PlaceholderDefaults,
  PlaceholderTextLevelStyle,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeShapeImageFill";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Apply {@link PlaceholderDefaults} body-level properties to a
   * {@link TextStyle} as fallback values (only sets fields that are
   * still `undefined`).
   */
  protected applyPlaceholderBodyDefaults(
    textStyle: TextStyle,
    defaults: PlaceholderDefaults,
  ): void {
    if (
      textStyle.bodyInsetLeft === undefined &&
      defaults.bodyInsetLeft !== undefined
    ) {
      textStyle.bodyInsetLeft = defaults.bodyInsetLeft;
    }
    if (
      textStyle.bodyInsetTop === undefined &&
      defaults.bodyInsetTop !== undefined
    ) {
      textStyle.bodyInsetTop = defaults.bodyInsetTop;
    }
    if (
      textStyle.bodyInsetRight === undefined &&
      defaults.bodyInsetRight !== undefined
    ) {
      textStyle.bodyInsetRight = defaults.bodyInsetRight;
    }
    if (
      textStyle.bodyInsetBottom === undefined &&
      defaults.bodyInsetBottom !== undefined
    ) {
      textStyle.bodyInsetBottom = defaults.bodyInsetBottom;
    }
    if (textStyle.vAlign === undefined && defaults.textAnchor) {
      const vAlign = this.textVerticalAlignFromDrawingValue(
        defaults.textAnchor,
      );
      if (vAlign) textStyle.vAlign = vAlign;
    }
    if (textStyle.autoFit === undefined && defaults.autoFit !== undefined) {
      textStyle.autoFit = defaults.autoFit;
    }
    if (textStyle.textWrap === undefined && defaults.textWrap) {
      textStyle.textWrap = defaults.textWrap as TextStyle["textWrap"];
    }
  }

  protected pointsToPixels(points: number): number {
    return points * (96 / 72);
  }

  protected parseParagraphSpacingPx(
    spacingNode: XmlObject | undefined,
  ): number | undefined {
    if (!spacingNode) return undefined;
    const spacingPointsRaw = Number.parseInt(
      String(
        (spacingNode["a:spcPts"] as XmlObject | undefined)?.["@_val"] || "",
      ),
      10,
    );
    if (Number.isFinite(spacingPointsRaw)) {
      return this.pointsToPixels(spacingPointsRaw / 100);
    }
    return undefined;
  }

  protected parseLineSpacingMultiplier(
    lineSpacingNode: XmlObject | undefined,
  ): number | undefined {
    if (!lineSpacingNode) return undefined;
    const spacingPercentRaw = Number.parseInt(
      String(
        (lineSpacingNode["a:spcPct"] as XmlObject | undefined)?.["@_val"] || "",
      ),
      10,
    );
    if (Number.isFinite(spacingPercentRaw)) {
      return Math.max(0.1, Math.min(5, spacingPercentRaw / 100000));
    }
    return undefined;
  }

  /**
   * Parse exact line spacing in points from `a:lnSpc > a:spcPts`.
   * Returns the value in points (hundredths-of-pt divided by 100).
   */
  protected parseLineSpacingExactPt(
    lineSpacingNode: XmlObject | undefined,
  ): number | undefined {
    if (!lineSpacingNode) return undefined;
    const spcPtsRaw = Number.parseInt(
      String(
        (lineSpacingNode["a:spcPts"] as XmlObject | undefined)?.["@_val"] || "",
      ),
      10,
    );
    if (Number.isFinite(spcPtsRaw) && spcPtsRaw > 0) {
      return spcPtsRaw / 100;
    }
    return undefined;
  }

  /**
   * Apply level-specific {@link PlaceholderTextLevelStyle} properties to a
   * {@link TextStyle} as fallback values for paragraph-level fields.
   */
  protected applyPlaceholderLevelDefaults(
    textStyle: TextStyle,
    levelStyle: PlaceholderTextLevelStyle,
  ): void {
    if (
      textStyle.fontFamily === undefined &&
      levelStyle.fontFamily !== undefined
    ) {
      textStyle.fontFamily = levelStyle.fontFamily;
    }
    if (textStyle.fontSize === undefined && levelStyle.fontSize !== undefined) {
      textStyle.fontSize = levelStyle.fontSize;
    }
    if (textStyle.bold === undefined && levelStyle.bold !== undefined) {
      textStyle.bold = levelStyle.bold;
    }
    if (textStyle.italic === undefined && levelStyle.italic !== undefined) {
      textStyle.italic = levelStyle.italic;
    }
    if (textStyle.color === undefined && levelStyle.color !== undefined) {
      textStyle.color = levelStyle.color;
    }
    if (
      textStyle.paragraphMarginLeft === undefined &&
      levelStyle.marginLeft !== undefined
    ) {
      textStyle.paragraphMarginLeft = levelStyle.marginLeft;
    }
    if (
      textStyle.paragraphIndent === undefined &&
      levelStyle.indent !== undefined
    ) {
      textStyle.paragraphIndent = levelStyle.indent;
    }
    if (
      textStyle.lineSpacing === undefined &&
      textStyle.lineSpacingExactPt === undefined
    ) {
      if (levelStyle.lineSpacing !== undefined) {
        textStyle.lineSpacing = levelStyle.lineSpacing;
      } else if (levelStyle.lineSpacingExactPt !== undefined) {
        textStyle.lineSpacingExactPt = levelStyle.lineSpacingExactPt;
      }
    }
    if (
      textStyle.paragraphSpacingBefore === undefined &&
      levelStyle.spaceBefore !== undefined
    ) {
      textStyle.paragraphSpacingBefore = levelStyle.spaceBefore;
    }
    if (
      textStyle.paragraphSpacingAfter === undefined &&
      levelStyle.spaceAfter !== undefined
    ) {
      textStyle.paragraphSpacingAfter = levelStyle.spaceAfter;
    }
    if (textStyle.align === undefined && levelStyle.alignment !== undefined) {
      textStyle.align = levelStyle.alignment as TextStyle["align"];
    }
  }
}
