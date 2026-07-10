import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';
import { ExportController } from './export-controller.svelte';
import type { RasterizeSlideController } from './rasterize-slide';
import { createRasterizeSlide } from './rasterize-slide';

export interface ExportWiringDeps {
	/**
	 * Host the off-screen capture stage is appended to. Read lazily (not
	 * captured eagerly): the viewer root `bind:this` is `undefined` until after
	 * mount, but no export can be triggered before then anyway, so the
	 * rasteriser is only built on the first `exportSlidePng`/`exportPdf` call.
	 */
	getContainer(): HTMLElement | undefined;
	getSlides(): PptxSlide[];
	getCanvasSize(): CanvasSize;
	getMediaDataUrls(): Map<string, string>;
	getCurrent(): number;
	getTranslator(): Translator;
	getSmartArt3D(): boolean;
}

export interface ExportWiring {
	/** The reactive PNG/PDF export controller (`exporting` drives a spinner). */
	controller: ExportController;
	/** Tear down the off-screen capture stage (component destroy). */
	destroy(): void;
}

/**
 * Build the PNG/PDF export feature for one `PowerPointViewer` instance: the
 * off-screen rasterisation stage (`rasterize-slide.ts`, built lazily since it
 * needs a live container element) plus the reactive `ExportController`
 * wired to it. Extracted from `PowerPointViewer.svelte` purely to keep the
 * component's script under the file-size budget, mirroring the vanilla
 * binding's `export-lifecycle.ts`.
 */
export function createExportWiring(deps: ExportWiringDeps): ExportWiring {
	let rasterizer: RasterizeSlideController | null = null;

	function getRasterizer(): RasterizeSlideController {
		if (!rasterizer) {
			rasterizer = createRasterizeSlide({
				doc: document,
				container: deps.getContainer() ?? document.body,
				getSlides: deps.getSlides,
				getCanvasSize: deps.getCanvasSize,
				getMediaDataUrls: deps.getMediaDataUrls,
				getTranslator: deps.getTranslator,
				smartArt3D: deps.getSmartArt3D(),
			});
		}
		return rasterizer;
	}

	const controller = new ExportController({
		getSlideCount: () => deps.getSlides().length,
		getCurrent: deps.getCurrent,
		getCanvasSize: deps.getCanvasSize,
		rasterizeSlide: (index) => getRasterizer().rasterizeSlide(index),
	});

	return {
		controller,
		destroy(): void {
			rasterizer?.destroy();
			rasterizer = null;
		},
	};
}
