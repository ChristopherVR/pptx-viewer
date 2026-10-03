// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsValidationTools as operations } from 'ooxml-core/pptx/automation';
export type ValidatePresentationResult = operations.ValidatePresentationResult;
export const validatePresentation = operations.validatePresentation;
export type RepairPresentationResult = operations.RepairPresentationResult;
export const repairPresentation = operations.repairPresentation;
