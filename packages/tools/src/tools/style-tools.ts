// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsStyleTools as operations } from 'ooxml-core/pptx/automation';
export type UpdateElementStyleParams = operations.UpdateElementStyleParams;
export const ALT_TEXT_ELEMENT_TYPES = operations.ALT_TEXT_ELEMENT_TYPES;
export const TITLE_ELEMENT_TYPES = operations.TITLE_ELEMENT_TYPES;
export const applyElementAltText = operations.applyElementAltText;
export const applyElementTitle = operations.applyElementTitle;
export const updateElementStyle = operations.updateElementStyle;
export type AccessibilityIssue = operations.AccessibilityIssue;
export type AccessibilityCheckResult = operations.AccessibilityCheckResult;
export const runAccessibilityCheck = operations.runAccessibilityCheck;
