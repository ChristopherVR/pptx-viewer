import type { ShapeStyle, XmlObject } from "../../types";

import {
  PptxEffectDagExtractor,
  type IPptxEffectDagExtractor,
} from "./PptxEffectDagExtractor";
import {
  PptxShapeEffectStyleExtractor,
  type IPptxShapeEffectStyleExtractor,
} from "./PptxShapeEffectStyleExtractor";
import {
  PptxShapeEffectXmlBuilder,
  type IPptxShapeEffectXmlBuilder,
} from "./PptxShapeEffectXmlBuilder";

export interface PptxShapeEffectXmlCodecContext {
  emuPerPx: number;
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
  clampUnitInterval: (value: number) => number;
  ensureArray: (value: unknown) => XmlObject[];
}

export interface IPptxShapeEffectXmlCodec {
  extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
  buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined;
  buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined;
}

export class PptxShapeEffectXmlCodec implements IPptxShapeEffectXmlCodec {
  private readonly extractor: IPptxShapeEffectStyleExtractor;

  private readonly dagExtractor: IPptxEffectDagExtractor;

  private readonly builder: IPptxShapeEffectXmlBuilder;

  public constructor(context: PptxShapeEffectXmlCodecContext) {
    this.extractor = new PptxShapeEffectStyleExtractor({
      emuPerPx: context.emuPerPx,
      parseColor: context.parseColor,
      extractColorOpacity: context.extractColorOpacity,
    });
    this.dagExtractor = new PptxEffectDagExtractor({
      emuPerPx: context.emuPerPx,
      parseColor: context.parseColor,
      extractColorOpacity: context.extractColorOpacity,
      ensureArray: context.ensureArray,
    });
    this.builder = new PptxShapeEffectXmlBuilder({
      emuPerPx: context.emuPerPx,
      clampUnitInterval: context.clampUnitInterval,
    });
  }

  public extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractShadowStyle(shapeProps);
  }

  public extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractInnerShadowStyle(shapeProps);
  }

  public extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractGlowStyle(shapeProps);
  }

  public extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractSoftEdgeStyle(shapeProps);
  }

  public extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractReflectionStyle(shapeProps);
  }

  public extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.extractor.extractBlurStyle(shapeProps);
  }

  public extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
    return this.dagExtractor.extractEffectDagStyle(shapeProps);
  }

  public buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildOuterShadowXml(shapeStyle);
  }

  public buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildInnerShadowXml(shapeStyle);
  }

  public buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildGlowXml(shapeStyle);
  }

  public buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildSoftEdgeXml(shapeStyle);
  }

  public buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildReflectionXml(shapeStyle);
  }

  public buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildBlurXml(shapeStyle);
  }

  public buildLineEffectListXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.builder.buildLineEffectListXml(shapeStyle);
  }
}
