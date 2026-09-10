import type { RasterizeElementResult, RasterizeElementTilesResult } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';

/**
 * Types shared by the per-format export runners (`export-gif.ts`,
 * `export-video.ts`, `export-print.ts`) and the controller that wraps them
 * (`export-controller.ts`). Kept in their own module so the runners never
 * import from the controller (no cycles).
 */

/**
 * Rasterise the slide at `index` to an `HTMLCanvasElement`. Injected so the
 * export modules stay DOM-capture-free and unit-testable. `scaleMultiplier`
 * (default 1) is an extra factor the print path applies when Options >
 * Advanced > "High quality" is on.
 */
export type RasterizeSlide = (
	index: number,
	scaleMultiplier?: number,
) => Promise<HTMLCanvasElement>;

/**
 * Same capture as {@link RasterizeSlide}, but returns the full
 * `RasterizeElementResult` (tiled `png-bytes` included) instead of a plain
 * canvas. Used by the PNG-export and "copy slide as image" paths so a
 * request whose full resolution exceeds the browser's canvas cap is tiled
 * and stitched into pre-encoded PNG bytes instead of a canvas
 * `toBlob`/`toDataURL` call.
 */
export type RasterizeSlideToRaster = (
	index: number,
	scaleMultiplier?: number,
) => Promise<RasterizeElementResult>;

/**
 * Same capture, but returns the raw per-tile canvases (no PNG stitching).
 * Used by PDF export so a page whose resolution exceeds the browser canvas
 * cap is composed of several small tile images instead of one oversized or
 * stitched canvas.
 */
export type RasterizeSlideToTiles = (
	index: number,
	scaleMultiplier?: number,
) => Promise<RasterizeElementTilesResult>;

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type ExportProgress = (current: number, total: number) => void;

/** Dependencies every per-format export runner receives from the controller. */
export interface ExportCaptureDeps {
	store: Store<ViewerState>;
	rasterizeSlide: RasterizeSlide;
	/**
	 * PNG-export / "copy slide as image" only; see {@link RasterizeSlideToRaster}.
	 * Optional: existing test fixtures that only exercise PDF/GIF/video/print
	 * (none of which touch this path) do not need to supply it.
	 * `exportSlidePng`/`copySlideAsImage` fall back to wrapping
	 * `rasterizeSlide`'s plain canvas when this is omitted.
	 */
	rasterizeSlideToRaster?: RasterizeSlideToRaster;
	/**
	 * PDF export only; see {@link RasterizeSlideToTiles}. Optional for the
	 * same reason `rasterizeSlideToRaster` is: `exportPdf` falls back to
	 * `rasterizeSlide`'s single canvas per page when this is omitted.
	 */
	rasterizeSlideToTiles?: RasterizeSlideToTiles;
	/** Resolved base file name (no extension) for downloads. */
	baseName: string;
	/**
	 * Live translator (host-supplied), for the print path's own UI text.
	 * Optional: only the print path actually needs it, and falls back to a
	 * default English `createTranslator()` when omitted (e.g. a GIF/video
	 * test fixture that never touches print).
	 */
	getTranslator?(): Translator;
	/** Options > Advanced > "Print hidden slides". Defaults to `false` (excluded), matching PowerPoint. */
	getIncludeHiddenSlides?(): boolean;
	/** Options > Advanced > "High quality" raster scale for the print fallback path. */
	getPrintHighQuality?(): boolean;
}
