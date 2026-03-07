import type { XmlObject } from "../../types";

import type {
  MediaGraphicFrameXmlFactoryInit,
  IMediaGraphicFrameXmlFactory,
  PptxBuilderFactoryContext,
} from "./types";

export class MediaGraphicFrameXmlFactory implements IMediaGraphicFrameXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  public createXmlElement(init: MediaGraphicFrameXmlFactoryInit): XmlObject {
    const { element, relationshipId } = init;
    const mediaId = this.context.getNextId();
    const mediaType = element.mediaType === "audio" ? "audio" : "video";
    const mediaName = mediaType === "audio" ? "Audio" : "Video";
    const mediaTag = mediaType === "audio" ? "a:audioFile" : "a:videoFile";

    return {
      "p:nvGraphicFramePr": {
        "p:cNvPr": {
          "@_id": String(mediaId),
          "@_name": `${mediaName} ${mediaId}`,
        },
        "p:cNvGraphicFramePr": {},
        "p:nvPr": {},
      },
      "p:xfrm": {
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
      "a:graphic": {
        "a:graphicData": {
          "@_uri": "http://schemas.openxmlformats.org/drawingml/2006/media",
          [mediaTag]: {
            "@_r:link": relationshipId,
          },
        },
      },
    };
  }
}
