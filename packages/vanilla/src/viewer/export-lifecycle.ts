import type {
	ExportController,
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
} from './export';
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

/** The export slice of the public viewer API (see `PptxViewerInstance`). */
export interface ViewerExportApi {
	/** Export a single slide as a PNG download. Defaults to the current slide. */
	exportSlidePng(index?: number): Promise<void>;
	/** Copy a slide to the system clipboard as a PNG image. */
	copySlideAsImage(index?: number): Promise<void>;
	/** Export every slide as a multi-page PDF download (one slide per page). */
	exportPdf(options?: ExportPdfOptions): Promise<void>;
	/** Export every slide as an animated GIF download (one frame per slide). */
	exportGif(options?: ExportGifOptions): Promise<void>;
	/** Export every slide as a WebM video download (MediaRecorder). */
	exportVideo(options?: ExportVideoOptions): Promise<void>;
	/** Open the assembled print document in a print window (`false` = blocked). */
	print(options?: PrintOptions): Promise<boolean>;
}

export interface ExportLifecycle extends ViewerExportApi {
	/** Remove the off-screen capture stage from the DOM. */
	destroy(): void;
}

/**
 * Base class implementing the export slice of `PptxViewerInstance` by
 * delegating to the instance's {@link ExportLifecycle}. `PptxViewer` extends
 * this, so new export formats are wired here (and in the export controller)
 * without growing the size-capped `PptxViewer.ts`.
 */
export abstract class ViewerExportHost implements ViewerExportApi {
	protected abstract readonly exporter: ExportLifecycle;

	async exportSlidePng(index?: number): Promise<void> {
		return this.exporter.exportSlidePng(index);
	}

	async copySlideAsImage(index?: number): Promise<void> {
		return this.exporter.copySlideAsImage(index);
	}

	async exportPdf(options?: ExportPdfOptions): Promise<void> {
		return this.exporter.exportPdf(options);
	}

	async exportGif(options?: ExportGifOptions): Promise<void> {
		return this.exporter.exportGif(options);
	}

	async exportVideo(options?: ExportVideoOptions): Promise<void> {
		return this.exporter.exportVideo(options);
	}

	async print(options?: PrintOptions): Promise<boolean> {
		return this.exporter.print(options);
	}
}

/**
 * Build the export feature for one `PptxViewer` instance: the off-screen
 * rasterisation stage (`./export/rasterize-slide.ts`) plus the
 * PNG/PDF/GIF/video/print export controller
 * (`./export/export-controller.ts`) wired to it. Split out of `PptxViewer`
 * (mirrors `chrome-lifecycle.ts`) purely to keep the class file under the
 * file-size budget; owns no state beyond the capture stage.
 */
export function createExportLifecycle(deps: ExportLifecycleDeps): ExportLifecycle {
	const rasterizer = createRasterizeSlide(deps);
	const controller: ExportController = createExportController({
		store: deps.store,
		rasterizeSlide: (index) => rasterizer.rasterizeSlide(index),
	});

	return {
		exportSlidePng: (index) => controller.exportSlidePng(index),
		copySlideAsImage: (index) => controller.copySlideAsImage(index),
		exportPdf: (options) => controller.exportPdf(options),
		exportGif: (options) => controller.exportGif(options),
		exportVideo: (options) => controller.exportVideo(options),
		print: (options) => controller.print(options),
		destroy: () => rasterizer.destroy(),
	};
}
