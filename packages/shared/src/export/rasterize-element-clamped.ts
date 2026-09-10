/**
 * `rasterizeElement()`, but the requested scale is clamped so the result is
 * always a single canvas (`kind: 'canvas'`) - never tiled `png-bytes`.
 *
 * For a caller that genuinely cannot consume tiled output (JPEG has no way
 * to concatenate tiles the way PNG's row-band encoder does; the notes-PDF
 * layout draws exactly one image into a fixed page region alongside
 * wrapped notes text, not a tile grid), downscaling above the cap is the
 * documented, honest fallback: fidelity (`foreignObject`, preserving
 * `backdrop-filter`/custom properties/3D transforms) is still preserved,
 * only the requested resolution is not, and only once the natural size
 * already exceeds what a single canvas can hold at the requested scale (in
 * practice: a source many thousands of CSS pixels wide, far beyond any real
 * slide).
 */
import { getMaxCanvasDimension } from '../render/canvas-size-probe';
import type { RasterizeElementCanvasResult, RasterizeElementOptions } from './rasterize-element';
import { rasterizeElement } from './rasterize-element';

/** Same result as the common (non-tiled) `rasterizeElement()` case, plus whether the scale had to be reduced. */
export interface RasterizeElementClampedResult extends RasterizeElementCanvasResult {
	/** `true` when `options.scale` was reduced to fit the canvas cap. */
	clamped: boolean;
	/** The scale actually used (equals `options.scale` unless `clamped`). */
	effectiveScale: number;
}

/**
 * Rasterise `element`, reducing `options.scale` (preserving aspect ratio) so
 * the full raster never exceeds the browser's canvas-dimension cap, and
 * therefore never tiles.
 */
export async function rasterizeElementClampedToCanvas(
	element: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	options: RasterizeElementOptions,
): Promise<RasterizeElementClampedResult> {
	const requestedScale = options.scale && options.scale > 0 ? options.scale : 1;
	const maxDim = options.maxCanvasDim ?? getMaxCanvasDimension();
	const fullWidth = naturalWidth * requestedScale;
	const fullHeight = naturalHeight * requestedScale;
	const largestEdge = Math.max(fullWidth, fullHeight);
	const clampFactor = largestEdge > maxDim ? maxDim / largestEdge : 1;
	const effectiveScale = requestedScale * clampFactor;

	const result = await rasterizeElement(element, naturalWidth, naturalHeight, doc, {
		...options,
		scale: effectiveScale,
		maxCanvasDim: maxDim,
	});

	if (result.kind !== 'canvas') {
		// Should not happen (the clamp above guarantees the full raster fits
		// under `maxDim`), but a defensive, honest failure beats a silent
		// `png-bytes` value the caller does not expect.
		throw new Error(
			'rasterizeElementClampedToCanvas: rasterizeElement still tiled after clamping the scale',
		);
	}

	return { ...result, clamped: clampFactor < 1, effectiveScale };
}
