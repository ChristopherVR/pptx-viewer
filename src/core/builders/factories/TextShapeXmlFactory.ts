import type { XmlObject } from "../../types";

import type {
  ITextShapeXmlFactory,
  PptxBuilderFactoryContext,
  TextShapeXmlFactoryInit,
} from "./types";

export class TextShapeXmlFactory implements ITextShapeXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  public createXmlElement(init: TextShapeXmlFactoryInit): XmlObject {
    const { element } = init;
    const isText = element.type === "text";
    const name = isText ? "TextBox" : "Rectangle";
    const geometry = this.context.normalizePresetGeometry(element.shapeType);
    const adjustmentEntries = Object.entries(
      element.shapeAdjustments || {},
    ).filter(([key, value]) => key.trim().length > 0 && Number.isFinite(value));
    const avLst =
      adjustmentEntries.length > 0
        ? {
            "a:gd": adjustmentEntries.map(([key, value]) => ({
              "@_name": key,
              "@_fmla": `val ${Math.round(value)}`,
            })),
          }
        : {};

    const elementId = this.context.getNextId();

    return {
      "p:nvSpPr": {
        "p:cNvPr": {
          "@_id": String(elementId),
          "@_name": `${name} ${elementId}`,
        },
        "p:cNvSpPr": {
          "@_txBox": isText ? "1" : "0",
        },
        "p:nvPr": {},
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": {
            "@_x": String(Math.round(element.x * this.context.emuPerPx)),
            "@_y": String(Math.round(element.y * this.context.emuPerPx)),
          },
          "a:ext": {
            "@_cx": String(Math.round(element.width * this.context.emuPerPx)),
            "@_cy": String(Math.round(element.height * this.context.emuPerPx)),
          },
          "@_rot": element.rotation
            ? String(Math.round(element.rotation * 60000))
            : undefined,
          "@_flipH": element.flipHorizontal ? "1" : undefined,
          "@_flipV": element.flipVertical ? "1" : undefined,
        },
        "a:prstGeom": {
          "@_prst": geometry,
          "a:avLst": avLst,
        },
      },
      "p:txBody": {
        "a:bodyPr": {
          "@_wrap": "square",
          "@_rtlCol": "0",
          "@_anchor": this.context.toDrawingTextVerticalAlign(
            element.textStyle?.vAlign,
          ),
        },
        "a:lstStyle": {},
        "a:p": [
          {
            "a:r": {
              "a:rPr": { "@_lang": "en-US" },
              "a:t": isText ? element.text : "",
            },
          },
        ],
      },
    };
  }
}
