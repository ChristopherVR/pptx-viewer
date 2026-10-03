// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsMergeTools as operations } from 'ooxml-core/pptx/automation';
export type MergePresentationParams = operations.MergePresentationParams;
export type MergePresentationResult = operations.MergePresentationResult;
export const mergePresentationT = operations.mergePresentationT;
export type DiffPresentationsParams = operations.DiffPresentationsParams;
export const diffPresentationsT = operations.diffPresentationsT;
