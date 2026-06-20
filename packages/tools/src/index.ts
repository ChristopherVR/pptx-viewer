export type { ToolContext, ToolResult } from './types.js';
export type {
	CollaborationProvider,
	FileSystemProvider,
	ViewerProvider,
	ExecutionContext,
} from './types.js';
export { loadPresentation, savePresentation, executeToolWithContext } from './execution.js';
export * from './tools/index.js';

// Re-export the core engine so consumers can load/save PPTX files without a
// separate `pptx-viewer-core` install. The engine ships as a dependency, so a
// single `npm install pptx-viewer-mcp` is enough to use the tools end to end.
export { PptxHandler } from 'pptx-viewer-core';
export type { PptxData, PptxSlide, PptxElement } from 'pptx-viewer-core';
