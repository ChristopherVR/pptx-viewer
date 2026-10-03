// Compatibility exports: all document operations are owned by OOXML core.
import { apiExecution as operations } from 'ooxml-core/pptx/automation';
export const loadPresentation = operations.loadPresentation;
export const savePresentation = operations.savePresentation;
export const executeToolWithContext = operations.executeToolWithContext;
