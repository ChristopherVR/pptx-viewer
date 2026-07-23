export type {
	CssStyleMap,
	ElementRenderContext,
	ElementRenderer,
	ElementRendererRegistry,
	PptxElementType,
} from './types';
export { createElementRendererRegistry } from './registry';
export { applyStyleMap, composeTransforms, createEl, createSvgEl, setSvgAttrs } from './dom';
export { getShapeFillStrokeStyle, getTextBlockStyle } from './element-styles';
export type { SlideStageOptions } from './slide-stage';
export { renderSlideStage } from './slide-stage';
export { reRenderPresentationElements } from './presentation-rerender';
export * from './elements';
