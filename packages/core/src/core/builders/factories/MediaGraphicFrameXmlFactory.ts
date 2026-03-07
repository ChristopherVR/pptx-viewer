import type { XmlObject } from "../../types";

import type {
  MediaGraphicFrameXmlFactoryInit,
  IMediaGraphicFrameXmlFactory,
  PptxBuilderFactoryContext,
} from "./types";

/**
 * Factory that produces OpenXML `p:graphicFrame` XML objects for audio and video media.
 *
 * Generates graphic frame XML including:
 * - `p:nvGraphicFramePr` with a unique ID
 * - `p:xfrm` with position, size, rotation, and flip attributes
 * - `a:graphic` / `a:graphicData` referencing the media file via `r:link`
 */
export class MediaGraphicFrameXmlFactory implements IMediaGraphicFrameXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  /** @param context - Shared factory context providing ID generation and unit conversion. */
  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  /**
   * Create a `p:graphicFrame` XML object from a media element model.
   * @param init - Initialization data containing the media element and its relationship ID.
   * @returns A complete OpenXML graphic frame XML object for audio/video.
   */
  public createXmlElement(init: MediaGraphicFrameXmlFactoryInit): XmlObject {
    const { element, relationshipId } = init;
    const mediaId = this.context.getNextId();
    // Determine XML element tag based on media type (a:audioFile vs a:videoFile)
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
