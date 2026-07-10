import type { ExportController, ExportPdfOptions } from './export-controller.svelte';

/** The imperative export API exposed on the `PowerPointViewer` instance. */
export interface ExportingApi {
	exportSlidePng(index?: number): Promise<void>;
	exportPdf(options?: ExportPdfOptions): Promise<void>;
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
	};
}
