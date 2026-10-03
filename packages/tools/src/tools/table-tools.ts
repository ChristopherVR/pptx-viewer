// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsTableTools as operations } from 'ooxml-core/pptx/automation';
export type UpdateTableCellsParams = operations.UpdateTableCellsParams;
export const updateTableCells = operations.updateTableCells;
export type ManageTableStructureParams = operations.ManageTableStructureParams;
export const manageTableStructure = operations.manageTableStructure;
