import type { XmlObject } from "../../types";

import type {
  IPictureXmlFactory,
  PictureXmlFactoryInit,
  PptxBuilderFactoryContext,
} from "./types";

export class PictureXmlFactory implements IPictureXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  public createXmlElement(init: PictureXmlFactoryInit): XmlObject {
    const { element, relationshipId } = init;
    const pictureId = this.context.getNextId();

    return {
      "p:nvPicPr": {
        "p:cNvPr": {
          "@_id": String(pictureId),
          "@_name": `Picture ${pictureId}`,
        },
        "p:cNvPicPr": {},
        "p:nvPr": {},
      },
      "p:blipFill": {
        "a:blip": {
          "@_r:embed": relationshipId,
        },
        "a:stretch": {
          "a:fillRect": {},
        },
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
          "@_prst": "rect",
          "a:avLst": {},
        },
      },
    };
  }
}
