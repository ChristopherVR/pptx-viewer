// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsHelpers as operations } from 'ooxml-core/pptx/automation';
export const generateElementId = operations.generateElementId;
export const generateSlideId = operations.generateSlideId;
export const describeElement = operations.describeElement;
export const extractSlideText = operations.extractSlideText;
export const validateSlideIndex = operations.validateSlideIndex;
