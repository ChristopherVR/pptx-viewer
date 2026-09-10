import { describe, expect, it } from 'vitest';

import { crc32 } from './png-crc32';
import { encodePngFromPixels, encodePngFromRowBands } from './streaming-png-encoder';

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
	const ds = new DecompressionStream('deflate');
	const writer = ds.writable.getWriter();
	const readerPromise = (async () => {
		const chunks: Uint8Array[] = [];
		const reader = ds.readable.getReader();
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				break;
			}
			chunks.push(value);
		}
		const total = chunks.reduce((sum, c) => sum + c.length, 0);
		const out = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) {
			out.set(c, offset);
			offset += c.length;
		}
		return out;
	})();
	await writer.write(bytes);
	await writer.close();
	return readerPromise;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
	return (
		(bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
	);
}

describe('encodePngFromPixels', () => {
	it('produces a well-formed PNG: signature, IHDR dimensions, valid chunk CRCs', async () => {
		const width = 2;
		const height = 2;
		const pixels = new Uint8Array(width * height * 4);
		pixels.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);

		const png = await encodePngFromPixels(width, height, pixels);

		expect(Array.from(png.subarray(0, 8))).toStrictEqual([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);

		// IHDR chunk: length(4) type(4) width(4) height(4) ...
		const ihdrLength = readU32BE(png, 8);
		expect(ihdrLength).toBe(13);
		const ihdrType = new TextDecoder('latin1').decode(png.subarray(12, 16));
		expect(ihdrType).toBe('IHDR');
		expect(readU32BE(png, 16)).toBe(width);
		expect(readU32BE(png, 20)).toBe(height);

		const ihdrData = png.subarray(16, 29);
		const expectedCrc = crc32(new Uint8Array([...new TextEncoder().encode('IHDR'), ...ihdrData]));
		const actualCrc = readU32BE(png, 29);
		expect(actualCrc >>> 0).toBe(expectedCrc);

		// The trailing 12 bytes are the empty IEND chunk.
		const iendType = new TextDecoder('latin1').decode(png.subarray(png.length - 8, png.length - 4));
		expect(iendType).toBe('IEND');
	});

	it('inflates the IDAT payload back to filter-prefixed scanlines matching the source pixels', async () => {
		const width = 2;
		const height = 2;
		const pixels = new Uint8Array(width * height * 4).fill(7);
		const png = await encodePngFromPixels(width, height, pixels);

		// Locate the single IDAT chunk: signature(8) + IHDR chunk(4+4+13+4=25).
		const idatLenOffset = 8 + 25;
		const idatLength = readU32BE(png, idatLenOffset);
		const idatDataStart = idatLenOffset + 8;
		const zlibBytes = png.subarray(idatDataStart, idatDataStart + idatLength);

		const inflated = await inflate(zlibBytes);
		// Each row: 1 filter byte (0 = None) + width*4 pixel bytes.
		const rowBytes = width * 4 + 1;
		expect(inflated).toHaveLength(rowBytes * height);
		for (let row = 0; row < height; row++) {
			expect(inflated[row * rowBytes]).toBe(0); // filter type None
			const rowPixels = inflated.subarray(row * rowBytes + 1, (row + 1) * rowBytes);
			expect(Array.from(rowPixels)).toStrictEqual(
				Array.from(pixels.subarray(row * width * 4, (row + 1) * width * 4)),
			);
		}
	});
});

describe('encodePngFromRowBands', () => {
	it('streams multiple row-bands into one image without holding the full buffer', async () => {
		const width = 2;
		async function* bands() {
			yield { pixels: new Uint8Array(width * 1 * 4).fill(1), bandHeight: 1 };
			yield { pixels: new Uint8Array(width * 1 * 4).fill(2), bandHeight: 1 };
		}
		const png = await encodePngFromRowBands(width, 2, bands());
		expect(readU32BE(png, 16)).toBe(width);
		expect(readU32BE(png, 20)).toBe(2);
	});

	it('throws when the row-bands do not sum to the declared height', async () => {
		async function* bands() {
			yield { pixels: new Uint8Array(2 * 1 * 4).fill(1), bandHeight: 1 };
		}
		await expect(encodePngFromRowBands(2, 5, bands())).rejects.toThrow(
			/covered 1 rows, expected 5/u,
		);
	});
});
