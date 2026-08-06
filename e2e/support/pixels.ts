/**
 * Raw raster utilities for the visual-parity harness: a dependency-free PNG
 * encoder and a shift-tolerant RGBA diff.
 *
 * The repo deliberately carries no image library and Playwright ships no
 * encoder, but PNG needs nothing beyond `node:zlib`: a fixed signature, three
 * chunks, and a CRC32. Encoding is enough; decoding stays in the browser
 * (see `support/visual-diff`), where a canvas does it for free.
 *
 * The diff exists to compare the same slide painted at two different zoom
 * factors and then resampled to one canvas, so a naive per-pixel comparison
 * drowns in edge noise: every high-contrast edge lands half a pixel apart and
 * lights up at full delta. `diffRgba` therefore treats a pixel as matching
 * when it has a close colour within one pixel in the OTHER image - checked in
 * BOTH directions, so a feature genuinely missing from either side still
 * counts (a one-way check would forgive dropped hairlines). What survives is
 * area-proportional real difference: wrong fills, missing shapes, moved
 * boxes, not resampling jitter.
 *
 * @module e2e/support/pixels
 */
import { deflateSync } from 'node:zlib';

/** Standard CRC32 (reflected, poly 0xEDB88320) lookup table. */
const CRC_TABLE: Uint32Array = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: length, type, data, CRC over type + data. */
function chunk(type: string, data: Uint8Array): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([length, body, crc]);
}

/**
 * Encode raw RGBA bytes (row-major, 4 bytes per pixel) as a PNG buffer.
 *
 * Always 8-bit RGBA, filter type "none" on every scanline, no interlace: the
 * simplest legal PNG, and every viewer opens it.
 */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
	if (rgba.length !== width * height * 4) {
		throw new Error(
			`encodePng: expected ${width * height * 4} bytes for ${width}x${height}, got ${rgba.length}`,
		);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: truecolour with alpha
	// bytes 10-12 (compression, filter, interlace) stay 0.

	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0; // scanline filter: none
		raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', new Uint8Array(0)),
	]);
}

/** What {@link diffRgba} measured, plus the overlay for a report artifact. */
export interface RgbaDiff {
	/** Pixels with no close colour within one pixel in the other image. */
	differingPixels: number;
	/** Pixels compared (the canvas minus the cropped edge ring). */
	totalPixels: number;
	/** `differingPixels / totalPixels`, 0-1. */
	ratio: number;
	/** Largest shift-tolerant delta seen on any compared pixel. */
	maxDelta: number;
	/** Differing pixels in red over a faded greyscale of the reference. */
	overlay: Uint8Array;
}

/** Max absolute channel difference between pixel `a` in A and pixel `b` in B. */
function channelDelta(imageA: Uint8Array, a: number, imageB: Uint8Array, b: number): number {
	return Math.max(
		Math.abs(imageA[a] - imageB[b]),
		Math.abs(imageA[a + 1] - imageB[b + 1]),
		Math.abs(imageA[a + 2] - imageB[b + 2]),
	);
}

/** Smallest delta between `from[at]` and any 3x3 neighbour of `at` in `to`. */
function nearestDelta(
	from: Uint8Array,
	to: Uint8Array,
	at: number,
	x: number,
	y: number,
	width: number,
	height: number,
): number {
	let best = Number.POSITIVE_INFINITY;
	for (let dy = -1; dy <= 1; dy += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
				continue;
			}
			const delta = channelDelta(from, at, to, (ny * width + nx) * 4);
			if (delta < best) {
				best = delta;
			}
		}
	}
	return best;
}

/**
 * Shift-tolerant diff of two same-size RGBA grids.
 *
 * A pixel differs when its shift-tolerant delta - the larger of "closest
 * match for the candidate pixel anywhere in the reference's 3x3
 * neighbourhood" and the reverse - exceeds `channelThreshold`. `edgeCrop`
 * pixels around the border are skipped entirely: element screenshots of a
 * fractionally-positioned stage can include a one-pixel sliver of the
 * surrounding chrome, which is not slide content.
 */
export function diffRgba(
	reference: Uint8Array,
	candidate: Uint8Array,
	width: number,
	height: number,
	channelThreshold: number,
	edgeCrop = 0,
): RgbaDiff {
	if (reference.length !== width * height * 4 || candidate.length !== reference.length) {
		throw new Error(`diffRgba: both images must be ${width}x${height} RGBA`);
	}

	const overlay = new Uint8Array(width * height * 4);
	let differingPixels = 0;
	let totalPixels = 0;
	let maxDelta = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const at = (y * width + x) * 4;
			const grey = Math.round(
				0.299 * reference[at] + 0.587 * reference[at + 1] + 0.114 * reference[at + 2],
			);
			// Faded greyscale of the reference keeps the overlay legible: the red
			// sits in recognisable surroundings instead of on a blank field.
			const faded = 191 + (grey >> 2);
			overlay[at] = faded;
			overlay[at + 1] = faded;
			overlay[at + 2] = faded;
			overlay[at + 3] = 255;

			if (x < edgeCrop || y < edgeCrop || x >= width - edgeCrop || y >= height - edgeCrop) {
				continue;
			}
			totalPixels += 1;

			// Fast path: most pixels match in place, and the direct delta is an
			// upper bound on the shift-tolerant one.
			let delta = channelDelta(reference, at, candidate, at);
			if (delta > channelThreshold) {
				delta = Math.max(
					nearestDelta(candidate, reference, at, x, y, width, height),
					nearestDelta(reference, candidate, at, x, y, width, height),
				);
			}
			if (delta > maxDelta) {
				maxDelta = delta;
			}
			if (delta > channelThreshold) {
				differingPixels += 1;
				overlay[at] = 255;
				overlay[at + 1] = 0;
				overlay[at + 2] = 0;
			}
		}
	}

	return {
		differingPixels,
		totalPixels,
		ratio: totalPixels === 0 ? 0 : differingPixels / totalPixels,
		maxDelta,
		overlay,
	};
}
