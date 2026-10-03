// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsLayoutTools as operations } from 'ooxml-core/pptx/automation';
export type LayoutInfo = operations.LayoutInfo;
export type GetLayoutsResult = operations.GetLayoutsResult;
export const getLayouts = operations.getLayouts;
export type ApplyLayoutParams = operations.ApplyLayoutParams;
export type ApplyLayoutResult = operations.ApplyLayoutResult;
export const applyLayout = operations.applyLayout;
