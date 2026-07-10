import type { ExportController, ExportPdfOptions } from './export';
import { createExportController, createRasterizeSlide } from './export';
import type { Translator } from './i18n';
import type { ElementRendererRegistry } from './render';
import type { Store, ViewerState } from './state';

export interface ExportLifecycleDeps {
	doc: Document;
	/** Host the off-screen capture stage mounts into; matches the viewer container. */
	container: HTMLElement;
	store: Store<ViewerState>;
	registry: ElementRendererRegistry;
	getTranslator(): Translator;
	smartArt3D: boolean;
}

export interface ExportLifecycle {
	exportSlidePng(index?: number): Promise<void>;
	exportPdf(options?: ExportPdfOptions): Promise<void>;
	/** Remove the off-screen capture stage from the DOM. */
	destroy(): void;
}

/**
 * Build the export feature for one `PptxViewer` instance: the off-screen
 * rasterisation stage (`./export/rasterize-slide.ts`) plus the PNG/PDF export
 * controller (`./export/export-controller.ts`) wired to it. Split out of
 * `PptxViewer` (mirrors `chrome-lifecycle.ts`) purely to keep the class file
 * under the file-size budget; owns no state beyond the capture stage.
 */
export function createExportLifecycle(deps: ExportLifecycleDeps): ExportLifecycle {
	const rasterizer = createRasterizeSlide(deps);
	const controller: ExportController = createExportController({
		store: deps.store,
		rasterizeSlide: (index) => rasterizer.rasterizeSlide(index),
	});

	return {
		exportSlidePng: (index) => controller.exportSlidePng(index),
		exportPdf: (options) => controller.exportPdf(options),
		destroy: () => rasterizer.destroy(),
	};
}
