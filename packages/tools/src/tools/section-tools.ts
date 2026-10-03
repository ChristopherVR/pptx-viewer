// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsSectionTools as operations } from 'ooxml-core/pptx/automation';
export type ManageSectionsParams = operations.ManageSectionsParams;
export type SectionInfo = operations.SectionInfo;
export type ManageSectionsResult = operations.ManageSectionsResult;
export const manageSections = operations.manageSections;
