import type { XmlObject } from "../../../types";
import type {
  IPptxSlideCommentsXmlFactory,
  PptxSlideCommentsXmlFactoryInit,
} from "./types";

export class PptxSlideCommentsXmlFactory implements IPptxSlideCommentsXmlFactory {
  public createXmlElement(init: PptxSlideCommentsXmlFactoryInit): XmlObject {
    return {
      "p:cmLst": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:r":
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "@_xmlns:p":
          "http://schemas.openxmlformats.org/presentationml/2006/main",
        "p:cm": init.slideComments.map((comment, index) =>
          this.createCommentNode(init, comment, index),
        ),
      },
    };
  }

  private createCommentNode(
    init: PptxSlideCommentsXmlFactoryInit,
    comment: PptxSlideCommentsXmlFactoryInit["slideComments"][number],
    fallbackIndex: number,
  ): XmlObject {
    const authorId = init.saveState.resolveCommentAuthorId(comment.author);
    const commentIndex = init.saveState.resolveCommentIndex(
      authorId,
      comment.id,
      fallbackIndex,
    );
    const createdAtIso = this.resolveCreatedAt(comment.createdAt);
    const x = init.saveState.toEmu(comment.x, 0);
    const y = init.saveState.toEmu(comment.y, 0);

    return {
      "@_authorId": authorId,
      "@_dt": createdAtIso,
      "@_idx": String(commentIndex),
      "p:pos": {
        "@_x": String(x),
        "@_y": String(y),
      },
      "p:text": String(comment.text || ""),
    };
  }

  private resolveCreatedAt(createdAt: string | undefined): string {
    const candidate = String(createdAt || "").trim();
    if (candidate.length === 0 || Number.isNaN(Date.parse(candidate))) {
      return new Date().toISOString();
    }
    return new Date(candidate).toISOString();
  }
}
