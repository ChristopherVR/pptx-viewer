import {
  XmlObject,
  TextStyle,
  TextSegment,
  type PptxImageLikeElement,
  type PptxImageEffects,
  ShapeStyle,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveShapeXml";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected clampCropForSave(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(0.95, value));
  }

  protected applyImageCropToBlipFill(
    blipFill: XmlObject | undefined,
    element: PptxImageLikeElement,
  ): void {
    if (!blipFill) return;

    const cropLeft = this.clampCropForSave(element.cropLeft);
    const cropTop = this.clampCropForSave(element.cropTop);
    const cropRight = this.clampCropForSave(element.cropRight);
    const cropBottom = this.clampCropForSave(element.cropBottom);

    const horizontalCrop = cropLeft + cropRight;
    const verticalCrop = cropTop + cropBottom;
    const hasCrop = horizontalCrop > 0.0001 || verticalCrop > 0.0001;

    if (!hasCrop) {
      delete blipFill["a:srcRect"];
      return;
    }

    const safeHorizontalScale =
      horizontalCrop >= 0.99 ? 0.99 / horizontalCrop : 1;
    const safeVerticalScale = verticalCrop >= 0.99 ? 0.99 / verticalCrop : 1;
    const normalizedLeft = this.clampCropForSave(
      cropLeft * safeHorizontalScale,
    );
    const normalizedRight = this.clampCropForSave(
      cropRight * safeHorizontalScale,
    );
    const normalizedTop = this.clampCropForSave(cropTop * safeVerticalScale);
    const normalizedBottom = this.clampCropForSave(
      cropBottom * safeVerticalScale,
    );

    blipFill["a:srcRect"] = {
      "@_l": String(Math.round(normalizedLeft * 100000)),
      "@_t": String(Math.round(normalizedTop * 100000)),
      "@_r": String(Math.round(normalizedRight * 100000)),
      "@_b": String(Math.round(normalizedBottom * 100000)),
    };
  }

  protected applyImageEffectsToBlip(
    blipFill: XmlObject | undefined,
    effects: PptxImageEffects | undefined,
  ): void {
    if (!blipFill) return;
    const blip = blipFill["a:blip"] as XmlObject | undefined;
    if (!blip) return;
    const nextEffects = effects ?? {};

    if (
      typeof nextEffects.brightness === "number" &&
      Number.isFinite(nextEffects.brightness)
    ) {
      blip["@_bright"] = String(Math.round(nextEffects.brightness * 1000));
    } else {
      delete blip["@_bright"];
      delete blip["@_brt"];
    }

    if (
      typeof nextEffects.contrast === "number" &&
      Number.isFinite(nextEffects.contrast)
    ) {
      blip["@_contrast"] = String(Math.round(nextEffects.contrast * 1000));
    } else {
      delete blip["@_contrast"];
      delete blip["@_cont"];
    }

    if (nextEffects.grayscale) {
      blip["a:grayscl"] = {};
    } else {
      delete blip["a:grayscl"];
    }

    if (
      typeof nextEffects.alphaModFix === "number" &&
      Number.isFinite(nextEffects.alphaModFix)
    ) {
      blip["a:alphaModFix"] = {
        "@_amt": String(Math.round(nextEffects.alphaModFix * 1000)),
      };
    } else {
      delete blip["a:alphaModFix"];
    }

    if (
      typeof nextEffects.biLevel === "number" &&
      Number.isFinite(nextEffects.biLevel)
    ) {
      blip["a:biLevel"] = {
        "@_thresh": String(Math.round(nextEffects.biLevel * 1000)),
      };
    } else {
      delete blip["a:biLevel"];
    }

    if (
      nextEffects.duotone &&
      typeof nextEffects.duotone.color1 === "string" &&
      typeof nextEffects.duotone.color2 === "string"
    ) {
      blip["a:duotone"] = {
        "a:srgbClr": [
          {
            "@_val": nextEffects.duotone.color1.replace("#", ""),
          },
          {
            "@_val": nextEffects.duotone.color2.replace("#", ""),
          },
        ],
      };
    } else {
      delete blip["a:duotone"];
    }

    if (
      nextEffects.clrChange &&
      typeof nextEffects.clrChange.clrFrom === "string" &&
      typeof nextEffects.clrChange.clrTo === "string"
    ) {
      const clrToNode: XmlObject = {
        "a:srgbClr": {
          "@_val": nextEffects.clrChange.clrTo.replace("#", ""),
        },
      };
      if (nextEffects.clrChange.clrToTransparent) {
        (clrToNode["a:srgbClr"] as XmlObject)["a:alpha"] = {
          "@_val": "0",
        };
      }
      blip["a:clrChange"] = {
        "a:clrFrom": {
          "a:srgbClr": {
            "@_val": nextEffects.clrChange.clrFrom.replace("#", ""),
          },
        },
        "a:clrTo": clrToNode,
      };
    } else {
      delete blip["a:clrChange"];
    }
  }

  protected normalizePresetGeometry(shapeType: string | undefined): string {
    return this.elementXmlBuilder.normalizePresetGeometry(shapeType);
  }

  protected buildGradientFillXml(
    shapeStyle: ShapeStyle,
  ): XmlObject | undefined {
    return this.colorStyleCodec.buildGradientFillXml(shapeStyle);
  }

  protected clampUnitInterval(value: number): number {
    return this.colorStyleCodec.clampUnitInterval(value);
  }

  protected buildOuterShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildOuterShadowXml(shapeStyle);
  }

  protected buildInnerShadowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildInnerShadowXml(shapeStyle);
  }

  protected buildGlowXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildGlowXml(shapeStyle);
  }

  protected buildSoftEdgeXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildSoftEdgeXml(shapeStyle);
  }

  protected buildReflectionXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildReflectionXml(shapeStyle);
  }

  protected buildBlurXml(shapeStyle: ShapeStyle): XmlObject | undefined {
    return this.colorStyleCodec.buildBlurXml(shapeStyle);
  }

  protected buildLineEffectListXml(
    shapeStyle: ShapeStyle,
  ): XmlObject | undefined {
    return this.colorStyleCodec.buildLineEffectListXml(shapeStyle);
  }

  protected textVerticalAlignToDrawingValue(
    vAlign: TextStyle["vAlign"] | undefined,
  ): string | undefined {
    if (vAlign === "top") return "t";
    if (vAlign === "middle") return "ctr";
    if (vAlign === "bottom") return "b";
    return undefined;
  }

  protected textDirectionToDrawingValue(
    value: TextStyle["textDirection"] | undefined,
  ): string | undefined {
    if (value === "vertical") return "vert";
    if (value === "vertical270") return "vert270";
    if (value === "eaVert") return "eaVert";
    if (value === "wordArtVert") return "wordArtVert";
    if (value === "wordArtVertRtl") return "wordArtVertRtl";
    if (value === "mongolianVert") return "mongolianVert";
    return undefined;
  }

  protected normalizeTextColumnCount(value: unknown): number | undefined {
    const parsed =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(1, Math.min(16, Math.round(parsed)));
  }

  protected normalizeTextLineBreaks(value: string): string {
    return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  protected getTextValueForSave(
    text: string | undefined,
    textSegments: TextSegment[] | undefined,
  ): string {
    if (typeof text === "string") {
      return this.normalizeTextLineBreaks(text);
    }
    if (!textSegments || textSegments.length === 0) {
      return "";
    }
    return this.normalizeTextLineBreaks(
      textSegments.map((segment) => String(segment.text || "")).join(""),
    );
  }
}
