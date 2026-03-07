// ── Core PPTX engine (parse, save, types, geometry, services) ──
export * from "./core";

// ── React-based PowerPoint viewer/editor ──
export {
	PowerPointViewer,
	getAnimationInitialStyle,
} from "./viewer";
export type {
	PowerPointViewerProps,
	PowerPointViewerHandle,
} from "./viewer";

// ── PPTX-to-Markdown converter ──
export {
	PptxMarkdownConverter,
	SlideProcessor,
	DocumentConverter,
	MediaContext,
	normalizePath,
	getDirectory,
	deriveOutputPath,
	dataUrlToMediaBytes,
	generateMediaFilename,
} from "./converter";
export type {
	PptxConverterOptions,
	SlideProcessorOptions,
	FileSystemAdapter,
	ConversionOptions,
	ConversionResult,
} from "./converter";

// ── Canvas export (html2canvas oklch wrapper) ──
export { renderToCanvas } from "./lib/canvas-export";
