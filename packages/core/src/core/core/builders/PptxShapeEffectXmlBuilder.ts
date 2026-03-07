import type { ShapeStyle, XmlObject } from "../../types";

export interface PptxShapeEffectXmlBuilderContext {
  emuPerPx: number;
  clampUnitInterval: (value: number) => number;
}

export interface IPptxShapeEffectXmlBuilder {
  buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined;
}

export class PptxShapeEffectXmlBuilder implements IPptxShapeEffectXmlBuilder {
  private readonly context: PptxShapeEffectXmlBuilderContext;

  public constructor(context: PptxShapeEffectXmlBuilderContext) {
    this.context = context;
  }

  public buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const shadowColor = String(shapeStyle.shadowColor || "").trim();
    if (shadowColor.length === 0 || shadowColor === "transparent") {
      return undefined;
    }

    const shadowOpacity =
      typeof shapeStyle.shadowOpacity === "number" &&
      Number.isFinite(shapeStyle.shadowOpacity)
        ? this.context.clampUnitInterval(shapeStyle.shadowOpacity)
        : 0.35;

    const shadowBlur =
      typeof shapeStyle.shadowBlur === "number" &&
      Number.isFinite(shapeStyle.shadowBlur)
        ? Math.max(0, shapeStyle.shadowBlur)
        : 6;

    // Prefer stored angle/distance if available, otherwise compute from offsets
    let distance: number;
    let directionDegrees: number;

    if (
      typeof shapeStyle.shadowAngle === "number" &&
      typeof shapeStyle.shadowDistance === "number"
    ) {
      // Use stored values directly
      directionDegrees = shapeStyle.shadowAngle;
      distance = shapeStyle.shadowDistance;
    } else {
      // Compute from offsets (legacy path)
      const shadowOffsetX =
        typeof shapeStyle.shadowOffsetX === "number" &&
        Number.isFinite(shapeStyle.shadowOffsetX)
          ? shapeStyle.shadowOffsetX
          : 4;
      const shadowOffsetY =
        typeof shapeStyle.shadowOffsetY === "number" &&
        Number.isFinite(shapeStyle.shadowOffsetY)
          ? shapeStyle.shadowOffsetY
          : 4;

      distance = Math.sqrt(
        shadowOffsetX * shadowOffsetX + shadowOffsetY * shadowOffsetY,
      );
      directionDegrees =
        ((Math.atan2(shadowOffsetY, shadowOffsetX) * 180) / Math.PI + 360) %
        360;
    }

    const xmlObj: XmlObject = {
      "@_blurRad": String(Math.round(shadowBlur * this.context.emuPerPx)),
      "@_dist": String(Math.round(distance * this.context.emuPerPx)),
      "@_dir": String(Math.round(directionDegrees * 60000)),
      "a:srgbClr": {
        "@_val": shadowColor.replace("#", ""),
        "a:alpha": {
          "@_val": String(Math.round(shadowOpacity * 100000)),
        },
      },
    };

    // Add rotateWithShape if explicitly set
    if (typeof shapeStyle.shadowRotateWithShape === "boolean") {
      xmlObj["@_rotWithShape"] = shapeStyle.shadowRotateWithShape ? "1" : "0";
    }

