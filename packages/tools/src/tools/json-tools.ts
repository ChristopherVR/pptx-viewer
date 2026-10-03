// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsJsonTools as operations } from 'ooxml-core/pptx/automation';
export type ExportToJsonParams = operations.ExportToJsonParams;
export type ExportToJsonResult = operations.ExportToJsonResult;
export const exportToJson = operations.exportToJson;
export type ImportFromJsonParams = operations.ImportFromJsonParams;
export type ImportFromJsonResult = operations.ImportFromJsonResult;
export const importFromJson = operations.importFromJson;
