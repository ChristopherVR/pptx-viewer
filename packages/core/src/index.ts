// ── Core PPTX engine (parse, save, types, geometry, services) ──
export * from "./core";

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