    return xmlObj;
  }

  public buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const innerColor = String(shapeStyle.innerShadowColor || "").trim();
    if (innerColor.length === 0 || innerColor === "transparent") {
      return undefined;
    }

    const offsetX =
      typeof shapeStyle.innerShadowOffsetX === "number" &&
      Number.isFinite(shapeStyle.innerShadowOffsetX)
        ? shapeStyle.innerShadowOffsetX
        : 0;
    const offsetY =
      typeof shapeStyle.innerShadowOffsetY === "number" &&
      Number.isFinite(shapeStyle.innerShadowOffsetY)
        ? shapeStyle.innerShadowOffsetY
        : 0;
    const blurValue =
      typeof shapeStyle.innerShadowBlur === "number" &&
      Number.isFinite(shapeStyle.innerShadowBlur)
        ? Math.max(0, shapeStyle.innerShadowBlur)
        : 6;
    const opacity =
      typeof shapeStyle.innerShadowOpacity === "number" &&
      Number.isFinite(shapeStyle.innerShadowOpacity)
        ? this.context.clampUnitInterval(shapeStyle.innerShadowOpacity)
        : 0.5;

    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const directionDegrees =
      ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;

    return {
      "@_blurRad": String(Math.round(blurValue * this.context.emuPerPx)),
      "@_dist": String(Math.round(distance * this.context.emuPerPx)),
      "@_dir": String(Math.round(directionDegrees * 60000)),
      "a:srgbClr": {
        "@_val": innerColor.replace("#", ""),
        "a:alpha": {
          "@_val": String(Math.round(opacity * 100000)),
        },
      },
    };
  }

  public buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const glowColor = String(shapeStyle.glowColor || "").trim();
    if (glowColor.length === 0 || glowColor === "transparent") {
      return undefined;
    }
    const glowRadius =
      typeof shapeStyle.glowRadius === "number" &&
      Number.isFinite(shapeStyle.glowRadius) &&
      shapeStyle.glowRadius > 0
        ? shapeStyle.glowRadius
        : undefined;
    if (glowRadius === undefined) return undefined;

    const glowOpacity =
      typeof shapeStyle.glowOpacity === "number" &&
      Number.isFinite(shapeStyle.glowOpacity)
        ? this.context.clampUnitInterval(shapeStyle.glowOpacity)
        : 0.4;

    return {
      "@_rad": String(Math.round(glowRadius * this.context.emuPerPx)),
      "a:srgbClr": {
        "@_val": glowColor.replace("#", ""),
        "a:alpha": {
          "@_val": String(Math.round(glowOpacity * 100000)),
        },
      },
    };
  }

  public buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const softEdgeRadius =
      typeof shapeStyle.softEdgeRadius === "number" &&
      Number.isFinite(shapeStyle.softEdgeRadius) &&
      shapeStyle.softEdgeRadius > 0
        ? shapeStyle.softEdgeRadius
        : undefined;
    if (softEdgeRadius === undefined) return undefined;

    return {
      "@_rad": String(Math.round(softEdgeRadius * this.context.emuPerPx)),
    };
  }

  public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const hasReflection =
      (typeof shapeStyle.reflectionBlurRadius === "number" &&
        shapeStyle.reflectionBlurRadius > 0) ||
      (typeof shapeStyle.reflectionStartOpacity === "number" &&
        shapeStyle.reflectionStartOpacity > 0) ||
      (typeof shapeStyle.reflectionDistance === "number" &&
        shapeStyle.reflectionDistance > 0);
    if (!hasReflection) return undefined;

    const reflectionXml: XmlObject = {};
    if (
      typeof shapeStyle.reflectionBlurRadius === "number" &&
      shapeStyle.reflectionBlurRadius > 0
    ) {
      reflectionXml["@_blurRad"] = String(
        Math.round(shapeStyle.reflectionBlurRadius * this.context.emuPerPx),
      );
    }
    if (typeof shapeStyle.reflectionStartOpacity === "number") {
      reflectionXml["@_stA"] = String(
        Math.round(shapeStyle.reflectionStartOpacity * 100000),
      );
    }
    if (typeof shapeStyle.reflectionEndOpacity === "number") {
      reflectionXml["@_endA"] = String(
        Math.round(shapeStyle.reflectionEndOpacity * 100000),
      );
    }
    if (typeof shapeStyle.reflectionEndPosition === "number") {
      reflectionXml["@_endPos"] = String(
        Math.round(shapeStyle.reflectionEndPosition * 100000),
      );
    }
    if (typeof shapeStyle.reflectionDirection === "number") {
      reflectionXml["@_dir"] = String(
        Math.round(shapeStyle.reflectionDirection * 60000),
      );
    }
    if (typeof shapeStyle.reflectionRotation === "number") {
      reflectionXml["@_rot"] = String(
        Math.round(shapeStyle.reflectionRotation * 60000),
      );
    }
    if (
      typeof shapeStyle.reflectionDistance === "number" &&
      shapeStyle.reflectionDistance > 0
    ) {
      reflectionXml["@_dist"] = String(
        Math.round(shapeStyle.reflectionDistance * this.context.emuPerPx),
      );
    }

    return reflectionXml;
  }

  public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const blurRadius =
      typeof shapeStyle.blurRadius === "number" &&
      Number.isFinite(shapeStyle.blurRadius) &&
      shapeStyle.blurRadius > 0
        ? shapeStyle.blurRadius
        : undefined;
    if (blurRadius === undefined) return undefined;

    return {
      "@_rad": String(Math.round(blurRadius * this.context.emuPerPx)),
      "@_grow": shapeStyle.blurGrow ? "1" : "0",
    };
  }

  /**
   * Build `a:effectLst` XML for line-level effects (shadow/glow on `a:ln`).
   * Returns undefined if no line effects are defined.
   */
  public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    const effectLst: XmlObject = {};
    let hasEffects = false;

    // Line outer shadow
    const lineShadowColor = String(shapeStyle.lineShadowColor || "").trim();
    if (lineShadowColor.length > 0 && lineShadowColor !== "transparent") {
      const offsetX =
        typeof shapeStyle.lineShadowOffsetX === "number"
          ? shapeStyle.lineShadowOffsetX
          : 2;
      const offsetY =
        typeof shapeStyle.lineShadowOffsetY === "number"
          ? shapeStyle.lineShadowOffsetY
          : 2;
      const blur =
        typeof shapeStyle.lineShadowBlur === "number"
          ? Math.max(0, shapeStyle.lineShadowBlur)
          : 4;
      const opacity =
        typeof shapeStyle.lineShadowOpacity === "number"
          ? this.context.clampUnitInterval(shapeStyle.lineShadowOpacity)
          : 0.35;
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const dirDeg =
        ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;

      effectLst["a:outerShdw"] = {
        "@_blurRad": String(Math.round(blur * this.context.emuPerPx)),
        "@_dist": String(Math.round(distance * this.context.emuPerPx)),
        "@_dir": String(Math.round(dirDeg * 60000)),
        "a:srgbClr": {
          "@_val": lineShadowColor.replace("#", ""),
          "a:alpha": {
            "@_val": String(Math.round(opacity * 100000)),
          },
        },
      };
      hasEffects = true;
    }

    // Line glow
    const lineGlowColor = String(shapeStyle.lineGlowColor || "").trim();
    if (lineGlowColor.length > 0 && lineGlowColor !== "transparent") {
      const radius =
        typeof shapeStyle.lineGlowRadius === "number" &&
        shapeStyle.lineGlowRadius > 0
          ? shapeStyle.lineGlowRadius
          : undefined;
      if (radius !== undefined) {
        const opacity =
          typeof shapeStyle.lineGlowOpacity === "number"
            ? this.context.clampUnitInterval(shapeStyle.lineGlowOpacity)
            : 0.4;
        effectLst["a:glow"] = {
          "@_rad": String(Math.round(radius * this.context.emuPerPx)),
          "a:srgbClr": {
            "@_val": lineGlowColor.replace("#", ""),
            "a:alpha": {
              "@_val": String(Math.round(opacity * 100000)),
            },
          },
        };
        hasEffects = true;
      }
    }

    return hasEffects ? effectLst : undefined;
  }
}
