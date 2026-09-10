/**
 * Strategy selection for rasterising one export window (the whole slide for
 * a non-tiled export, or one tile's rectangle for a tiled export). Tries, in
 * order: the SVG `foreignObject` path (preserves `backdrop-filter`, custom
 * properties, 3D transforms because the browser's own engine paints it),
 * then the existing vector-SVG export pipeline rasterised the same way
 * (covers the case a resource could not be embedded as `data:`, so
 * `foreignObject` would taint the canvas), then `html2canvas-pro` as the
 * documented last resort. Every binding's `renderToCanvas` wrapper calls
 * this once per window; only the `html2canvasFallback` driver (the
 * `html2canvas-pro` import itself) stays per-binding.
 */
import type { ForeignObjectSvgBody } from '../render/foreign-object-svg-document';
import { wrapForeignObjectSvg } from '../render/foreign-object-svg-document';
import { ForeignObjectRasterError, rasterizeForeignObjectSvg } from './rasterize-foreign-object';

/** Which path actually produced the tile, for telemetry/tests. */
export type RasterStrategy = 'foreignObject' | 'vectorSvg' | 'html2canvas';

/** A window into the element's natural (unscaled) coordinate space. */
export interface RasterSourceRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The device-pixel size to rasterise `RasterSourceRect` at. */
export interface RasterOutputSize {
	width: number;
	height: number;
}

/** Escape-hatch + fallback wiring, shared by every window/tile of one export. */
export interface RasterStrategyOptions {
	/**
	 * `'html2canvas'` skips straight to the documented legacy fallback (for
	 * callers/tests that need html2canvas-pro's exact historical output).
	 * Default `'auto'` tries `foreignObject` first.
	 */
	mode?: 'auto' | 'html2canvas';
	/**
	 * Re-windows the existing vector-SVG export pipeline's output
	 * (`pptx-viewer-core`'s `SvgExporter`, already produced by the caller at
	 * the element's natural size) to `sourceRect`/`outputSize`. Omit to skip
	 * straight to `html2canvasFallback` when `foreignObject` fails.
	 */
	vectorSvgFallback?: (
		sourceRect: RasterSourceRect,
		outputSize: RasterOutputSize,
	) => Promise<HTMLCanvasElement>;
	/** The per-binding `html2canvas-pro` driver, last resort. */
	html2canvasFallback: (
		sourceRect: RasterSourceRect,
		outputSize: RasterOutputSize,
	) => Promise<HTMLCanvasElement>;
	/** Called whenever a strategy is attempted and fails, for diagnostics/telemetry. */
	onStrategyFailed?: (strategy: RasterStrategy, error: unknown) => void;
}

/** One rasterised window plus which strategy produced it. */
export interface RasterStrategyResult {
	canvas: HTMLCanvasElement;
	strategy: RasterStrategy;
}

/**
 * Guarantee the returned canvas is EXACTLY `outputSize`, regardless of the
 * strategy that produced it.
 *
 * `rasterizeForeignObjectSvg` always sizes its own canvas exactly, but the
 * `vectorSvgFallback`/`html2canvasFallback` drivers are per-binding
 * (`html2canvas-pro`) and derive their capture scale from a source-rect /
 * output-size ratio (`outputSize.width / sourceRect.width`); the round trip
 * `sourceRect.width * (outputSize.width / sourceRect.width)` is not always
 * exactly `outputSize.width` in floating point, so html2canvas can hand back
 * a canvas a pixel narrower/shorter than requested. That is invisible for a
 * single (non-tiled) capture, but `tile-row-stitch.ts`'s
 * `combineTileRowPixels` requires every tile in a row to share the exact
 * same height (and the stitched image's width to be the exact tile-width
 * sum), so a one-pixel drift on any tile throws there instead. Re-drawing
 * onto a canvas of the exact requested size closes that gap once, for every
 * strategy, instead of every caller needing to re-derive it.
 */
function ensureExactSize(
	canvas: HTMLCanvasElement,
	outputSize: RasterOutputSize,
): HTMLCanvasElement {
	if (canvas.width === outputSize.width && canvas.height === outputSize.height) {
		return canvas;
	}
	const exact = document.createElement('canvas');
	exact.width = outputSize.width;
	exact.height = outputSize.height;
	const ctx = exact.getContext('2d');
	if (!ctx) {
		return canvas;
	}
	ctx.drawImage(
		canvas,
		0,
		0,
		canvas.width,
		canvas.height,
		0,
		0,
		outputSize.width,
		outputSize.height,
	);
	return exact;
}

/**
 * Rasterise one window using `body` (already built once per element by the
 * caller; see `rasterize-element.ts`) windowed to `sourceRect`, falling back
 * through vector-SVG and html2canvas in order.
 */
export async function rasterizeWindow(
	body: ForeignObjectSvgBody | undefined,
	sourceRect: RasterSourceRect,
	outputSize: RasterOutputSize,
	backgroundColor: string | undefined,
	options: RasterStrategyOptions,
): Promise<RasterStrategyResult> {
	const { mode = 'auto', vectorSvgFallback, html2canvasFallback, onStrategyFailed } = options;

	if (mode !== 'html2canvas' && body && body.allEmbedded) {
		try {
			const svg = wrapForeignObjectSvg(body.bodyMarkup, {
				viewBoxX: sourceRect.x,
				viewBoxY: sourceRect.y,
				viewBoxWidth: sourceRect.width,
				viewBoxHeight: sourceRect.height,
				outputWidth: outputSize.width,
				outputHeight: outputSize.height,
			});
			const canvas = await rasterizeForeignObjectSvg(
				svg,
				outputSize.width,
				outputSize.height,
				backgroundColor,
			);
			return { canvas: ensureExactSize(canvas, outputSize), strategy: 'foreignObject' };
		} catch (error) {
			onStrategyFailed?.(
				'foreignObject',
				error instanceof ForeignObjectRasterError ? error : error,
			);
		}
	}

	if (mode !== 'html2canvas' && vectorSvgFallback) {
		try {
			const canvas = await vectorSvgFallback(sourceRect, outputSize);
			return { canvas: ensureExactSize(canvas, outputSize), strategy: 'vectorSvg' };
		} catch (error) {
			onStrategyFailed?.('vectorSvg', error);
		}
	}

	const canvas = await html2canvasFallback(sourceRect, outputSize);
	return { canvas: ensureExactSize(canvas, outputSize), strategy: 'html2canvas' };
}
