// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsPresentationTools as operations } from 'ooxml-core/pptx/automation';
export const getPresentationProperties = operations.getPresentationProperties;
export type UpdatePresentationPropertiesParams = operations.UpdatePresentationPropertiesParams;
export const updatePresentationProperties = operations.updatePresentationProperties;
