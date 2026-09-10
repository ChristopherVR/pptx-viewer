/**
 * PNG scanline filtering (pure byte math, no compression). Every PNG
 * scanline is prefixed with a one-byte filter-type tag; filter type 0
 * ("None") is used here, the simplest legal choice. It does not shrink the
 * pre-compression size the way Sub/Up/Paeth would, but `streaming-png-encoder`
 * still deflates the result through the browser's native `CompressionStream`,
 * so output stays reasonably small while this module stays trivially correct
 * and independent of pixel content (important for the row-band streaming
 * path, which never has adjacent rows from other tiles in memory to filter
 * against).
 */

/** Bytes per pixel for 8-bit RGBA, PNG's `getImageData`-native format. */
export const RGBA_BYTES_PER_PIXEL = 4;

/**
 * Prefix one scanline of RGBA pixel bytes with the filter-type-0 tag.
 *
 * @param rowRgba - Exactly `width * 4` bytes for one image row.
 */
export function filterRowNone(rowRgba: Uint8Array): Uint8Array {
	const out = new Uint8Array(rowRgba.length + 1);
	out[0] = 0; // filter type: None
	out.set(rowRgba, 1);
	return out;
}

/**
 * Filter every row of a full RGBA pixel block (`height` rows of `width * 4`
 * bytes each) and concatenate the results, producing the exact byte layout
 * PNG's IDAT stream expects before deflate compression.
 */
export function filterPixelBlock(pixels: Uint8Array, width: number, height: number): Uint8Array {
	const rowBytes = width * RGBA_BYTES_PER_PIXEL;
	if (pixels.length !== rowBytes * height) {
		throw new Error(
			`filterPixelBlock: expected ${rowBytes * height} bytes for ${width}x${height} RGBA, got ${pixels.length}`,
		);
	}
	const out = new Uint8Array((rowBytes + 1) * height);
	for (let row = 0; row < height; row++) {
		const srcStart = row * rowBytes;
		out[row * (rowBytes + 1)] = 0; // filter type: None
		out.set(pixels.subarray(srcStart, srcStart + rowBytes), row * (rowBytes + 1) + 1);
	}
	return out;
}
