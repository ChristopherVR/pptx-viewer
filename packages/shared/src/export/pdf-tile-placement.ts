/**
 * Pure geometry for placing one export tile (from `rasterize-element-tiles.ts`)
 * onto a PDF page, so PDF/notes-PDF export can embed several small,
 * cap-respecting tile images per page instead of one full-page image -
 * escaping the browser canvas cap for PDF the same way PNG export does,
 * without ever needing to stitch a PNG at all (a PDF page has no canvas-size
 * limit of its own).
 *
 * Every tile is placed exactly where a single full-page image would have
 * been fitted (preserving aspect ratio, centered within the page): this one
 * function covers both a native-size page (`pageWidth`/`pageHeight` equal to
 * the element's natural size, the vue/svelte/vanilla/angular jsPDF
 * convention, where the fit is exact and `offsetX`/`offsetY` are always 0)
 * and a fixed page size the image is letterboxed into (the react hand-rolled
 * PDF encoder's fixed-A4 convention).
 *
 * Coordinates returned are **top-down** (y grows downward from the page's
 * top edge), matching both the DOM/tile convention this module reads from
 * and jsPDF's own `addImage(data, format, x, y, w, h)` contract. A caller
 * writing raw PDF content-stream bytes (whose native coordinate space is
 * bottom-up) must flip: `rawY = pageHeight - placement.y - placement.height`.
 */

/** A tile's full-raster rectangle, in device pixels (see `RasterizedTile`). */
export interface TileDeviceRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Where a tile lands on the page, in the page's own units (pt or px). Top-down. */
export interface TilePagePlacement {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Compute `tile`'s placement on a `pageWidth` x `pageHeight` page, given the
 * full (un-tiled) raster's device-pixel size. The full raster is fitted into
 * the page preserving aspect ratio and centered, exactly like a single
 * full-page image would be; `tile` occupies the proportional sub-rectangle
 * of that fitted placement.
 */
export function placeTileOnPage(
	tile: TileDeviceRect,
	fullWidth: number,
	fullHeight: number,
	pageWidth: number,
	pageHeight: number,
): TilePagePlacement {
	const fitScale =
		fullWidth > 0 && fullHeight > 0 ? Math.min(pageWidth / fullWidth, pageHeight / fullHeight) : 0;
	const fittedWidth = fullWidth * fitScale;
	const fittedHeight = fullHeight * fitScale;
	const offsetX = (pageWidth - fittedWidth) / 2;
	const offsetY = (pageHeight - fittedHeight) / 2;

	return {
		x: offsetX + tile.x * fitScale,
		y: offsetY + tile.y * fitScale,
		width: tile.width * fitScale,
		height: tile.height * fitScale,
	};
}
