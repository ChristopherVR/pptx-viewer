export { PowerPointViewer } from './component';
// .svelte modules must not be re-exported directly from a public barrel: the
// declaration bundling step cannot resolve raw `.svelte` specifiers (see
// `./components/typed-exports.ts`).
export { Ribbon, SlideCanvas, ViewerToolbar } from './components/typed-exports';
export type { RibbonProps } from './components/ribbon/ribbon-types';
export type { SlideCanvasProps, ViewerToolbarProps } from './components/props';
export type {
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
	SvgExportAllOptions,
	SvgExportSingleSlideOptions,
} from './export';
export {
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
	exportSlideAsSvg,
	exportSlideToSvg,
	exportSlideToSvgBlob,
} from './export';
export type {
	CanvasSize,
	PowerPointViewerApi,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
} from './types';
export type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiToolName,
	PptxAiUIMessage,
	PptxAiWritePolicy,
} from 'pptx-viewer-shared/ai';
export type { SvelteAiBridgeDeps } from './ai';
export { createSvelteAiBridge } from './ai';
export {
	clampSlideIndex,
	createViewerState,
	fitScale,
	PresentationLoader,
	resolveNavigationKey,
	ViewerState,
	zoomInPercent,
	zoomOutPercent,
} from './state';
export type { CreateViewerStateOptions, NavigationAction, ViewerStateBag } from './state';
