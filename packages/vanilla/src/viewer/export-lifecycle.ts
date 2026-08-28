import type {
	ExportController,
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
} from './export';
import {
	createExportController,
	createExportProgressModal,
	createExportProgressUi,
	createRasterizeSlide,
} from './export';
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
	/**
	 * The six 3D opt-in flags as getters (not plain booleans), each already
	 * ANDed with Options > Advanced > "Disable 3D rendering" by the caller
	 * (see `resolve3DRenderingFlags`) and read fresh on every export/print so
	 * a mid-session toggle reaches the very next one. See `RasterizeSlideDeps`.
	 */
	getSmartArt3D(): boolean;
	getSurfaceChart3D(): boolean;
	getBarChart3D(): boolean;
	getLineChart3D(): boolean;
	getAreaChart3D(): boolean;
	getPieChart3D(): boolean;
	/**
	 * Options > Advanced > "Default resolution" / "Do not compress images"
	 * raster-scale multiplier (see `resolveImageResolutionScale`), read fresh
	 * on every rasterize call so a mid-session change reaches the next export.
	 */
	getImageResolutionScale(): number;
	/**
	 * Options > Advanced > "Print hidden slides", read fresh on every print so a
	 * mid-session toggle reaches the very next print job.
	 */
	getIncludeHiddenSlides?(): boolean;
	/**
	 * Options > Advanced > "High quality" raster scale for the print
	 * notes/handouts fallback path, read fresh on every print.
	 */
	getPrintHighQuality?(): boolean;
	/** Source file name (title-bar name); drives export download names. */
	fileName?: string;
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
	/** Serialize the deck to `pptx-viewer-json` and trigger the download. */
	exportJson(): void;
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

	exportJson(): void {
		this.exporter.exportJson();
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
		fileName: deps.fileName,
		getTranslator: deps.getTranslator,
		getIncludeHiddenSlides: deps.getIncludeHiddenSlides,
		getPrintHighQuality: deps.getPrintHighQuality,
	});
	// Multi-slide exports (PDF / GIF / video) run through the progress envelope
	// so a visible modal (bar + status + Cancel) accompanies them, exactly like
	// the other four bindings' ExportProgressModal. PNG/copy (single capture)
	// and print (owns its own surface) stay modal-less, matching those bindings.
	const modal = createExportProgressModal({
		doc: deps.doc,
		getTranslator: deps.getTranslator,
		onCancel: () => progressUi.cancel(),
	});
	const progressUi = createExportProgressUi({
		modal,
		controller,
		getTranslator: deps.getTranslator,
	});

	return {
		exportSlidePng: (index) => controller.exportSlidePng(index),
		copySlideAsImage: (index) => controller.copySlideAsImage(index),
		exportPdf: (options) => progressUi.runPdf(options),
		exportJson: () => controller.exportJson(),
		exportGif: (options) => progressUi.runGif(options),
		exportVideo: (options) => progressUi.runVideo(options),
		print: (options) => controller.print(options),
		destroy: () => {
			progressUi.cancel();
			rasterizer.destroy();
		},
	};
}
