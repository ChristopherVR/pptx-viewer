// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsMetadataTools as operations } from 'ooxml-core/pptx/automation';
export type MetadataResult = operations.MetadataResult;
export const getMetadata = operations.getMetadata;
export type UpdateMetadataParams = operations.UpdateMetadataParams;
export const updateMetadata = operations.updateMetadata;
