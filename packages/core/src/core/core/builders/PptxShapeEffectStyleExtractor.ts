import type { ShapeStyle, XmlObject } from "../../types";
import {
  PRESET_SHADOW_BLUR_MAP,
  PRESET_SHADOW_OPACITY_MAP,
} from "./effect-style-preset-maps";

export interface PptxShapeEffectStyleExtractorContext {
  emuPerPx: number;
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
}

export interface IPptxShapeEffectStyleExtractor {
  extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractPresetShadowStyle(effectLstParent: XmlObject): Partial<ShapeStyle>;
  extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
}

export class PptxShapeEffectStyleExtractor implements IPptxShapeEffectStyleExtractor {
  private readonly context: PptxShapeEffectStyleExtractorContext;

  public constructor(context: PptxShapeEffectStyleExtractorContext) {
    this.context = context;
  }

  public extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const outerShadow = effectList?.["a:outerShdw"] as XmlObject | undefined;
    if (!outerShadow) return this.extractPresetShadowStyle(shapeProps);

    const shadowColor = this.context.parseColor(outerShadow);
    const shadowOpacity = this.context.extractColorOpacity(outerShadow);
    const blurRaw = Number.parseInt(String(outerShadow["@_blurRad"] || ""), 10);
    const distRaw = Number.parseInt(String(outerShadow["@_dist"] || ""), 10);
    const directionRaw = Number.parseInt(
      String(outerShadow["@_dir"] || ""),
      10,
    );

    const shadowBlur =
      Number.isFinite(blurRaw) && blurRaw >= 0
        ? blurRaw / this.context.emuPerPx
        : undefined;
    const distance =
      Number.isFinite(distRaw) && distRaw >= 0
        ? distRaw / this.context.emuPerPx
        : undefined;
    const directionDegrees = Number.isFinite(directionRaw)
      ? directionRaw / 60000
      : 0;
    const directionRadians = (directionDegrees * Math.PI) / 180;

    const shadowOffsetX =
      distance !== undefined
        ? Math.round(Math.cos(directionRadians) * distance * 100) / 100
        : undefined;
    const shadowOffsetY =
      distance !== undefined
        ? Math.round(Math.sin(directionRadians) * distance * 100) / 100
        : undefined;

    // Parse rotateWithShape attribute
    const rotateWithShape = outerShadow["@_rotWithShape"];
    const shadowRotateWithShape =
      typeof rotateWithShape === "boolean"
        ? rotateWithShape
        : rotateWithShape === "1" || rotateWithShape === "true"
          ? true
          : undefined;

