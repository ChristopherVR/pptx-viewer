export { PowerPointViewerComponent } from './power-point-viewer.component';
export { SlideCanvasComponent } from './slide-canvas.component';
export { ElementRendererComponent } from './element-renderer.component';
export { LoadContentService } from './load-content.service';

export type { CanvasSize, CollaborationConfig, CollaborationRole } from './types';
export type { StyleMap } from './element-style';
export {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
	getImageSrc,
} from './element-style';
export {
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
} from './constants';
