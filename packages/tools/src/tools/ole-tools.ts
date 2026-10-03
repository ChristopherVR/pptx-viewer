// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsOleTools as operations } from 'ooxml-core/pptx/automation';
export type GetOleContentParams = operations.GetOleContentParams;
export type GetOleContentResult = operations.GetOleContentResult;
export const getOleContent = operations.getOleContent;
export type SetOleContentResult = operations.SetOleContentResult;
export type SetOleSheetCellParams = operations.SetOleSheetCellParams;
export const setOleSheetCell = operations.setOleSheetCell;
export type SetOleDocumentParagraphParams = operations.SetOleDocumentParagraphParams;
export const setOleDocumentParagraph = operations.setOleDocumentParagraph;
export type SetOleDeckSlideTitleParams = operations.SetOleDeckSlideTitleParams;
export const setOleDeckSlideTitle = operations.setOleDeckSlideTitle;
export type SetOleObjectNameParams = operations.SetOleObjectNameParams;
export const setOleObjectNameT = operations.setOleObjectNameT;
export type ReplaceOleFileParams = operations.ReplaceOleFileParams;
export const replaceOleFileT = operations.replaceOleFileT;
