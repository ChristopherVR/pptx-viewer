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

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type ExportProgress = (current: number, total: number) => void;

/** Dependencies every per-format export runner receives from the controller. */
export interface ExportCaptureDeps {
	store: Store<ViewerState>;
	rasterizeSlide: RasterizeSlide;
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
