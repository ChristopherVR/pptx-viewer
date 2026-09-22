/** Compatibility seam for the shared, framework-agnostic AI message helpers. */
export { extractReadyToolCalls, toRenderableParts } from 'pptx-viewer-shared/ai';
export type {
	AiUiMessage,
	ReadyToolCall,
	RenderablePart,
	RenderableTextPart,
	RenderableToolPart,
} from 'pptx-viewer-shared/ai';
