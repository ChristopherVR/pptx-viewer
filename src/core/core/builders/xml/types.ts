import type { PptxComment, XmlObject } from "../../../types";
import type { PptxSaveState } from "../PptxSaveSessionBuilder";

export interface ICoreXmlElementFactory<
  TInit,
  TResult extends XmlObject = XmlObject,
> {
  createXmlElement(init: TInit): TResult;
}

export interface PptxSlideCommentsXmlFactoryInit {
  slideComments: PptxComment[];
  saveState: PptxSaveState;
}

export interface PptxCommentAuthorsXmlFactoryInit {
  saveState: PptxSaveState;
}

export interface IPptxSlideCommentsXmlFactory extends ICoreXmlElementFactory<PptxSlideCommentsXmlFactoryInit> {}

export interface IPptxCommentAuthorsXmlFactory extends ICoreXmlElementFactory<PptxCommentAuthorsXmlFactoryInit> {}

export interface IPptxCommentXmlFactoryProvider {
  createSlideCommentsFactory(): IPptxSlideCommentsXmlFactory;
  createCommentAuthorsFactory(): IPptxCommentAuthorsXmlFactory;
}
