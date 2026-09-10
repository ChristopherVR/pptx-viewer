import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CanvasSize,
	FieldSubstitutionContext,
	RasterizeElementResult,
	RasterizeElementTilesResult,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';

/** Extracted from `rasterize-slide.ts` purely to keep that file under the file-size budget. */
export interface RasterizeSlideDeps {
	doc: Document;
	/** Host the off-screen capture stage is appended to; removed on `destroy()`. */
	container: HTMLElement;
	getSlides(): PptxSlide[];
	getCanvasSize(): CanvasSize;
	getMediaDataUrls(): Map<string, string>;
	getTranslator(): Translator;
	/** Opt-in WebGL SmartArt renderer flag; see `PowerPointViewerProps.smartArt3D`. */
	smartArt3D: boolean;
	/**
	 * Opt-in WebGL surface-chart renderer flag; see
	 * `PowerPointViewerProps.surfaceChart3D`.
	 */
	surfaceChart3D: boolean;
	/**
	 * Opt-in WebGL bar3D-chart renderer flag; see
	 * `PowerPointViewerProps.barChart3D`.
	 */
	barChart3D: boolean;
	/**
	 * Opt-in WebGL line3D-chart renderer flag; see
	 * `PowerPointViewerProps.lineChart3D`.
	 */
	lineChart3D: boolean;
	/**
	 * Opt-in WebGL area3D-chart renderer flag; see
	 * `PowerPointViewerProps.areaChart3D`.
	 */
	areaChart3D: boolean;
	/**
	 * Opt-in WebGL pie3D-chart renderer flag; see
	 * `PowerPointViewerProps.pieChart3D`.
	 */
	pieChart3D: boolean;
	/**
	 * Options > Advanced > "Default resolution" / "Do not compress images"
	 * raster-scale multiplier (see `resolveImageResolutionScale` in
	 * `pptx-viewer-shared`), applied on top of the baseline capture scale so
	 * the option has real effect without changing the default (highFidelity)
	 * export quality.
	 */
	getImageResolutionScale(): number;
	/**
	 * Deck-level OOXML field-substitution context. The capture stage is mounted
	 * outside the viewer tree, so without this an exported PNG/PDF would print
	 * the authored "Slide #" placeholder while the screen shows "Slide 1".
	 * `SlideStage` re-points its per-slide fields at the slide being captured.
	 */
	getFieldContext?: () => FieldSubstitutionContext | undefined;
	/**
	 * Overridable frame-wait before capture (test seam: the real
	 * `requestAnimationFrame` double-wait is not worth driving through fake
	 * timers). Defaults to `nextFrame` in `rasterize-slide.ts`.
	 */
	waitForFrame?: () => Promise<void>;
}

export interface RasterizeSlideController {
	/**
	 * Mount slide `index` and rasterise it to a single canvas, reducing scale
	 * (never tiling) if the requested resolution would exceed the browser's
	 * canvas cap. `scaleMultiplier` (default 1) is an extra factor on top of
	 * the baseline 2x * Options > Advanced > Image Size/Quality scale; the
	 * Print dialog's notes/handouts raster path passes a higher value when
	 * Options > Advanced > "High quality" is on, without changing plain
	 * PNG/PDF export.
	 */
	rasterizeSlide(index: number, scaleMultiplier?: number): Promise<HTMLCanvasElement>;
	/**
	 * Same capture as {@link rasterizeSlide}, but returns the full
	 * `RasterizeElementResult` instead of unwrapping/clamping to a single
	 * canvas. Used by the PNG-export and "copy slide as image" paths so a
	 * request whose full resolution exceeds the browser's canvas cap is
	 * tiled and stitched (`kind: 'png-bytes'`) instead of downscaled.
	 */
	rasterizeSlideToRaster(index: number, scaleMultiplier?: number): Promise<RasterizeElementResult>;
	/**
	 * Same capture as {@link rasterizeSlide}, but returns the raw per-tile
	 * canvases (no PNG stitching) instead of a single canvas. Used by PDF
	 * export so a page whose resolution exceeds the browser canvas cap is
	 * composed of several small tile images instead of one oversized canvas.
	 */
	rasterizeSlideToTiles(
		index: number,
		scaleMultiplier?: number,
	): Promise<RasterizeElementTilesResult>;
	/** Remove the off-screen capture stage from the DOM. */
	destroy(): void;
}
