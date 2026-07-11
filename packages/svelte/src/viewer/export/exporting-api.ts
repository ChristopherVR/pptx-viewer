import type { ExportController, ExportPdfOptions } from './export-controller.svelte';
import type { ExportGifOptions } from './export-gif';
import type { PrintOptions } from './export-print';
import type { ExportVideoOptions } from './export-video';

/** The imperative export API exposed on the `PowerPointViewer` instance. */
export interface ExportingApi {
	exportSlidePng(index?: number): Promise<void>;
	exportPdf(options?: ExportPdfOptions): Promise<void>;
	exportGif(options?: ExportGifOptions): Promise<void>;
	exportVideo(options?: ExportVideoOptions): Promise<void>;
	print(options?: PrintOptions): Promise<boolean>;
}

/**
 * Build the imperative export API bound to a live `ExportController`.
 * Extracted so `PowerPointViewer.svelte` only re-exports thin, one-line
 * bindings, matching the editing API's `editing-api.ts`.
 */
export function createExportingApi(exporter: ExportController): ExportingApi {
	return {
		exportSlidePng: (index) => exporter.exportSlidePng(index),
		exportPdf: (options) => exporter.exportPdf(options),
		exportGif: (options) => exporter.exportGif(options),
		exportVideo: (options) => exporter.exportVideo(options),
		print: (options) => exporter.print(options),
	};
}
