/**
 * `rasterizeElement()`'s tiled case, stitched into a single full-resolution
 * `<canvas>` via pure pixel-buffer math (`combineTileRowPixels` +
 * `putImageData`) instead of pre-encoded PNG bytes - for a caller that needs
 * an actual `<canvas>` to hand to a non-PNG consumer: an animated-GIF frame
 * (`ctx.getImageData()`), or a `captureStream()`-backed recording canvas
 * (`ctx.drawImage()`) for video export.
 *
 * Unlike `rasterizeElementClampedToCanvas`, the requested scale/resolution is
 * never reduced: a full raster beyond the browser's canvas cap is rendered as
 * several within-cap tiles (`rasterizeElementTiles()`) and stitched onto one
 * full-size canvas the same way PNG/PDF export escape the cap, so GIF and
 * video exports reach the same resolution PNG and PDF export do instead of
 * silently downscaling. The non-tiled case (the overwhelming majority of
 * exports) returns the single tile's own canvas unchanged, with no stitching
 * cost at all.
 */
import type { RasterizeElementCanvasResult, RasterizeElementOptions } from './rasterize-element';
import type { RasterizedTile } from './rasterize-element-tiles';
import { groupTilesByRow, rasterizeElementTiles } from './rasterize-element-tiles';
import { combineTileRowPixels } from './tile-row-stitch';

/** Same shape as the common (non-tiled) `rasterizeElement()` case, plus whether stitching was needed. */
export interface RasterizeElementTiledCanvasResult extends RasterizeElementCanvasResult {
	/** `true` when the full raster needed more than one tile (stitched via `putImageData`, not a resolution cut). */
	tiled: boolean;
}

function tileToRowPixels(tile: RasterizedTile): {
	pixels: Uint8ClampedArray;
	width: number;
	height: number;
} {
	const ctx = tile.canvas.getContext('2d');
	if (!ctx) {
		throw new Error(
			'rasterizeElementTiledToCanvas: 2D canvas context unavailable while reading a tile',
		);
	}
	const { data, width, height } = ctx.getImageData(0, 0, tile.canvas.width, tile.canvas.height);
	return { pixels: data, width, height };
}

function stitchTilesToCanvas(
	doc: Document,
	fullWidth: number,
	fullHeight: number,
	tiles: readonly RasterizedTile[],
): HTMLCanvasElement {
	const rows = groupTilesByRow(tiles);
	const buffer = new Uint8ClampedArray(fullWidth * fullHeight * 4);

	let yOffset = 0;
	for (const rowTiles of rows) {
		const pixelTiles = rowTiles.map(tileToRowPixels);
		const band = combineTileRowPixels(pixelTiles, fullWidth);
		buffer.set(band, yOffset * fullWidth * 4);
		yOffset += pixelTiles[0].height;
	}

	const canvas = doc.createElement('canvas');
	canvas.width = fullWidth;
	canvas.height = fullHeight;
	const destCtx = canvas.getContext('2d');
	if (!destCtx) {
		throw new Error(
			'rasterizeElementTiledToCanvas: 2D canvas context unavailable for the stitched canvas',
		);
	}
	destCtx.putImageData(new ImageData(buffer, fullWidth, fullHeight), 0, 0);
	return canvas;
}

/**
 * Rasterise `element` (an attached, `naturalWidth` x `naturalHeight` CSS-pixel
 * stage) at `options.scale` into a single full-resolution canvas, tiling and
 * stitching transparently when the requested resolution exceeds the
 * browser's canvas cap - never reducing the scale the way
 * `rasterizeElementClampedToCanvas` does.
 */
export async function rasterizeElementTiledToCanvas(
	element: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	options: RasterizeElementOptions,
): Promise<RasterizeElementTiledCanvasResult> {
	const { fullWidth, fullHeight, tiled, tiles } = await rasterizeElementTiles(
		element,
		naturalWidth,
		naturalHeight,
		doc,
		options,
	);

	if (!tiled) {
		const only = tiles[0];
		return {
			kind: 'canvas',
			canvas: only.canvas,
			strategy: only.strategy,
			width: only.width,
			height: only.height,
			tiled: false,
		};
	}

	const canvas = stitchTilesToCanvas(doc, fullWidth, fullHeight, tiles);
	return {
		kind: 'canvas',
		canvas,
		// Every tile went through the same strategy chain for the same element;
		// the first tile's strategy is representative (matches `rasterizeElement()`'s
		// own `strategies[0]` convention for diagnostics).
		strategy: tiles[0].strategy,
		width: fullWidth,
		height: fullHeight,
		tiled: true,
	};
}
