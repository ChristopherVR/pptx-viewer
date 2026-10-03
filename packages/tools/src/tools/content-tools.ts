// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsContentTools as operations } from 'ooxml-core/pptx/automation';
export type FindTextParams = operations.FindTextParams;
export type TextMatch = operations.TextMatch;
export type FindTextResult = operations.FindTextResult;
export const findText = operations.findText;
export type ReplaceTextParams = operations.ReplaceTextParams;
export type ReplaceTextResult = operations.ReplaceTextResult;
export const replaceText = operations.replaceText;
export type ManageCommentsParams = operations.ManageCommentsParams;
export type CommentInfo = operations.CommentInfo;
export type ManageCommentsResult = operations.ManageCommentsResult;
export const manageComments = operations.manageComments;
