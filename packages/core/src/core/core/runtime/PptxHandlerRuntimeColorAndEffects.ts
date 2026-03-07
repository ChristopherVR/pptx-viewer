import {
  XmlObject,
  ShapeStyle,
  StrokeDashType,
  ConnectorArrowType,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSlideParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Forward declaration – implemented in PptxHandlerRuntimeThemeProcessing.
   * Re-resolves gradient stops by substituting `phClr` with the given colour.
   */
  protected reResolveGradientWithPhClr(
    _gradNode: XmlObject,
    _phClrValue: string,
  ): {
    stops: NonNullable<ShapeStyle["fillGradientStops"]>;
    css: string | undefined;
  } {
    throw new Error("reResolveGradientWithPhClr not yet initialised");
  }

  /**
   * Forward declaration – implemented in PptxHandlerRuntimeThemeProcessing.
   * Parses a layout-level colour map override.
   */
  protected parseLayoutClrMapOverride(
    _layoutXml: XmlObject,
  ): Record<string, string> | null {
    throw new Error("parseLayoutClrMapOverride not yet initialised");
  }

  protected getDefaultSchemeColorMap(): Record<string, string> {
    return {
      dk1: "#000000",
      lt1: "#FFFFFF",
      dk2: "#1F497D",
      lt2: "#EEECE1",
      accent1: "#4472C4",
      accent2: "#ED7D31",
      accent3: "#A5A5A5",
      accent4: "#FFC000",
      accent5: "#5B9BD5",
      accent6: "#70AD47",
      hlink: "#0563C1",
      folHlink: "#954F72",
      tx1: "#000000",
      tx2: "#44546A",
      bg1: "#FFFFFF",
      bg2: "#E7E6E6",
    };
  }

  protected resolveThemeColor(schemeKey: string): string | undefined {
    const normalized = schemeKey.trim().toLowerCase();
    if (!normalized) return undefined;

    // Placeholder colors in style refs typically map through accent1.
    const resolvedKey = normalized === "phclr" ? "accent1" : normalized;

    // When a per-slide colour map override is active, remap the logical
    // colour name to the theme slot it points to before looking up the
    // actual colour value.  For example the override may map "bg1" to
    // "dk1" which swaps the background to a dark colour.
    if (this.currentSlideClrMapOverride) {
      const remapped = this.currentSlideClrMapOverride[resolvedKey];
      if (remapped) {
        return (
          this.themeColorMap[remapped] ||
          this.getDefaultSchemeColorMap()[remapped]
        );
      }
    }

    return (
      this.themeColorMap[resolvedKey] ||
      this.getDefaultSchemeColorMap()[resolvedKey]
    );
  }

  protected normalizeStrokeDashType(
    value: unknown,
  ): StrokeDashType | undefined {
    const normalized = String(value ?? "").trim();
    if (normalized.length === 0) return undefined;

    const canonicalMap: Record<string, StrokeDashType> = {
      solid: "solid",
      dot: "dot",
      dash: "dash",
      lgdash: "lgDash",
      dashdot: "dashDot",
      lgdashdot: "lgDashDot",
      lgdashdotdot: "lgDashDotDot",
      sysdot: "sysDot",
      sysdash: "sysDash",
      sysdashdot: "sysDashDot",
      sysdashdotdot: "sysDashDotDot",
      custom: "custom",
    };

    return canonicalMap[normalized.toLowerCase()];
  }

  protected normalizeConnectorArrowType(
    value: unknown,
  ): ConnectorArrowType | undefined {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return undefined;
    if (
      normalized === "none" ||
      normalized === "triangle" ||
      normalized === "stealth" ||
      normalized === "diamond" ||
      normalized === "oval" ||
      normalized === "arrow"
    ) {
      return normalized;
    }
    return undefined;
  }

  protected extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractBlurStyle(shapeProps);
  }

  protected extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractEffectDagStyle(shapeProps);
  }

  protected extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractReflectionStyle(shapeProps);
  }

  protected extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractSoftEdgeStyle(shapeProps);
  }

  protected extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractGlowStyle(shapeProps);
  }

  protected extractInnerShadowStyle(
    shapeProps: XmlObject,
  ): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractInnerShadowStyle(shapeProps);
  }

  protected extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.colorStyleCodec.extractShadowStyle(shapeProps);
  }

  protected extractGradientFillCss(gradFill: XmlObject): string | undefined {
    return this.colorStyleCodec.extractGradientFillCss(gradFill);
  }

  protected buildGradientCssFromStops(
    stops: NonNullable<ShapeStyle["fillGradientStops"]>,
    type: NonNullable<ShapeStyle["fillGradientType"]>,
    angle: number,
  ): string | undefined {
    return this.colorStyleCodec.buildGradientCssFromStops(stops, type, angle);
  }

  protected extractGradientAngle(gradFill: XmlObject): number {
    return this.colorStyleCodec.extractGradientAngle(gradFill);
  }

  protected extractGradientType(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientType"]> {
    return this.colorStyleCodec.extractGradientType(gradFill);
  }

  protected extractGradientStops(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientStops"]> {
    return this.colorStyleCodec.extractGradientStops(gradFill);
  }

  protected extractGradientOpacity(gradFill: XmlObject): number | undefined {
    return this.colorStyleCodec.extractGradientOpacity(gradFill);
  }

  protected parseColorChoice(
    colorChoice: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    return this.colorStyleCodec.parseColorChoice(colorChoice, placeholderColor);
  }
}
