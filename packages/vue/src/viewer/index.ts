export { default as PowerPointViewer } from './PowerPointViewer.vue';
export { default as SlideCanvas } from './components/SlideCanvas.vue';
export { default as SlideStage } from './components/SlideStage.vue';
export { default as ElementRenderer } from './components/ElementRenderer.vue';

export type {
	PowerPointViewerProps,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	CollaborationConfig,
	CollaborationRole,
	CanvasSize,
} from './types';

export * from './composables';

export {
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
} from './constants';
