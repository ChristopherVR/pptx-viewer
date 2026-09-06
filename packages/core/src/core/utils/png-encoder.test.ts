import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodePngDimensions, encodePng } from './png-encoder';

/** Extract the concatenated IDAT payload from a PNG produced by `encodePng`. */
function extractIdat(png: Uint8Array): Uint8Array {
	const chunks: Uint8Array[] = [];
	let offset = 8; // past the PNG signature
	while (offset < png.length) {
		const view = new DataView(png.buffer, png.byteOffset + offset, 8);
		const length = view.getUint32(0, false);
		const type = String.fromCharCode(
			png[offset + 4]!,
			png[offset + 5]!,
			png[offset + 6]!,
			png[offset + 7]!,
		);
		const dataStart = offset + 8;
		if (type === 'IDAT') {
			chunks.push(png.subarray(dataStart, dataStart + length));
		}
		offset = dataStart + length + 4; // skip CRC
	}
	const total = chunks.reduce((sum, c) => sum + c.length, 0);
	const out = new Uint8Array(total);
	let cursor = 0;
	for (const chunk of chunks) {
		out.set(chunk, cursor);
		cursor += chunk.length;
	}
	return out;
}

describe('png-encoder', () => {
	it('produces pixel data that a real zlib inflate decodes back to the exact scanline bytes', () => {
		const width = 3;
		const height = 2;
		const rgba = new Uint8Array(width * height * 4);
		for (let i = 0; i < rgba.length; i++) {
			rgba[i] = i % 256;
		}
		const png = encodePng(width, height, rgba);
		const idat = extractIdat(png);
		const inflated = inflateSync(Buffer.from(idat));

		// Each scanline is a 0 filter-type byte followed by width*4 raw pixel bytes.
		const stride = width * 4;
		expect(inflated).toHaveLength((stride + 1) * height);
		for (let y = 0; y < height; y++) {
			expect(inflated[y * (stride + 1)]).toBe(0); // filter type: None
			const rowBytes = inflated.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
			expect(Buffer.from(rowBytes)).toStrictEqual(
				Buffer.from(rgba.subarray(y * stride, y * stride + stride)),
			);
		}
	});

	it('encodes a valid PNG signature and IHDR for a solid-colour buffer', () => {
		const width = 4;
		const height = 3;
		const rgba = new Uint8Array(width * height * 4);
		for (let i = 0; i < rgba.length; i += 4) {
			rgba[i] = 255;
			rgba[i + 1] = 0;
			rgba[i + 2] = 0;
			rgba[i + 3] = 255;
		}
		const png = encodePng(width, height, rgba);
		expect(png[0]).toBe(0x89);
		expect(png[1]).toBe(0x50); // 'P'
		expect(png[2]).toBe(0x4e); // 'N'
		expect(png[3]).toBe(0x47); // 'G'

		const dims = decodePngDimensions(png);
		expect(dims).toStrictEqual({ width, height });
	});

	it('round-trips dimensions for a 1x1 image', () => {
		const png = encodePng(1, 1, new Uint8Array([10, 20, 30, 255]));
		expect(decodePngDimensions(png)).toStrictEqual({ width: 1, height: 1 });
	});

	it('throws when the pixel buffer length does not match width*height*4', () => {
		expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow();
	});

	it('returns undefined for bytes with no PNG signature', () => {
		expect(decodePngDimensions(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
	});
});
