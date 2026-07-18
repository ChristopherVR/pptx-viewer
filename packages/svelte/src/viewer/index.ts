export { PowerPointViewer } from './component';
export { default as Ribbon } from './components/ribbon/Ribbon.svelte';
export type { RibbonProps } from './components/ribbon/ribbon-types';
export { default as ViewerToolbar } from './components/ViewerToolbar.svelte';
export { default as SlideCanvas } from './components/SlideCanvas.svelte';
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
