import type {
	CanvasSize,
	RasterizeElementResult,
	RasterizeElementTilesResult,
} from 'pptx-viewer-shared';
import {
	rasterizeElement,
	rasterizeElementTiledToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';
import { nextTick } from 'vue';
import type { Ref } from 'vue';

import { renderToCanvas } from '../../lib/canvas-export';

export interface UseExportRasterizeInput {
	exportStageRef: Ref<HTMLElement | null>;
	exportIndex: Ref<number>;
	canvasSize: Ref<CanvasSize>;
	/**
	 * File > Options > Advanced > "Image Size and Quality"
	 * (`resolveImageResolutionScale`), read fresh on every rasterize call so a
	 * mid-session change applies without reconstructing this composable.
	 */
	imageExportScale?: () => number;
}

export interface UseExportRasterizeResult {
	rasterizeSlide: (index: number, scaleMultiplier?: number) => Promise<HTMLCanvasElement>;
	rasterizeSlideToRaster: (
		index: number,
		scaleMultiplier?: number,
	) => Promise<RasterizeElementResult>;
	rasterizeSlideToTiles: (
		index: number,
		scaleMultiplier?: number,
	) => Promise<RasterizeElementTilesResult>;
}

/**
 * The off-screen `rasterizeSlide*` family: mounts slide `index` on the
 * shared off-screen stage and rasterises it via the shared `foreignObject`
 * fidelity pipeline, in the three shapes every export/print/copy call site
 * needs. Extracted from `useExportWiring.ts` purely to keep that composable
 * under the file-size budget.
 */
export function useExportRasterize(input: UseExportRasterizeInput): UseExportRasterizeResult {
	const { exportStageRef, exportIndex, canvasSize, imageExportScale } = input;

	/** Mount slide `index` on the off-screen stage and wait for it to paint. */
	async function mountStage(index: number): Promise<HTMLElement> {
		exportIndex.value = index;
		await nextTick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		const stageEl = exportStageRef.value?.querySelector('.pptx-vue-stage') as HTMLElement | null;
		if (!stageEl) {
			throw new Error('Export stage not ready');
		}
		return stageEl;
	}

	/**
	 * The baseline 2x * Options > Advanced > Image Size/Quality scale, times
	 * `scaleMultiplier` (default 1, an extra factor the Print dialog's
	 * notes/handouts raster path applies when Options > Advanced > "High
	 * quality" is on, without changing plain PNG/PDF export).
	 */
	function resolveScale(scaleMultiplier: number): number {
		return 2 * (imageExportScale?.() ?? 1) * scaleMultiplier;
	}

	/** The `html2canvasFallback` every `rasterizeElement*` call below shares. */
	function html2canvasFallback(
		stageEl: HTMLElement,
		sourceRect: { x: number; y: number; width: number; height: number },
		outputSize: { width: number; height: number },
	): Promise<HTMLCanvasElement> {
		return renderToCanvas(stageEl, {
			backgroundColor: '#ffffff',
			scale: outputSize.width / (sourceRect.width || 1),
			x: sourceRect.x,
			y: sourceRect.y,
			width: sourceRect.width,
			height: sourceRect.height,
			logging: false,
		});
	}

	/**
	 * Mount slide `index` and rasterise it via the shared `foreignObject` ->
	 * vector-SVG -> html2canvas fallback chain, always returning the full
	 * `RasterizeElementResult` (tiled `png-bytes` included). Used by PNG
	 * export and "copy slide as image".
	 */
	async function rasterizeSlideToRaster(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementResult> {
		const stageEl = await mountStage(index);
		return rasterizeElement(stageEl, canvasSize.value.width, canvasSize.value.height, document, {
			scale: resolveScale(scaleMultiplier),
			backgroundColor: '#ffffff',
			html2canvasFallback: (sourceRect, outputSize) =>
				html2canvasFallback(stageEl, sourceRect, outputSize),
		});
	}

	/**
	 * Mount slide `index` and rasterise it into its raw per-tile canvases
	 * (never stitched), so a caller that can place several images itself -
	 * a PDF page, which has no canvas-size limit of its own - can escape the
	 * browser canvas cap without ever stitching a PNG. Used by `exportPdf`.
	 */
	async function rasterizeSlideToTiles(
		index: number,
		scaleMultiplier = 1,
	): Promise<RasterizeElementTilesResult> {
		const stageEl = await mountStage(index);
		return rasterizeElementTiles(
			stageEl,
			canvasSize.value.width,
			canvasSize.value.height,
			document,
			{
				scale: resolveScale(scaleMultiplier),
				backgroundColor: '#ffffff',
				html2canvasFallback: (sourceRect, outputSize) =>
					html2canvasFallback(stageEl, sourceRect, outputSize),
			},
		);
	}

	/**
	 * Mount slide `index` and rasterise it to a single full-resolution canvas
	 * via the shared `foreignObject` fidelity pipeline, tiling and stitching
	 * transparently (never reducing the requested scale) if the requested
	 * resolution would exceed the browser's canvas cap. For every caller that
	 * needs exactly one canvas rather than tiled output (GIF/video/notes-PDF/
	 * print, all of which composite or re-encode a canvas per frame, not a
	 * tile grid).
	 */
	async function rasterizeSlide(index: number, scaleMultiplier = 1): Promise<HTMLCanvasElement> {
		const stageEl = await mountStage(index);
		const result = await rasterizeElementTiledToCanvas(
			stageEl,
			canvasSize.value.width,
			canvasSize.value.height,
			document,
			{
				scale: resolveScale(scaleMultiplier),
				backgroundColor: '#ffffff',
				html2canvasFallback: (sourceRect, outputSize) =>
					html2canvasFallback(stageEl, sourceRect, outputSize),
			},
		);
		return result.canvas;
	}

	return { rasterizeSlide, rasterizeSlideToRaster, rasterizeSlideToTiles };
}
