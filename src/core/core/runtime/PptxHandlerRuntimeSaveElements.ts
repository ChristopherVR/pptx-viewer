import {
  XmlObject,
  TextSegment,
  type ConnectorPptxElement,
  type MediaPptxElement,
  type PptxElementWithText,
  type PptxImageLikeElement,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveParagraphs";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected updateNotesXmlText(
    notesXmlObj: XmlObject,
    notesText: string | undefined,
    notesSegments?: TextSegment[],
  ): boolean {
    const notesRoot = notesXmlObj?.["p:notes"] as XmlObject | undefined;
    const spTree = notesRoot?.["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
    if (!spTree) return false;

    const shapes = this.ensureArray(spTree["p:sp"]) as XmlObject[];
    if (shapes.length === 0) return false;

    const notesBodyShape =
      shapes.find((shape) => {
        const placeholder = shape?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"] as
          | XmlObject
          | undefined;
        const placeholderType = String(placeholder?.["@_type"] || "")
          .trim()
          .toLowerCase();
        return placeholderType === "body";
      }) ||
      shapes.find((shape) => Boolean(shape?.["p:txBody"])) ||
      shapes[0];

    if (!notesBodyShape) return false;
    if (!notesBodyShape["p:txBody"]) {
      notesBodyShape["p:txBody"] = {
        "a:bodyPr": {},
        "a:lstStyle": {},
      };
    }

    const txBody = notesBodyShape["p:txBody"] as XmlObject;

    // If the caller supplied both plain text and rich segments, check whether
    // the segments still match the plain text.  When a consumer sets
    // `slide.notes` directly without updating `notesSegments`, the stale
    // segments would otherwise take precedence (createParagraphsFromTextContent
    // prefers segments when they are present).  Discard stale segments so the
    // updated plain text wins.
    let effectiveSegments = notesSegments;
    if (notesSegments && notesSegments.length > 0 && notesText !== undefined) {
      const segmentsText = notesSegments
        .map((s) => String(s.text ?? ""))
        .join("");
      if (segmentsText !== notesText) {
        effectiveSegments = undefined;
      }
    }

    txBody["a:p"] = this.createParagraphsFromTextContent(
      notesText,
      undefined,
      effectiveSegments,
    );

    return true;
  }

  protected createPictureXml(
    el: PptxImageLikeElement,
    relationshipId: string,
  ): XmlObject {
    return this.elementXmlBuilder.createPictureXml(el, relationshipId);
  }

  protected createMediaGraphicFrameXml(
    el: MediaPptxElement,
    relationshipId: string,
  ): XmlObject {
    return this.elementXmlBuilder.createMediaGraphicFrameXml(
      el,
      relationshipId,
    );
  }

  /**
   * Determine MIME type from a media file path.
   */
  protected getMediaMimeType(
    mediaPath: string | undefined,
  ): string | undefined {
    return this.mediaDataParser.getMediaMimeType(mediaPath);
  }

  protected createElementXml(el: PptxElementWithText): XmlObject {
    return this.elementXmlBuilder.createElementXml(el);
  }

  protected createConnectorXml(el: ConnectorPptxElement): XmlObject {
    return this.elementXmlBuilder.createConnectorXml(el);
  }
}
