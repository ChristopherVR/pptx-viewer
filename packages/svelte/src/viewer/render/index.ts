/**
 * Per-element view-model builders for the rich renderers (table, chart,
 * SmartArt, media, ink, OLE, contentPart, zoom, model3d). Each module keeps
 * the lintable logic out of the `.svelte` SFCs and delegates every pure
 * computation to `pptx-viewer-shared`.
 */
export { buildTableRows, columnWidthStyles } from './table-view';
export type { TableCellView, TableRowView, TableRunView } from './table-view';
export { buildChartView, buildLegendItems, partAttrs, resolveChartPalette } from './chart-view';
export type { ChartLegendItem, ChartView } from './chart-view';
export {
	buildSmartArtView,
	SMARTART_CONNECTOR_STROKE,
	SMARTART_SVG_STYLE,
	smartArtAriaLabel,
	smartArtChromeStyle,
	svgTextLines,
} from './smartart-view';
export type { SmartArtView, SvgTextLine } from './smartart-view';
export { buildInkStrokes, inkViewBox } from './ink-view';
export type { InkStrokeView } from './ink-view';
export { registerCrossSlideAudio, resolveMediaView } from './media-view';
export type { MediaView } from './media-view';
export { buildOleView, getOleIconShapes } from './ole-view';
export type { OleIconShape, OleView } from './ole-view';
export { buildContentPartStrokes, contentPartViewBox } from './contentpart-view';
export type { ContentPartStrokeView } from './contentpart-view';
export { resolveZoomView } from './zoom-view';
export type { ZoomView } from './zoom-view';
export { DEFAULT_MODEL_MIME, modelDataToBlobUrl } from './model3d-view';
export { buildSmartArt3DViewModel } from './smart-art-3d-view';
