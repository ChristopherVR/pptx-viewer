import type { XmlObject } from "../../../types";
import type {
  IPptxCommentAuthorsXmlFactory,
  PptxCommentAuthorsXmlFactoryInit,
} from "./types";

export class PptxCommentAuthorsXmlFactory implements IPptxCommentAuthorsXmlFactory {
  public createXmlElement(init: PptxCommentAuthorsXmlFactoryInit): XmlObject {
    return {
      "p:cmAuthorLst": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:r":
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "@_xmlns:p":
          "http://schemas.openxmlformats.org/presentationml/2006/main",
        "p:cmAuthor": init.saveState.getUsedCommentAuthors().map((author) => ({
          "@_id": author.authorId,
          "@_name": author.authorName,
          "@_initials": author.initials,
          "@_lastIdx": String(author.lastCommentIndex),
          "@_clrIdx": String(author.colorIndex),
        })),
      },
    };
  }
}
