/**
 * Pure pixel-index math for combining one tile-row's worth of per-tile RGBA
 * buffers into a single full-width row-band, the shape
 * `streaming-png-encoder.ts` consumes. Extracted from `rasterize-element.ts`
 * so the index arithmetic (the part most likely to hide an off-by-one) is
 * unit-testable without a real canvas/`getImageData`.
 */

/** One tile's pixel data, in left-to-right order within its row. */
export interface TileRowPixels {
	/** RGBA pixel bytes, `width * height * 4` bytes, row-major. */
	pixels: Uint8Array | Uint8ClampedArray;
	width: number;
	height: number;
}

/**
 * Combine `tiles` (already in left-to-right column order, all sharing the
 * same height) into one full-width row-band buffer.
 *
 * @param tiles     - This row's tiles, left to right.
 * @param fullWidth - The full output image's width; must equal the sum of
 *                    every tile's width.
 */
export function combineTileRowPixels(
	tiles: readonly TileRowPixels[],
	fullWidth: number,
): Uint8Array {
	if (tiles.length === 0) {
		throw new Error('combineTileRowPixels: at least one tile is required');
	}
	const bandHeight = tiles[0].height;
	const totalWidth = tiles.reduce((sum, t) => sum + t.width, 0);
	if (totalWidth !== fullWidth) {
		throw new Error(
			`combineTileRowPixels: tile widths sum to ${totalWidth}, expected ${fullWidth}`,
		);
	}
	for (const tile of tiles) {
		if (tile.height !== bandHeight) {
			throw new Error('combineTileRowPixels: every tile in a row must share the same height');
		}
	}

	const out = new Uint8Array(fullWidth * 4 * bandHeight);
	for (let y = 0; y < bandHeight; y++) {
		let xOffset = 0;
		for (const tile of tiles) {
			const rowBytes = tile.width * 4;
			const srcStart = y * rowBytes;
			const destStart = y * fullWidth * 4 + xOffset * 4;
			out.set(tile.pixels.subarray(srcStart, srcStart + rowBytes), destStart);
			xOffset += tile.width;
		}
	}
	return out;
}
