/**
 * PNG encoding driven by the browser's native `CompressionStream('deflate')`
 * (zlib/RFC-1950 framing, exactly what a PNG `IDAT` chunk needs) instead of a
 * hand-rolled Huffman/LZ77 implementation. This is the "pure JS PNG encoder"
 * referenced by the tiled-export feature: no npm image-compression
 * dependency, only the byte framing in `png-chunk-builder`/`png-row-filter`
 * plus a platform API every export target (Chromium, Firefox, Safari 16.4+,
 * Bun/Node 18+) already implements.
 *
 * Rows are streamed in **row-bands** (one tile-row's worth of pixels at a
 * time) rather than requiring the full image resident in memory at once.
 * This is what makes a tiled 8x export of a large slide feasible: peak
 * memory is bounded by one row-band (tile height x full width x 4 bytes),
 * not by the full output image, which is exactly the case the browser
 * canvas-size cap prevented from ever being materialised as a single canvas
 * in the first place.
 */
import { assemblePng, buildIdatChunk } from './png-chunk-builder';
import { filterPixelBlock } from './png-row-filter';

/** One row-band: `bandHeight` full-width RGBA rows, top-to-bottom within the band. */
export interface PngRowBand {
	/** Raw RGBA pixel bytes, `width * 4 * bandHeight` bytes, row-major. */
	readonly pixels: Uint8Array;
	/** Number of rows this band covers. */
	readonly bandHeight: number;
}

async function concatChunks(parts: readonly Uint8Array[]): Promise<Uint8Array> {
	const total = parts.reduce((sum, p) => sum + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/**
 * Compress a sequence of already-filtered scanline byte blocks into a single
 * zlib (RFC-1950) stream via `CompressionStream('deflate')`, reading and
 * writing concurrently so the stream's internal backpressure can never
 * deadlock the write loop.
 */
async function deflateBlocks(blocks: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
	const cs = new CompressionStream('deflate');
	const writer = cs.writable.getWriter();
	const reader = cs.readable.getReader();

	const outChunks: Uint8Array[] = [];
	const readLoop = (async () => {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				break;
			}
			outChunks.push(value);
		}
	})();

	for await (const block of blocks) {
		// Re-wrap as an `ArrayBuffer`-backed view: `block` may be typed as
		// `Uint8Array<ArrayBufferLike>` (e.g. a `subarray()`/view result), but
		// `WritableStreamDefaultWriter<Uint8Array<ArrayBuffer>>.write` requires
		// the narrower `ArrayBuffer` backing, not the `SharedArrayBuffer`-
		// inclusive `ArrayBufferLike`.
		await writer.write(new Uint8Array(block));
	}
	await writer.close();
	await readLoop;

	return concatChunks(outChunks);
}

/**
 * Encode a full-resolution PNG from a sequence of row-bands, without ever
 * holding the full uncompressed image in memory.
 *
 * @param width     - Full image width in pixels.
 * @param height    - Full image height in pixels. Must equal the sum of every
 *                    band's `bandHeight`.
 * @param rowBands  - Row-bands in top-to-bottom order, each covering the
 *                    full image width.
 */
export async function encodePngFromRowBands(
	width: number,
	height: number,
	rowBands: AsyncIterable<PngRowBand>,
): Promise<Uint8Array> {
	let coveredRows = 0;

	async function* filteredBlocks(): AsyncGenerator<Uint8Array> {
		for await (const band of rowBands) {
			coveredRows += band.bandHeight;
			yield filterPixelBlock(band.pixels, width, band.bandHeight);
		}
	}

	const zlibBytes = await deflateBlocks(filteredBlocks());

	if (coveredRows !== height) {
		throw new Error(
			`encodePngFromRowBands: row-bands covered ${coveredRows} rows, expected ${height}`,
		);
	}

	return assemblePng(width, height, [buildIdatChunk(zlibBytes)]);
}

/**
 * Convenience wrapper for the common non-tiled case: encode a single RGBA
 * pixel buffer already resident in memory (e.g. one `getImageData()` call)
 * as a PNG, via the same row-band streaming path.
 */
export async function encodePngFromPixels(
	width: number,
	height: number,
	pixels: Uint8Array,
): Promise<Uint8Array> {
	async function* single(): AsyncGenerator<PngRowBand> {
		yield { pixels, bandHeight: height };
	}
	return encodePngFromRowBands(width, height, single());
}
