import { XmlObject, ShapeStyle, type PptxThemeFillStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeThemeOverrides";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Resolve a `a:effectRef` element into concrete effect properties
   * by looking up `@_idx` in the theme format scheme's effect style list.
   */
  protected resolveThemeEffectRef(refNode: XmlObject, style: ShapeStyle): void {
    const idx = parseInt(String(refNode["@_idx"] || "0"), 10);
    if (
      !Number.isFinite(idx) ||
      idx <= 0 ||
      !this.themeFormatScheme ||
      idx > this.themeFormatScheme.effectStyles.length
    ) {
      return; // No fallback for effects — they simply don't render
    }

    const effectDef = this.themeFormatScheme.effectStyles[idx - 1];
    if (!effectDef) return;

    // Apply shadow (only if no explicit shadow was already set)
    if (effectDef.shadowColor && !style.shadowColor) {
      style.shadowColor = effectDef.shadowColor;
      style.shadowBlur = effectDef.shadowBlur;
      style.shadowOffsetX = effectDef.shadowOffsetX;
      style.shadowOffsetY = effectDef.shadowOffsetY;
      style.shadowOpacity = effectDef.shadowOpacity;
    }

    // Apply inner shadow
    if (effectDef.innerShadowColor && !style.innerShadowColor) {
      style.innerShadowColor = effectDef.innerShadowColor;
      style.innerShadowBlur = effectDef.innerShadowBlur;
      style.innerShadowOffsetX = effectDef.innerShadowOffsetX;
      style.innerShadowOffsetY = effectDef.innerShadowOffsetY;
      style.innerShadowOpacity = effectDef.innerShadowOpacity;
    }

    // Apply glow
    if (effectDef.glowColor && !style.glowColor) {
      style.glowColor = effectDef.glowColor;
      style.glowRadius = effectDef.glowRadius;
      style.glowOpacity = effectDef.glowOpacity;
    }

    // Apply soft edge
    if (effectDef.softEdgeRadius && !style.softEdgeRadius) {
      style.softEdgeRadius = effectDef.softEdgeRadius;
    }
  }

  /**
   * Resolve a `a:lnRef` element into concrete stroke properties by
   * looking up `@_idx` in the theme format scheme's line style list.
   */
  protected resolveThemeLineRef(refNode: XmlObject, style: ShapeStyle): void {
    const idx = parseInt(String(refNode["@_idx"] || "0"), 10);
    const overrideColor = this.parseColor(refNode);

    if (
      !Number.isFinite(idx) ||
      idx <= 0 ||
      !this.themeFormatScheme ||
      idx > this.themeFormatScheme.lineStyles.length
    ) {
      // Fallback to pre-existing behaviour
      style.strokeColor = overrideColor;
      if (overrideColor) {
        style.strokeWidth = 1;
      }
      return;
    }

    const lineDef = this.themeFormatScheme.lineStyles[idx - 1];
    if (!lineDef) {
      style.strokeColor = overrideColor;
      if (overrideColor) {
        style.strokeWidth = 1;
      }
      return;
    }

    // Apply line properties from the format scheme
    style.strokeColor = overrideColor || lineDef.color;
    if (lineDef.opacity !== undefined) {
      style.strokeOpacity = lineDef.opacity;
    }
    if (lineDef.width !== undefined && lineDef.width > 0) {
      style.strokeWidth = lineDef.width;
    } else if (style.strokeColor) {
      style.strokeWidth = 1;
    }
    if (lineDef.dash) {
      style.strokeDash = lineDef.dash as ShapeStyle["strokeDash"];
    }
    if (lineDef.lineJoin) {
      style.lineJoin = lineDef.lineJoin;
    }
    if (lineDef.lineCap) {
      style.lineCap = lineDef.lineCap;
    }
    if (lineDef.compoundLine) {
      style.compoundLine = lineDef.compoundLine;
    }
  }

  /**
   * Re-resolve a gradient fill's stops by substituting `phClr` occurrences
   * with the given override colour.  When the gradient node contains
   * `a:schemeClr @val="phClr"`, the override colour is injected.
   */
  protected reResolveGradientWithPhClr(
    gradNode: XmlObject,
    phClrValue: string,
  ): {
    stops: NonNullable<ShapeStyle["fillGradientStops"]>;
    css: string | undefined;
  } {
    // Temporarily inject the phClr mapping so that parseColor resolves it
    const prevPhClr = this.themeColorMap["phclr"];
    this.themeColorMap["phclr"] = phClrValue;

    const stops = this.extractGradientStops(gradNode);
    const type = this.extractGradientType(gradNode);
    const angle = this.extractGradientAngle(gradNode);
    const css = this.buildGradientCssFromStops(stops, type, angle);

    // Restore
    if (prevPhClr !== undefined) {
      this.themeColorMap["phclr"] = prevPhClr;
    } else {
      delete this.themeColorMap["phclr"];
    }

    return { stops, css };
  }

  /**
   * Resolve a `a:fillRef` element into concrete {@link ShapeStyle} fill
   * properties by looking up the 1-based `@_idx` in the theme's format
   * scheme fill style list.
   *
   * Per the OOXML spec:
   * - idx 1-3 → fillStyleLst[idx-1]
   * - idx 1001-1003 → bgFillStyleLst[idx-1001]
   *
   * The colour child of the ref (e.g. `a:schemeClr`) acts as a
   * "placeholder colour" (`phClr`) override for `phClr` tokens inside
   * the fill definition.
   */
  protected resolveThemeFillRef(refNode: XmlObject, style: ShapeStyle): void {
    const idx = parseInt(String(refNode["@_idx"] || "0"), 10);
    if (!Number.isFinite(idx) || idx <= 0 || !this.themeFormatScheme) {
      // Fallback: just use the colour child (pre-existing behaviour)
      style.fillMode = "theme";
      style.fillColor = this.parseColor(refNode);
      return;
    }

    // Determine which list and which 0-based offset
    let fillDef: PptxThemeFillStyle | undefined;
    if (idx >= 1001) {
      const offset = idx - 1001;
      fillDef = this.themeFormatScheme.backgroundFillStyles[offset];
    } else {
      fillDef = this.themeFormatScheme.fillStyles[idx - 1];
    }

    if (!fillDef) {
      style.fillMode = "theme";
      style.fillColor = this.parseColor(refNode);
      return;
    }

    // The colour child of the ref element serves as phClr override.
    // We resolve it for use when the fill definition contains phClr tokens.
    const overrideColor = this.parseColor(refNode);

    switch (fillDef.kind) {
      case "solid": {
        style.fillMode = "solid";
        // Use the override colour when the fill definition's colour is
        // phClr-dependent (stored as undefined) or when the ref supplies one.
        style.fillColor = overrideColor || fillDef.color;
        style.fillOpacity = fillDef.opacity;
        break;
      }
      case "gradient": {
        style.fillMode = "gradient";
        // For phClr gradients re-resolve stops with the override colour.
        if (fillDef.rawNode && overrideColor) {
          const reresolved = this.reResolveGradientWithPhClr(
            fillDef.rawNode as XmlObject,
            overrideColor,
          );
          style.fillGradientStops = reresolved.stops;
          style.fillGradient = reresolved.css;
        } else {
          style.fillGradientStops = fillDef.gradientStops;
          style.fillGradient = fillDef.gradientCss;
        }
        style.fillGradientAngle = fillDef.gradientAngle;
        style.fillGradientType = fillDef.gradientType;
        style.fillColor = overrideColor || fillDef.color;
        break;
      }
      case "pattern": {
        style.fillMode = "pattern";
        style.fillColor = overrideColor || fillDef.color;
        if (fillDef.patternPreset) {
          style.fillPatternPreset = fillDef.patternPreset;
        }
        if (fillDef.patternBackgroundColor) {
          style.fillPatternBackgroundColor = fillDef.patternBackgroundColor;
        }
        break;
      }
      case "none": {
        style.fillMode = "none";
        style.fillColor = "transparent";
        style.fillOpacity = 0;
        break;
      }
    }
  }
}
