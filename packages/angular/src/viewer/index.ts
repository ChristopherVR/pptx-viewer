export { PowerPointViewerComponent } from './power-point-viewer.component';
export { SlideCanvasComponent } from './slide-canvas.component';
export { ElementRendererComponent } from './element-renderer.component';
export { ConnectorRendererComponent } from './connector-renderer.component';
export { TableRendererComponent } from './table-renderer.component';
export { ChartRendererComponent } from './chart-renderer.component';
export { SmartArtRendererComponent } from './smart-art-renderer.component';
export { InkRendererComponent } from './ink-renderer.component';
export { OleRendererComponent } from './ole-renderer.component';
export { Model3DRendererComponent } from './model3d-renderer.component';
export { ZoomRendererComponent } from './zoom-renderer.component';
export { PresentationOverlayComponent } from './presentation-overlay.component';
export { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
export { FindBarComponent } from './find-bar.component';
export { InspectorPanelComponent } from './inspector-panel.component';
export { SlidesPanelComponent } from './slides-panel.component';
export { EditorToolbarComponent } from './editor-toolbar.component';
export { EditorContextMenuComponent } from './editor-context-menu.component';
export { collectElementText, collectSlideText, searchSlides } from './slide-search';
export { ExportService } from './export.service';
export { renderToCanvas } from '../lib/canvas-export';
export { EditorStateService } from './editor-state.service';
export { EditorHistory } from './editor-history';
export {
	updateElementById,
	moveElementBy,
	setElementPosition,
	resizeElement,
	deleteElementsByIds,
	duplicateElementById,
	bringToFront,
	sendToBack,
	bringForward,
	sendBackward,
} from './element-operations';
export { applyMove, applyResize, RESIZE_HANDLES, type ResizeHandle, type Box } from './drag-resize';
export { resolveParagraphBullet, formatAutoNumber, bulletIndentPx } from './text-bullets';
export { EquationRendererComponent } from './equation-renderer.component';
export { ommlToMathml, convertOmmlToMathMl } from './omml-to-mathml';
export { LoadContentService } from './load-content.service';

export type { CanvasSize, CollaborationConfig, CollaborationRole } from './types';
export type { StyleMap } from './element-style';
export {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
	getImageSrc,
} from './element-style';
export { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './shape-geometry';
export { getSlideBackgroundStyle, DEFAULT_SLIDE_BACKGROUND } from './slide-background';
export { resolveHyperlinkHref, isUrlSafe, isPpactionUrl } from './hyperlink';
export { buildCssGradientFromShapeStyle } from './color-gradient';
export { getPatternSvg, buildPatternFillCss } from './color-patterns';
export {
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
} from './constants';
