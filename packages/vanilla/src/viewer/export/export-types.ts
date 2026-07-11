import type { Store, ViewerState } from '../state';

/**
 * Types shared by the per-format export runners (`export-gif.ts`,
 * `export-video.ts`, `export-print.ts`) and the controller that wraps them
 * (`export-controller.ts`). Kept in their own module so the runners never
 * import from the controller (no cycles).
 */

/** Rasterise the slide at `index` to an `HTMLCanvasElement`. Injected so the
 * export modules stay DOM-capture-free and unit-testable. */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type ExportProgress = (current: number, total: number) => void;

/** Dependencies every per-format export runner receives from the controller. */
export interface ExportCaptureDeps {
	store: Store<ViewerState>;
	rasterizeSlide: RasterizeSlide;
	/** Resolved base file name (no extension) for downloads. */
	baseName: string;
}
