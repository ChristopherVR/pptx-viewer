import { describe, expect, it } from 'vitest';

import { decodeBmpFirstPixel } from './image-first-pixel-bmp';

/** Build a minimal, valid 24-bit BI_RGB BMP (bottom-up unless `topDown`). */
function buildBmp24(opts: {
	width: number;
	height: number;
	rowsTopToBottom: [number, number, number][][]; // [r,g,b] per pixel per row
	topDown?: boolean;
}): Uint8Array {
	const rowStride = Math.ceil((opts.width * 24) / 32) * 4;
	const pixelDataOffset = 54;
	const fileSize = pixelDataOffset + rowStride * opts.height;
	const buf = new Uint8Array(fileSize);
	const view = new DataView(buf.buffer);
	buf[0] = 0x42;
	buf[1] = 0x4d;
	view.setUint32(2, fileSize, true);
	view.setUint32(10, pixelDataOffset, true);
	view.setUint32(14, 40, true); // BITMAPINFOHEADER
	view.setInt32(18, opts.width, true);
	view.setInt32(22, opts.topDown ? -opts.height : opts.height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	view.setUint32(30, 0, true); // BI_RGB

	const storedRows = opts.topDown ? opts.rowsTopToBottom : [...opts.rowsTopToBottom].reverse();
	for (let r = 0; r < storedRows.length; r++) {
		const row = storedRows[r]!;
		const rowStart = pixelDataOffset + r * rowStride;
		for (let x = 0; x < row.length; x++) {
			const [red, green, blue] = row[x]!;
			buf[rowStart + x * 3] = blue;
			buf[rowStart + x * 3 + 1] = green;
			buf[rowStart + x * 3 + 2] = red;
		}
	}
	return buf;
}

describe('decodeBmpFirstPixel', () => {
	it('reads (0,0) from a bottom-up 24-bit BMP (top row is stored LAST)', () => {
		const bmp = buildBmp24({
			width: 2,
			height: 2,
			rowsTopToBottom: [
				[
					[0, 255, 0],
					[9, 9, 9],
				], // top row: green, x
				[
					[1, 2, 3],
					[4, 5, 6],
				], // bottom row
			],
		});
		expect(decodeBmpFirstPixel(bmp)).toStrictEqual({ r: 0, g: 255, b: 0, a: 255 });
	});

	it('reads (0,0) from a top-down 24-bit BMP (negative height)', () => {
		const bmp = buildBmp24({
			width: 2,
			height: 2,
			topDown: true,
			rowsTopToBottom: [
				[
					[10, 20, 30],
					[9, 9, 9],
				],
				[
					[1, 2, 3],
					[4, 5, 6],
				],
			],
		});
		expect(decodeBmpFirstPixel(bmp)).toStrictEqual({ r: 10, g: 20, b: 30, a: 255 });
	});

	it('reads (0,0) from an 8-bit paletted bottom-up BMP', () => {
		const width = 4;
		const height = 2;
		const paletteCount = 256;
		const rowStride = Math.ceil((width * 8) / 32) * 4;
		const paletteOffset = 54;
		const pixelDataOffset = paletteOffset + paletteCount * 4;
		const fileSize = pixelDataOffset + rowStride * height;
		const buf = new Uint8Array(fileSize);
		const view = new DataView(buf.buffer);
		buf[0] = 0x42;
		buf[1] = 0x4d;
		view.setUint32(10, pixelDataOffset, true);
		view.setUint32(14, 40, true);
		view.setInt32(18, width, true);
		view.setInt32(22, height, true);
		view.setUint16(28, 8, true);
		view.setUint32(30, 0, true);
		// Palette entry 5 = (200, 100, 50) as BGRA.
		buf[paletteOffset + 5 * 4] = 50;
		buf[paletteOffset + 5 * 4 + 1] = 100;
		buf[paletteOffset + 5 * 4 + 2] = 200;
		// Top row is stored LAST (row index height-1 = 1).
		const topRowStart = pixelDataOffset + Number(rowStride);
		buf[topRowStart] = 5;
		expect(decodeBmpFirstPixel(buf)).toStrictEqual({ r: 200, g: 100, b: 50, a: 255 });
	});

	it('returns undefined for non-BMP bytes', () => {
		expect(decodeBmpFirstPixel(new Uint8Array(60))).toBeUndefined();
	});
});
