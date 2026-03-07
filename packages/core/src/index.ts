/**
 * Root entry-point for the `pptx-viewer-core` package.
 *
 * Re-exports the two main sub-systems:
 *
 * 1. **Core PPTX engine** — parsing, saving, types, geometry helpers,
 *    builder APIs, colour utilities, and runtime services. Everything
 *    needed to open, manipulate, and serialise `.pptx` files in memory.
 *
 * 2. **PPTX-to-Markdown converter** — transforms parsed PPTX data into
 *    Markdown text, optionally extracting media assets to the file system.
 *
 * @packageDocumentation
 * @module pptx-viewer-core
 */

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
