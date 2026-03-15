import type { ShapeStyle, XmlObject } from "../../types";

import {
  PptxColorTransformCodec,
  type IPptxColorTransformCodec,
} from "./PptxColorTransformCodec";
import {
  PptxGradientStyleCodec,
  type IPptxGradientStyleCodec,
} from "./PptxGradientStyleCodec";
import {
  PptxShapeEffectXmlCodec,
  type IPptxShapeEffectXmlCodec,
} from "./PptxShapeEffectXmlCodec";

export interface PptxColorStyleCodecContext {
  emuPerPx: number;
  ensureArray: (value: unknown) => unknown[];
  resolveThemeColor: (schemeKey: string) => string | undefined;
}

export interface IPptxColorStyleCodec {
  parseColorChoice(
    colorChoice: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined;
  parseColor(
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined;
  percentAttrToUnit(value: unknown): number | undefined;
  clampUnitInterval(value: number): number;
  hexToRgb(hex: string): { r: number; g: number; b: number } | undefined;
  rgbToHex(r: number, g: number, b: number): string;
  applyColorTransforms(baseColor: string, colorNode: XmlObject): string;
  extractColorChoiceNode(
    colorNode: XmlObject | undefined,
  ): XmlObject | undefined;
  extractColorOpacity(colorNode: XmlObject | undefined): number | undefined;
  colorWithOpacity(color: string, opacity: number | undefined): string;
  extractGradientOpacity(gradFill: XmlObject): number | undefined;
  extractGradientStops(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientStops"]>;
  extractGradientType(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientType"]>;
  extractGradientAngle(gradFill: XmlObject): number;
  buildGradientCssFromStops(
    stops: NonNullable<ShapeStyle["fillGradientStops"]>,
    type: NonNullable<ShapeStyle["fillGradientType"]>,
    angle: number,
  ): string | undefined;
  extractGradientFillCss(gradFill: XmlObject): string | undefined;
  extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  extractGradientFillColor(gradFill: XmlObject): string | undefined;
  extractGradientPathType(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientPathType"];
  extractGradientFocalPoint(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFocalPoint"];
  extractGradientFillToRect(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFillToRect"];
}

export class PptxColorStyleCodec implements IPptxColorStyleCodec {
  private readonly colorTransformCodec: IPptxColorTransformCodec;

  private readonly gradientStyleCodec: IPptxGradientStyleCodec;

  private readonly shapeEffectXmlCodec: IPptxShapeEffectXmlCodec;

  public constructor(context: PptxColorStyleCodecContext) {
    this.colorTransformCodec = new PptxColorTransformCodec({
      resolveThemeColor: context.resolveThemeColor,
    });

    this.gradientStyleCodec = new PptxGradientStyleCodec({
      ensureArray: context.ensureArray,
      parseColor: (colorNode, placeholderColor) =>
        this.parseColor(colorNode, placeholderColor),
      extractColorOpacity: (colorNode) => this.extractColorOpacity(colorNode),
      clampUnitInterval: (value) => this.clampUnitInterval(value),
      hexToRgb: (hex) => this.hexToRgb(hex),
      rgbToHex: (r, g, b) => this.rgbToHex(r, g, b),
    });

    this.shapeEffectXmlCodec = new PptxShapeEffectXmlCodec({
      emuPerPx: context.emuPerPx,
      parseColor: (colorNode, placeholderColor) =>
        this.parseColor(colorNode, placeholderColor),
      extractColorOpacity: (colorNode) => this.extractColorOpacity(colorNode),
      clampUnitInterval: (value) => this.clampUnitInterval(value),
      ensureArray: context.ensureArray as (value: unknown) => XmlObject[],
    });
  }

  public parseColorChoice(
    colorChoice: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    return this.colorTransformCodec.parseColorChoice(
      colorChoice,
      placeholderColor,
    );
  }

  public parseColor(
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    return this.colorTransformCodec.parseColor(colorNode, placeholderColor);
  }

  public percentAttrToUnit(value: unknown): number | undefined {
    return this.colorTransformCodec.percentAttrToUnit(value);
  }

  public clampUnitInterval(value: number): number {
    return this.colorTransformCodec.clampUnitInterval(value);
  }

  public hexToRgb(
    hex: string,
  ): { r: number; g: number; b: number } | undefined {
    return this.colorTransformCodec.hexToRgb(hex);
  }

  public rgbToHex(r: number, g: number, b: number): string {
    return this.colorTransformCodec.rgbToHex(r, g, b);
  }

  public applyColorTransforms(baseColor: string, colorNode: XmlObject): string {
    return this.colorTransformCodec.applyColorTransforms(baseColor, colorNode);
  }

  public extractColorChoiceNode(
    colorNode: XmlObject | undefined,
  ): XmlObject | undefined {
    if (!colorNode) return undefined;
    const colorCandidates = [
      "a:srgbClr",
      "a:schemeClr",
      "a:prstClr",
      "a:sysClr",
    ];
    for (const candidate of colorCandidates) {
      const node = colorNode[candidate] as XmlObject | undefined;
      if (node) return node;
    }
    return undefined;
  }

  public extractColorOpacity(
    colorNode: XmlObject | undefined,
  ): number | undefined {
    const choiceNode = this.extractColorChoiceNode(colorNode);
    if (!choiceNode) return undefined;

    const alpha = this.percentAttrToUnit(
      (choiceNode["a:alpha"] as XmlObject | undefined)?.["@_val"],
    );
    const alphaMod = this.percentAttrToUnit(
      (choiceNode["a:alphaMod"] as XmlObject | undefined)?.["@_val"],
    );
    const alphaOff = this.percentAttrToUnit(
      (choiceNode["a:alphaOff"] as XmlObject | undefined)?.["@_val"],
    );

    if (
      alpha === undefined &&
      alphaMod === undefined &&
      alphaOff === undefined
    ) {
      return undefined;
    }

    let opacity = alpha ?? 1;
    if (alphaMod !== undefined) {
      opacity *= alphaMod;
    }
    if (alphaOff !== undefined) {
      opacity += alphaOff;
    }

    return this.clampUnitInterval(opacity);
  }

  public colorWithOpacity(color: string, opacity: number | undefined): string {
    if (opacity === undefined) return color;
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.clampUnitInterval(opacity)})`;
  }

  public extractGradientOpacity(gradFill: XmlObject): number | undefined {
    return this.gradientStyleCodec.extractGradientOpacity(gradFill);
  }

  public extractGradientStops(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientStops"]> {
    return this.gradientStyleCodec.extractGradientStops(gradFill);
  }

  public extractGradientType(
    gradFill: XmlObject,
  ): NonNullable<ShapeStyle["fillGradientType"]> {
    return this.gradientStyleCodec.extractGradientType(gradFill);
  }

  public extractGradientAngle(gradFill: XmlObject): number {
    return this.gradientStyleCodec.extractGradientAngle(gradFill);
  }

  public buildGradientCssFromStops(
    stops: NonNullable<ShapeStyle["fillGradientStops"]>,
    type: NonNullable<ShapeStyle["fillGradientType"]>,
    angle: number,
  ): string | undefined {
    return this.gradientStyleCodec.buildGradientCssFromStops(
      stops,
      type,
      angle,
    );
  }

  public extractGradientFillCss(gradFill: XmlObject): string | undefined {
    return this.gradientStyleCodec.extractGradientFillCss(gradFill);
  }

  public extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractShadowStyle(shapeProps);
  }

  public extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractInnerShadowStyle(shapeProps);
  }

  public extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractGlowStyle(shapeProps);
  }

  public extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractSoftEdgeStyle(shapeProps);
  }

  public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractReflectionStyle(shapeProps);
  }

  public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractBlurStyle(shapeProps);
  }

  public extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.shapeEffectXmlCodec.extractEffectDagStyle(shapeProps);
  }

  public buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.gradientStyleCodec.buildGradientFillXml(shapeStyle);
  }

  public buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildOuterShadowXml(shapeStyle);
  }

  public buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildInnerShadowXml(shapeStyle);
  }

  public buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildGlowXml(shapeStyle);
  }

  public buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildSoftEdgeXml(shapeStyle);
  }

  public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildReflectionXml(shapeStyle);
  }

  public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildBlurXml(shapeStyle);
  }

  public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.shapeEffectXmlCodec.buildLineEffectListXml(shapeStyle);
  }

  public extractGradientFillColor(gradFill: XmlObject): string | undefined {
    return this.gradientStyleCodec.extractGradientFillColor(gradFill);
  }

  public extractGradientPathType(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientPathType"] {
    return this.gradientStyleCodec.extractGradientPathType(gradFill);
  }

  public extractGradientFocalPoint(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFocalPoint"] {
    return this.gradientStyleCodec.extractGradientFocalPoint(gradFill);
  }

  public extractGradientFillToRect(
    gradFill: XmlObject,
  ): ShapeStyle["fillGradientFillToRect"] {
    return this.gradientStyleCodec.extractGradientFillToRect(gradFill);
  }
}
