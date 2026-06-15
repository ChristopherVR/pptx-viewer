export { default as PowerPointViewer } from './PowerPointViewer.vue';
export { default as SlideCanvas } from './components/SlideCanvas.vue';
export { default as SlideStage } from './components/SlideStage.vue';
export { default as ElementRenderer } from './components/ElementRenderer.vue';
export { default as ConnectorRenderer } from './components/ConnectorRenderer.vue';
export { default as TableRenderer } from './components/TableRenderer.vue';
export { default as ChartRenderer } from './components/ChartRenderer.vue';
export { default as SmartArtRenderer } from './components/SmartArtRenderer.vue';
export { default as InkRenderer } from './components/InkRenderer.vue';
export { default as OleRenderer } from './components/OleRenderer.vue';
export { default as Model3DRenderer } from './components/Model3DRenderer.vue';
export { default as ZoomRenderer } from './components/ZoomRenderer.vue';
export { default as EquationRenderer } from './components/EquationRenderer.vue';

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
