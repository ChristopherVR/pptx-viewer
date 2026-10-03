// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsHyperlinkTools as operations } from 'ooxml-core/pptx/automation';
export type ManageHyperlinksParams = operations.ManageHyperlinksParams;
export type HyperlinkInfo = operations.HyperlinkInfo;
export type ManageHyperlinksResult = operations.ManageHyperlinksResult;
export const manageHyperlinks = operations.manageHyperlinks;
