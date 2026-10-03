// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsSmartartTools as operations } from 'ooxml-core/pptx/automation';
export type ManageSmartArtParams = operations.ManageSmartArtParams;
export type SmartArtNodeInfo = operations.SmartArtNodeInfo;
export type ManageSmartArtResult = operations.ManageSmartArtResult;
export const manageSmartArt = operations.manageSmartArt;
