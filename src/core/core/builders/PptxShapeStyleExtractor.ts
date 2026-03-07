import type {
  ConnectorArrowType,
  ShapeStyle,
  StrokeDashType,
  XmlObject,
} from "../../types";
import { applyLineProperties } from "./shape-style-line-helpers";
import { applyScene3dStyle, applyShape3dStyle } from "./shape-style-3d-helpers";

export interface PptxShapeStyleExtractorContext {
  emuPerPx: number;
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
  extractGradientFillColor: (gradFill: XmlObject) => string | undefined;
  extractGradientOpacity: (gradFill: XmlObject) => number | undefined;
  extractGradientFillCss: (gradFill: XmlObject) => string | undefined;
  extractGradientStops: (
    gradFill: XmlObject,
  ) => NonNullable<ShapeStyle["fillGradientStops"]>;
  extractGradientAngle: (gradFill: XmlObject) => number;
  extractGradientType: (
    gradFill: XmlObject,
  ) => NonNullable<ShapeStyle["fillGradientType"]>;
  extractGradientPathType: (
    gradFill: XmlObject,
  ) => ShapeStyle["fillGradientPathType"];
  extractGradientFocalPoint: (
    gradFill: XmlObject,
  ) => ShapeStyle["fillGradientFocalPoint"];
  normalizeStrokeDashType: (value: unknown) => StrokeDashType | undefined;
  normalizeConnectorArrowType: (
    value: unknown,
  ) => ConnectorArrowType | undefined;
  ensureArray: (value: unknown) => unknown[];
  resolveThemeFillRef: (refNode: XmlObject, style: ShapeStyle) => void;
  resolveThemeLineRef: (refNode: XmlObject, style: ShapeStyle) => void;
  resolveThemeEffectRef: (refNode: XmlObject, style: ShapeStyle) => void;
  extractShadowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractInnerShadowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractGlowStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractSoftEdgeStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractReflectionStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractBlurStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
  extractEffectDagStyle: (shapeProps: XmlObject) => Partial<ShapeStyle>;
}

export interface IPptxShapeStyleExtractor {
  extractShapeStyle(
    spPr: XmlObject | undefined,
    styleNode?: XmlObject,
  ): ShapeStyle;
}

export class PptxShapeStyleExtractor implements IPptxShapeStyleExtractor {
  private readonly context: PptxShapeStyleExtractorContext;

  public constructor(context: PptxShapeStyleExtractorContext) {
    this.context = context;
  }

