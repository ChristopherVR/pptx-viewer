import { PptxCommentAuthorsXmlFactory } from "./PptxCommentAuthorsXmlFactory";
import { PptxSlideCommentsXmlFactory } from "./PptxSlideCommentsXmlFactory";
import type {
  IPptxCommentAuthorsXmlFactory,
  IPptxCommentXmlFactoryProvider,
  IPptxSlideCommentsXmlFactory,
} from "./types";

export class PptxCommentXmlFactoryProvider implements IPptxCommentXmlFactoryProvider {
  public createSlideCommentsFactory(): IPptxSlideCommentsXmlFactory {
    return new PptxSlideCommentsXmlFactory();
  }

  public createCommentAuthorsFactory(): IPptxCommentAuthorsXmlFactory {
    return new PptxCommentAuthorsXmlFactory();
  }
}
