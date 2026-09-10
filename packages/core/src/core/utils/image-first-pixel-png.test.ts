import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodePngFirstPixel } from './image-first-pixel-png';
import { encodePng } from './png-encoder';

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		let c = (crc ^ bytes[i]!) & 0xff;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(8 + data.length + 4);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length, false);
	for (let i = 0; i < 4; i++) {
		out[4 + i] = type.charCodeAt(i);
	}
	out.set(data, 8);
	const crcInput = new Uint8Array(4 + data.length);
	for (let i = 0; i < 4; i++) {
		crcInput[i] = type.charCodeAt(i);
	}
	crcInput.set(data, 4);
	view.setUint32(8 + data.length, crc32(crcInput), false);
	return out;
}

function concat(chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((s, c) => s + c.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		out.set(c, off);
		off += c.length;
	}
	return out;
}

const SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Build a minimal, real-zlib-compressed PNG for arbitrary IHDR fields + raw scanline data. */
function buildPng(opts: {
	width: number;
	height: number;
	bitDepth: number;
	colorType: number;
	raw: Uint8Array; // filter byte + samples per row, concatenated across all rows
	palette?: Uint8Array;
	trns?: Uint8Array;
}): Uint8Array {
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, opts.width, false);
	view.setUint32(4, opts.height, false);
	ihdr[8] = opts.bitDepth;
	ihdr[9] = opts.colorType;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;
	const idatData = deflateSync(Buffer.from(opts.raw));
	const parts = [SIG, chunk('IHDR', ihdr)];
	if (opts.palette) {
		parts.push(chunk('PLTE', opts.palette));
	}
	if (opts.trns) {
		parts.push(chunk('tRNS', opts.trns));
	}
	parts.push(chunk('IDAT', new Uint8Array(idatData)));
	parts.push(chunk('IEND', new Uint8Array(0)));
	return concat(parts);
}

describe('decodePngFirstPixel', () => {
	it('reads (0,0) from an RGBA PNG built by encodePng (stored-block deflate)', () => {
		const rgba = new Uint8Array([0, 128, 255, 255, 1, 2, 3, 4]); // 2x1
		const png = encodePng(2, 1, rgba);
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 0, g: 128, b: 255, a: 255 });
	});

	it('reads (0,0) from a truecolor (colorType 2) PNG, real Huffman-compressed', () => {
		// 2x2, striped: top-left red, rest green - mirrors the striped ground-truth fixture.
		const raw = new Uint8Array([
			0,
			255,
			0,
			0,
			0,
			255,
			0, // row 0: filter=0, px(0,0)=red, px(1,0)=green
			0,
			0,
			255,
			0,
			0,
			255,
			0, // row 1: filter=0, both green
		]);
		const png = buildPng({ width: 2, height: 2, bitDepth: 8, colorType: 2, raw });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 255, g: 0, b: 0, a: 255 });
	});

	it('reads (0,0) from a 16x16 mostly-red-with-one-green-corner PNG (COM ground-truth fixture shape)', () => {
		const width = 16;
		const height = 16;
		const rowBytes = 1 + width * 3;
		const raw = new Uint8Array(rowBytes * height);
		for (let y = 0; y < height; y++) {
			raw[y * rowBytes] = 0; // filter none
			for (let x = 0; x < width; x++) {
				const at = y * rowBytes + 1 + x * 3;
				const isGreenCorner = x === 0 && y === 0;
				raw[at] = isGreenCorner ? 0 : 255;
				raw[at + 1] = isGreenCorner ? 255 : 0;
				raw[at + 2] = 0;
			}
		}
		const png = buildPng({ width, height, bitDepth: 8, colorType: 2, raw });
		// PowerPoint samples (0,0), which is the green corner here, not the
		// majority red - this is the exact ground truth the picture-fill
		// renderer reproduces (see chart-bar3d-face-picture.ts's module doc).
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 0, g: 255, b: 0, a: 255 });
	});

	it('reads (0,0) from an indexed (colorType 3) PNG via PLTE', () => {
		const palette = new Uint8Array([10, 20, 30, 40, 50, 60]); // index0, index1
		const raw = new Uint8Array([0, 1, 1]); // filter=0, px0=index1, px1=index1
		const png = buildPng({ width: 2, height: 1, bitDepth: 8, colorType: 3, raw, palette });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 40, g: 50, b: 60, a: 255 });
	});

	it('honours tRNS alpha for an indexed pixel', () => {
		const palette = new Uint8Array([10, 20, 30]);
		const trns = new Uint8Array([0]); // index 0 fully transparent
		const raw = new Uint8Array([0, 0]);
		const png = buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 3, raw, palette, trns });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 10, g: 20, b: 30, a: 0 });
	});

	it('reads (0,0) from a grayscale (colorType 0) PNG', () => {
		const raw = new Uint8Array([0, 200]);
		const png = buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 0, raw });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 200, g: 200, b: 200, a: 255 });
	});

	it('reads (0,0) from a 1-bit-depth grayscale PNG (packed bits)', () => {
		// One byte holds 8 1-bit pixels, MSB first: px0 = top bit = 1 (white).
		const raw = new Uint8Array([0, 0b10000000]);
		const png = buildPng({ width: 8, height: 1, bitDepth: 1, colorType: 0, raw });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 255, g: 255, b: 255, a: 255 });
	});

	it('reads (0,0) from a 16-bit-depth truecolor PNG (uses the high byte)', () => {
		const raw = new Uint8Array([0, 0xab, 0xcd, 0x12, 0x34, 0x56, 0x78]);
		const png = buildPng({ width: 1, height: 1, bitDepth: 16, colorType: 2, raw });
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 0xab, g: 0x12, b: 0x56, a: 255 });
	});

	it('reads (0,0) from an Adam7-interlaced PNG (pass 1 starts at pixel (0,0))', () => {
		// Interlace pass 1 for an 8x8 image is a single 1x1 sub-image: one row,
		// one pixel, filter byte + 3 samples - structurally identical to the
		// non-interlaced 1x1 case for the purposes of THIS decoder (it never
		// looks past the first scanline regardless of interlacing).
		const ihdr = new Uint8Array(13);
		const view = new DataView(ihdr.buffer);
		view.setUint32(0, 8, false);
		view.setUint32(4, 8, false);
		ihdr[8] = 8;
		ihdr[9] = 2;
		ihdr[10] = 0;
		ihdr[11] = 0;
		ihdr[12] = 1; // interlaced
		const pass1Row = new Uint8Array([0, 9, 8, 7]); // filter=0, RGB = (9,8,7)
		const idatData = deflateSync(Buffer.from(pass1Row));
		const parts = [
			SIG,
			chunk('IHDR', ihdr),
			chunk('IDAT', new Uint8Array(idatData)),
			chunk('IEND', new Uint8Array(0)),
		];
		const png = concat(parts);
		expect(decodePngFirstPixel(png)).toStrictEqual({ r: 9, g: 8, b: 7, a: 255 });
	});

	it('returns undefined for non-PNG bytes', () => {
		expect(decodePngFirstPixel(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
	});

	it('returns undefined for a truncated/corrupt PNG', () => {
		const png = encodePng(1, 1, new Uint8Array([1, 2, 3, 4]));
		expect(decodePngFirstPixel(png.subarray(0, 10))).toBeUndefined();
	});
});