  public extractShapeStyle(
    spPr: XmlObject | undefined,
    styleNode?: XmlObject,
  ): ShapeStyle {
    const style: ShapeStyle = {};
    const shapeProps = (spPr || {}) as XmlObject;

    const solidFill = shapeProps["a:solidFill"] as XmlObject | undefined;
    const gradFill = shapeProps["a:gradFill"] as XmlObject | undefined;
    const pattFill = shapeProps["a:pattFill"] as XmlObject | undefined;
    const noFill = shapeProps["a:noFill"] as XmlObject | undefined;
    const blipFill = shapeProps["a:blipFill"] as XmlObject | undefined;

    if (solidFill) {
      style.fillMode = "solid";
      style.fillColor = this.context.parseColor(solidFill);
      style.fillOpacity = this.context.extractColorOpacity(solidFill);
    } else if (gradFill) {
      style.fillMode = "gradient";
      style.fillColor = this.context.extractGradientFillColor(gradFill);
      style.fillOpacity = this.context.extractGradientOpacity(gradFill);
      style.fillGradient = this.context.extractGradientFillCss(gradFill);
      style.fillGradientStops = this.context.extractGradientStops(gradFill);
      style.fillGradientAngle = this.context.extractGradientAngle(gradFill);
      style.fillGradientType = this.context.extractGradientType(gradFill);
      style.fillGradientPathType =
        this.context.extractGradientPathType(gradFill);
      style.fillGradientFocalPoint =
        this.context.extractGradientFocalPoint(gradFill);
    } else if (pattFill) {
      style.fillMode = "pattern";
      style.fillColor =
        this.context.parseColor(pattFill["a:fgClr"] as XmlObject | undefined) ||
        this.context.parseColor(pattFill["a:bgClr"] as XmlObject | undefined);
      style.fillOpacity =
        this.context.extractColorOpacity(
          pattFill["a:fgClr"] as XmlObject | undefined,
        ) ||
        this.context.extractColorOpacity(
          pattFill["a:bgClr"] as XmlObject | undefined,
        );
      const pattPreset = String(pattFill["@_prst"] || "").trim();
      if (pattPreset.length > 0) {
        style.fillPatternPreset = pattPreset;
      }
      const pattBgColor = this.context.parseColor(
        pattFill["a:bgClr"] as XmlObject | undefined,
      );
      if (pattBgColor) {
        style.fillPatternBackgroundColor = pattBgColor;
      }
      // Preserve raw XML colour nodes for round-trip (retains color transforms)
      const fgClrNode = pattFill["a:fgClr"] as XmlObject | undefined;
      if (fgClrNode) {
        style.fillPatternFgClrXml = fgClrNode;
      }
      const bgClrNode = pattFill["a:bgClr"] as XmlObject | undefined;
      if (bgClrNode) {
        style.fillPatternBgClrXml = bgClrNode;
      }
    } else if (noFill) {
      // When main fill is a:noFill, check p14:hiddenFill in the extension
      // list — PowerPoint stores the "real" fill there for shapes that
      // appear unfilled in normal view but should show fill in some contexts.
      const hiddenFillProps = this.extractHiddenFillFromExtLst(shapeProps);
      if (hiddenFillProps) {
        const hiddenSolid = hiddenFillProps["a:solidFill"] as
          | XmlObject
          | undefined;
        const hiddenGrad = hiddenFillProps["a:gradFill"] as
          | XmlObject
          | undefined;
        if (hiddenSolid) {
          style.fillMode = "solid";
          style.fillColor = this.context.parseColor(hiddenSolid);
          style.fillOpacity = this.context.extractColorOpacity(hiddenSolid);
        } else if (hiddenGrad) {
          style.fillMode = "gradient";
          style.fillColor = this.context.extractGradientFillColor(hiddenGrad);
          style.fillOpacity = this.context.extractGradientOpacity(hiddenGrad);
          style.fillGradient = this.context.extractGradientFillCss(hiddenGrad);
          style.fillGradientStops =
            this.context.extractGradientStops(hiddenGrad);
          style.fillGradientAngle =
            this.context.extractGradientAngle(hiddenGrad);
          style.fillGradientType = this.context.extractGradientType(hiddenGrad);
        } else {
          style.fillMode = "none";
          style.fillColor = "transparent";
          style.fillOpacity = 0;
        }
      } else {
        style.fillMode = "none";
        style.fillColor = "transparent";
        style.fillOpacity = 0;
      }
    } else if (blipFill) {
      style.fillMode = "image";
      style.fillColor = "transparent";
      style.fillOpacity = 0;
    } else if (shapeProps["a:grpFill"] !== undefined) {
      style.fillMode = "group";
    } else if (styleNode?.["a:fillRef"]) {
      this.context.resolveThemeFillRef(
        styleNode["a:fillRef"] as XmlObject,
        style,
      );
    }

    const lineNode = shapeProps["a:ln"] as XmlObject | undefined;
    if (lineNode) {
      const earlyReturn = applyLineProperties(
        lineNode,
        shapeProps,
        style,
        this.context,
        (props) => this.extractHiddenLineFromExtLst(props),
      );
      if (earlyReturn) {
        return style;
      }
    } else if (styleNode?.["a:lnRef"]) {
      this.context.resolveThemeLineRef(
        styleNode["a:lnRef"] as XmlObject,
        style,
      );
    }

    Object.assign(style, this.context.extractShadowStyle(shapeProps));
    Object.assign(style, this.context.extractInnerShadowStyle(shapeProps));
    Object.assign(style, this.context.extractGlowStyle(shapeProps));
    Object.assign(style, this.context.extractSoftEdgeStyle(shapeProps));
    Object.assign(style, this.context.extractReflectionStyle(shapeProps));
    Object.assign(style, this.context.extractBlurStyle(shapeProps));
    Object.assign(style, this.context.extractEffectDagStyle(shapeProps));

    if (styleNode?.["a:effectRef"]) {
      this.context.resolveThemeEffectRef(
        styleNode["a:effectRef"] as XmlObject,
        style,
      );
    }

    applyScene3dStyle(shapeProps, style);
    applyShape3dStyle(shapeProps, style, this.context);

    return style;
  }

  /**
   * Extract p14:hiddenFill from the shape properties extension list.
   * URI: {AF507438-7753-43E0-B8FC-AC1667EBCBE1}
   *
   * The p14:hiddenFill element wraps a standard fill child (a:solidFill,
   * a:gradFill, etc.) that should be applied when the main fill is absent.
   */
  private extractHiddenFillFromExtLst(
    shapeProps: XmlObject,
  ): XmlObject | undefined {
    const extLst = shapeProps["a:extLst"] as XmlObject | undefined;
    if (!extLst) return undefined;

    const exts = this.context.ensureArray(extLst["a:ext"]);
    for (const ext of exts) {
      const extObj = ext as XmlObject;
      const uri = String(extObj?.["@_uri"] || "");
      if (uri === "{AF507438-7753-43E0-B8FC-AC1667EBCBE1}") {
        // p14:hiddenFill wraps the fill child directly
        return (extObj["a14:hiddenFill"] ?? extObj["p14:hiddenFill"]) as
          | XmlObject
          | undefined;
      }
    }
    return undefined;
  }

  /**
   * Extract p14:hiddenLine from the shape properties extension list.
   * URI: {91240B29-F687-4F45-9708-019B960494DF}
   *
   * The p14:hiddenLine element wraps a standard a:ln-like structure
   * that should be applied when the main line is absent.
   */
  private extractHiddenLineFromExtLst(
    shapeProps: XmlObject,
  ): XmlObject | undefined {
    const extLst = shapeProps["a:extLst"] as XmlObject | undefined;
    if (!extLst) return undefined;

    const exts = this.context.ensureArray(extLst["a:ext"]);
    for (const ext of exts) {
      const extObj = ext as XmlObject;
      const uri = String(extObj?.["@_uri"] || "");
      if (uri === "{91240B29-F687-4F45-9708-019B960494DF}") {
        return (extObj["a14:hiddenLine"] ?? extObj["p14:hiddenLine"]) as
          | XmlObject
          | undefined;
      }
    }
    return undefined;
  }
}

// Re-exports for backward compatibility
export type { ShapeLineStyleContext } from "./shape-style-line-helpers";
export { applyLineProperties } from "./shape-style-line-helpers";
export type { Shape3dStyleContext } from "./shape-style-3d-helpers";
export { applyScene3dStyle, applyShape3dStyle } from "./shape-style-3d-helpers";
