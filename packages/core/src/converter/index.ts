export { PptxMarkdownConverter } from './PptxMarkdownConverter';
export type { PptxConverterOptions } from './PptxMarkdownConverter';
export { SlideProcessor } from './SlideProcessor';
export type { SlideProcessorOptions } from './SlideProcessor';
export { SlideMetadataRenderer } from './SlideMetadataRenderer';
export { DocumentConverter } from './base';
export {
	normalizePath,
	getDirectory,
	deriveOutputPath,
} from './base';
export { MediaContext, dataUrlToMediaBytes, generateMediaFilename } from './media-context';
export type {
	FileSystemAdapter,
	ConversionOptions,
	ConversionResult,
} from './types';