    return {
      shadowColor,
      shadowOpacity,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      shadowAngle: directionDegrees,
      shadowDistance: distance,
      shadowRotateWithShape,
    };
  }

  public extractPresetShadowStyle(
    effectLstParent: XmlObject,
  ): Partial<ShapeStyle> {
    const effectLst = effectLstParent["a:effectLst"] as XmlObject | undefined;
    if (!effectLst) return {};
    const prstShdw = effectLst["a:prstShdw"] as XmlObject | undefined;
    if (!prstShdw) return {};

    const preset = String(prstShdw["@_prst"] || "").trim();
    const distEmu = parseFloat(String(prstShdw["@_dist"] || "0"));
    const dirRaw = parseFloat(String(prstShdw["@_dir"] || "0"));
    const distPx = distEmu / this.context.emuPerPx;
    const dirRad = (dirRaw / 60000) * (Math.PI / 180);

    // Look up preset-specific blur values (shdw1-shdw20)
    const presetBlur = PRESET_SHADOW_BLUR_MAP[preset];

    const parsedColor =
      this.context.parseColor(prstShdw as XmlObject | undefined) || "#000000";
    const parsedOpacity = this.context.extractColorOpacity(
      prstShdw as XmlObject | undefined,
    );

    return {
      shadowOffsetX: Math.round(distPx * Math.cos(dirRad) * 100) / 100,
      shadowOffsetY: Math.round(distPx * Math.sin(dirRad) * 100) / 100,
      shadowColor: parsedColor,
      shadowOpacity:
        parsedOpacity ??
        (presetBlur !== undefined
          ? (PRESET_SHADOW_OPACITY_MAP[preset] ?? 0.5)
          : 0.5),
      shadowBlur: presetBlur ?? 4,
      presetShadowName: preset.length > 0 ? preset : undefined,
    };
  }

  public extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const innerShadow = effectList?.["a:innerShdw"] as XmlObject | undefined;
    if (!innerShadow) return {};

    const innerShadowColor = this.context.parseColor(innerShadow);
    const innerShadowOpacity = this.context.extractColorOpacity(innerShadow);
    const blurRaw = Number.parseInt(String(innerShadow["@_blurRad"] || ""), 10);
    const distRaw = Number.parseInt(String(innerShadow["@_dist"] || ""), 10);
    const directionRaw = Number.parseInt(
      String(innerShadow["@_dir"] || ""),
      10,
    );

    const innerShadowBlur =
      Number.isFinite(blurRaw) && blurRaw >= 0
        ? blurRaw / this.context.emuPerPx
        : undefined;
    const distance =
      Number.isFinite(distRaw) && distRaw >= 0
        ? distRaw / this.context.emuPerPx
        : undefined;
    const directionDegrees = Number.isFinite(directionRaw)
      ? directionRaw / 60000
      : 0;
    const directionRadians = (directionDegrees * Math.PI) / 180;

    const innerShadowOffsetX =
      distance !== undefined
        ? Math.round(Math.cos(directionRadians) * distance * 100) / 100
        : undefined;
    const innerShadowOffsetY =
      distance !== undefined
        ? Math.round(Math.sin(directionRadians) * distance * 100) / 100
        : undefined;

    return {
      innerShadowColor,
      innerShadowOpacity,
      innerShadowBlur,
      innerShadowOffsetX,
      innerShadowOffsetY,
    };
  }

  public extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const glowNode = effectList?.["a:glow"] as XmlObject | undefined;
    if (!glowNode) return {};

    const glowColor = this.context.parseColor(glowNode);
    const glowOpacity = this.context.extractColorOpacity(glowNode);
    const radiusRaw = Number.parseInt(String(glowNode["@_rad"] || ""), 10);
    const glowRadius =
      Number.isFinite(radiusRaw) && radiusRaw >= 0
        ? radiusRaw / this.context.emuPerPx
        : undefined;

    return {
      glowColor,
      glowRadius,
      glowOpacity,
    };
  }

  public extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const softEdgeNode = effectList?.["a:softEdge"] as XmlObject | undefined;
    if (!softEdgeNode) return {};

    const radiusRaw = Number.parseInt(String(softEdgeNode["@_rad"] || ""), 10);
    const softEdgeRadius =
      Number.isFinite(radiusRaw) && radiusRaw >= 0
        ? radiusRaw / this.context.emuPerPx
        : undefined;

    return { softEdgeRadius };
  }

  public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const reflectionNode = effectList?.["a:reflection"] as
      | XmlObject
      | undefined;
    if (!reflectionNode) return {};

    const blurRadiusRaw = Number.parseInt(
      String(reflectionNode["@_blurRad"] || ""),
      10,
    );
    const reflectionBlurRadius =
      Number.isFinite(blurRadiusRaw) && blurRadiusRaw >= 0
        ? blurRadiusRaw / this.context.emuPerPx
        : undefined;

    const startOpacityRaw = Number.parseInt(
      String(reflectionNode["@_stA"] || ""),
      10,
    );
    const reflectionStartOpacity = Number.isFinite(startOpacityRaw)
      ? startOpacityRaw / 100000
      : undefined;

    const endOpacityRaw = Number.parseInt(
      String(reflectionNode["@_endA"] || ""),
      10,
    );
    const reflectionEndOpacity = Number.isFinite(endOpacityRaw)
      ? endOpacityRaw / 100000
      : undefined;

    const endPositionRaw = Number.parseInt(
      String(reflectionNode["@_endPos"] || ""),
      10,
    );
    const reflectionEndPosition = Number.isFinite(endPositionRaw)
      ? endPositionRaw / 100000
      : undefined;

    const directionRaw = Number.parseInt(
      String(reflectionNode["@_dir"] || ""),
      10,
    );
    const reflectionDirection = Number.isFinite(directionRaw)
      ? directionRaw / 60000
      : undefined;

    const rotationRaw = Number.parseInt(
      String(reflectionNode["@_rot"] || ""),
      10,
    );
    const reflectionRotation = Number.isFinite(rotationRaw)
      ? rotationRaw / 60000
      : undefined;

    const distanceRaw = Number.parseInt(
      String(reflectionNode["@_dist"] || ""),
      10,
    );
    const reflectionDistance =
      Number.isFinite(distanceRaw) && distanceRaw >= 0
        ? distanceRaw / this.context.emuPerPx
        : undefined;

    return {
      reflectionBlurRadius,
      reflectionStartOpacity,
      reflectionEndOpacity,
      reflectionEndPosition,
      reflectionDirection,
      reflectionRotation,
      reflectionDistance,
    };
  }

  public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    const effectList = shapeProps["a:effectLst"] as XmlObject | undefined;
    const blurNode = effectList?.["a:blur"] as XmlObject | undefined;
    if (!blurNode) return {};

    const radiusRaw = Number.parseInt(String(blurNode["@_rad"] || ""), 10);
    const blurRadius =
      Number.isFinite(radiusRaw) && radiusRaw >= 0
        ? radiusRaw / this.context.emuPerPx
        : undefined;

    const growValue = String(blurNode["@_grow"] || "").trim();
    const blurGrow =
      growValue === "1" || growValue === "true" ? true : undefined;

    return { blurRadius, blurGrow };
  }
}

export {
  PRESET_SHADOW_BLUR_MAP,
  PRESET_SHADOW_OPACITY_MAP,
} from "./effect-style-preset-maps";
