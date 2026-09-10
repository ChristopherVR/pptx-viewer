import { describe, expect, it } from 'vitest';

import { decodeGifFirstPixel } from './image-first-pixel-gif';

/** LSB-first bit writer, matching GIF's LZW bit-packing order. */
class BitWriter {
	private bytes: number[] = [];
	private bitBuf = 0;
	private bitCount = 0;

	push(value: number, bits: number): void {
		this.bitBuf |= value << this.bitCount;
		this.bitCount += bits;
		while (this.bitCount >= 8) {
			this.bytes.push(this.bitBuf & 0xff);
			this.bitBuf >>>= 8;
			this.bitCount -= 8;
		}
	}

	finish(): Uint8Array {
		if (this.bitCount > 0) {
			this.bytes.push(this.bitBuf & 0xff);
		}
		return new Uint8Array(this.bytes);
	}
}

/**
 * Build a minimal, valid GIF89a: no compression cleverness, every pixel is
 * emitted as its own root LZW code (re-issuing Clear whenever the code size
 * would need to grow), which is legal LZW and trivially decodable by any
 * conforming reader (and by {@link decodeGifFirstPixel}, which only reads the
 * first code).
 */
function encodeMinimalGif(opts: {
	width: number;
	height: number;
	colorTable: number[][]; // [r,g,b][]
	pixels: number[]; // colour-table indices, row-major
	transparentIndex?: number;
}): Uint8Array {
	const colorBits = Math.max(2, Math.ceil(Math.log2(opts.colorTable.length)));
	const tableSizeField = colorBits - 1; // 2^(N+1) entries
	const parts: number[] = [];
	const push = (...b: number[]) => parts.push(...b);
	const pushU16 = (v: number) => push(v & 0xff, (v >> 8) & 0xff);

	push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a
	pushU16(opts.width);
	pushU16(opts.height);
	push(0x80 | tableSizeField, 0, 0); // GCT present, background=0, aspect=0
	const tableEntries = 2 << tableSizeField;
	for (let i = 0; i < tableEntries; i++) {
		const c = opts.colorTable[i] ?? [0, 0, 0];
		push(c[0]!, c[1]!, c[2]!);
	}

	if (opts.transparentIndex !== undefined) {
		push(0x21, 0xf9, 4, 0x01, 0, 0, opts.transparentIndex, 0);
	}

	push(0x2c); // image descriptor
	pushU16(0);
	pushU16(0);
	pushU16(opts.width);
	pushU16(opts.height);
	push(0); // no local color table, not interlaced

	const minCodeSize = colorBits;
	push(minCodeSize);
	const clearCode = 1 << minCodeSize;
	const endCode = clearCode + 1;
	const writer = new BitWriter();
	writer.push(clearCode, minCodeSize + 1);
	for (const p of opts.pixels) {
		writer.push(p, minCodeSize + 1);
	}
	writer.push(endCode, minCodeSize + 1);
	const lzwBytes = writer.finish();
	push(lzwBytes.length);
	for (const b of lzwBytes) {
		push(b);
	}
	push(0); // block terminator
	push(0x3b); // trailer

	return new Uint8Array(parts);
}

describe('decodeGifFirstPixel', () => {
	it('reads (0,0) from a simple indexed GIF', () => {
		const gif = encodeMinimalGif({
			width: 2,
			height: 2,
			colorTable: [
				[0, 0, 0],
				[255, 0, 0],
				[0, 255, 0],
				[0, 0, 255],
			],
			pixels: [2, 1, 1, 1], // top-left = green
		});
		expect(decodeGifFirstPixel(gif)).toStrictEqual({ r: 0, g: 255, b: 0, a: 255 });
	});

	it('reads (0,0) from a 16x16 mostly-red-with-one-green-corner GIF (COM ground-truth fixture shape)', () => {
		const width = 16;
		const height = 16;
		const pixels: number[] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				pixels.push(x === 0 && y === 0 ? 2 : 1);
			}
		}
		const gif = encodeMinimalGif({
			width,
			height,
			colorTable: [
				[0, 0, 0],
				[255, 0, 0],
				[0, 255, 0],
			],
			pixels,
		});
		expect(decodeGifFirstPixel(gif)).toStrictEqual({ r: 0, g: 255, b: 0, a: 255 });
	});

	it('returns undefined when pixel (0,0) uses the transparent index', () => {
		const gif = encodeMinimalGif({
			width: 1,
			height: 1,
			colorTable: [
				[9, 9, 9],
				[1, 2, 3],
			],
			pixels: [0],
			transparentIndex: 0,
		});
		expect(decodeGifFirstPixel(gif)).toBeUndefined();
	});

	it('returns undefined for non-GIF bytes', () => {
		expect(decodeGifFirstPixel(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeUndefined();
	});
});
