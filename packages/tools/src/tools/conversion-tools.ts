// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsConversionTools as operations } from 'ooxml-core/pptx/automation';
export type ConvertToMarkdownParams = operations.ConvertToMarkdownParams;
export type ConvertToMarkdownResult = operations.ConvertToMarkdownResult;
export const convertToMarkdown = operations.convertToMarkdown;
