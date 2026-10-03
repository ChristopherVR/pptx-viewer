// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsExportTools as operations } from 'ooxml-core/pptx/automation';
export type ExportToSvgParams = operations.ExportToSvgParams;
export type ExportToSvgResult = operations.ExportToSvgResult;
export const exportToSvg = operations.exportToSvg;
export type ExportSlideSvgParams = operations.ExportSlideSvgParams;
export type ExportSlideSvgResult = operations.ExportSlideSvgResult;
export const exportSlideSvg = operations.exportSlideSvg;
