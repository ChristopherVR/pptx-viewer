import type { MediaPptxElement, XmlObject } from "../../types";

export interface IPptxSlideMediaRelationshipBuilder {
  resolveMediaRelationshipType(
    mediaType: MediaPptxElement["mediaType"],
    relationshipTypes: {
      media: string;
      video: string;
      audio: string;
    },
  ): string;
  getMediaRelationshipIdFromShape(
    shape: XmlObject | undefined,
  ): string | undefined;
  ensureGraphicFrameMediaReference(
    shape: XmlObject,
    mediaType: MediaPptxElement["mediaType"],
    relationshipId: string,
  ): void;
}

export class PptxSlideMediaRelationshipBuilder implements IPptxSlideMediaRelationshipBuilder {
  public resolveMediaRelationshipType(
    mediaType: MediaPptxElement["mediaType"],
    relationshipTypes: {
      media: string;
      video: string;
      audio: string;
    },
  ): string {
    if (mediaType === "audio") return relationshipTypes.audio;
    if (mediaType === "video") return relationshipTypes.video;
    return relationshipTypes.media;
  }

  public getMediaRelationshipIdFromShape(
    shape: XmlObject | undefined,
  ): string | undefined {
    if (!shape) return undefined;
    const graphicData = (shape["a:graphic"] as XmlObject | undefined)?.[
      "a:graphicData"
    ] as XmlObject | undefined;
    if (!graphicData) return undefined;

    const videoRelationshipId = String(
      (graphicData["a:videoFile"] as XmlObject | undefined)?.["@_r:link"] || "",
    ).trim();
    if (videoRelationshipId.length > 0) return videoRelationshipId;

    const audioRelationshipId = String(
      (graphicData["a:audioFile"] as XmlObject | undefined)?.["@_r:link"] || "",
    ).trim();
    return audioRelationshipId.length > 0 ? audioRelationshipId : undefined;
  }

  public ensureGraphicFrameMediaReference(
    shape: XmlObject,
    mediaType: MediaPptxElement["mediaType"],
    relationshipId: string,
  ): void {
    if (!shape["a:graphic"]) {
      shape["a:graphic"] = {};
    }
    const graphicNode = shape["a:graphic"] as XmlObject;
    if (!graphicNode["a:graphicData"]) {
      graphicNode["a:graphicData"] = {};
    }
    const graphicData = graphicNode["a:graphicData"] as XmlObject;
    graphicData["@_uri"] =
      "http://schemas.openxmlformats.org/drawingml/2006/media";

    if (mediaType === "audio") {
      graphicData["a:audioFile"] = { "@_r:link": relationshipId };
      delete graphicData["a:videoFile"];
      return;
    }

    graphicData["a:videoFile"] = { "@_r:link": relationshipId };
    delete graphicData["a:audioFile"];
  }
}
