// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsTableStyleTools as operations } from 'ooxml-core/pptx/automation';
export type SetTableStyleSectionParams = operations.SetTableStyleSectionParams;
export const setTableStyleSection = operations.setTableStyleSection;
export type CreateTableStyleParams = operations.CreateTableStyleParams;
export const createTableStyle = operations.createTableStyle;
export type DeleteTableStyleParams = operations.DeleteTableStyleParams;
export const deleteTableStyle = operations.deleteTableStyle;
export type AssignTableStyleParams = operations.AssignTableStyleParams;
export const assignTableStyle = operations.assignTableStyle;
