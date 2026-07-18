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
export { default as WordArtText } from './components/WordArtText.vue';
export { default as CollaborationCursors } from './components/CollaborationCursors.vue';
export type { RemoteCursor } from './components/CollaborationCursors.vue';
export { default as CollaborationStatusIndicator } from './components/CollaborationStatusIndicator.vue';
export { default as RemoteSelectionOverlay } from './components/RemoteSelectionOverlay.vue';
export type { RemoteSelectionBox } from './components/RemoteSelectionOverlay.vue';
export { default as FollowModeBar } from './components/FollowModeBar.vue';
export { default as RibbonToolbar } from './components/ribbon/RibbonToolbar.vue';

export type {
	PowerPointViewerProps,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	CollaborationConfig,
	CollaborationRole,
	CanvasSize,
} from './types';

// `RibbonToolbar`'s prop contract, for composing a custom ribbon/toolbar shell
// with `useRibbonProps` (see `pptx-vue-viewer/composables-unstable`) instead of
// the bundled `PowerPointViewer`. `ViewerMode` is intentionally not
// re-exported here: it is structurally identical to (and satisfied by) the
// `ViewerMode` already exported from `pptx-viewer-shared` / the package root.
export type {
	RibbonProps,
	ToolbarSection,
	DrawingTool,
	SupportedShapeType,
	ElementClipboardPayload,
	TableCellEditorState,
	LayoutOption,
} from './components/ribbon/ribbon-types';

export * from './composables';
export {
	exportSlideToSvg,
	exportSlideToSvgBlob,
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
} from './export-svg';
export type { SvgExportSingleSlideOptions, SvgExportAllOptions } from './export-svg';

export {
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
} from './constants';
