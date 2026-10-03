// Compatibility exports: all document operations are owned by OOXML core.
import { apiTypes as operations } from 'ooxml-core/pptx/automation';
export type ToolContext = operations.ToolContext;
export type TableStyleSaveOptions = operations.TableStyleSaveOptions;
export type ToolResult<T = unknown> = operations.ToolResult<T>;
export type { PptxData, PptxSlide, PptxElement } from 'ooxml-core/pptx/automation';
export type CollaborationProvider = operations.CollaborationProvider;
export type FileSystemProvider = operations.FileSystemProvider;
export type ViewerProvider = operations.ViewerProvider;
export type ExecutionContext = operations.ExecutionContext;
