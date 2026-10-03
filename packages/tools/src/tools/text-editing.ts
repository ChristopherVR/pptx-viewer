// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsTextEditing as operations } from 'ooxml-core/pptx/automation';
export const setElementText = operations.setElementText;
export const replaceElementText = operations.replaceElementText;
