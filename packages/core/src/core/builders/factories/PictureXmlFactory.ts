import type { XmlObject } from "../../types";

import type {
  IPictureXmlFactory,
  PictureXmlFactoryInit,
  PptxBuilderFactoryContext,
} from "./types";

/**
 * Factory that produces OpenXML `p:pic` (picture) XML objects.
 *
 * Generates picture XML including:
 * - `p:nvPicPr` with a unique ID
 * - `p:blipFill` referencing the image via an `r:embed` relationship
 * - `p:spPr` with transform and rectangular preset geometry
 */
export class PictureXmlFactory implements IPictureXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  /** @param context - Shared factory context providing ID generation and unit conversion. */
  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  /**
   * Create a `p:pic` XML object from a picture element model.
   * @param init - Initialization data containing the image element and its relationship ID.
   * @returns A complete OpenXML picture XML object.
   */
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
