import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { zlibDeflate } from './deflate-encode';
import { decodePngDimensions, encodePng } from './png-encoder';
import { encodeCompressedPng } from './png-encoder-compressed';

/** Decode a non-interlaced 8-bit RGBA PNG (filters 0-2) using real zlib. */
function decodeRgbaPng(png: Uint8Array): Uint8Array {
	const idat: Buffer[] = [];
	let offset = 8;
	while (offset < png.length) {
		const len = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0, false);
		const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
		if (type === 'IDAT') {
			idat.push(Buffer.from(png.subarray(offset + 8, offset + 8 + len)));
		}
		offset += 12 + len;
	}
	const { width, height } = decodePngDimensions(png)!;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * 4;
	const out = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const ft = raw[y * (stride + 1)]!;
		if (ft > 2) {
			throw new Error(`unexpected filter ${ft}`);
		}
		for (let i = 0; i < stride; i++) {
			const x = raw[y * (stride + 1) + 1 + i]!;
			const a = i >= 4 ? out[y * stride + i - 4]! : 0;
			const b = y > 0 ? out[(y - 1) * stride + i]! : 0;
			out[y * stride + i] = (x + (ft === 1 ? a : ft === 2 ? b : 0)) & 0xff;
		}
	}
	return out;
}

function pattern(width: number, height: number): Uint8Array {
	const px = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const inside = (x - width / 2) ** 2 + (y - height / 2) ** 2 < (height / 3) ** 2;
			px.set(inside ? [255, 69, 0, 255] : [30, 144, 255, 255], (y * width + x) * 4);
		}
	}
	return px;
}

describe('zlibDeflate', () => {
	it('round-trips through real zlib, including empty and incompressible input', () => {
		const random = new Uint8Array(70000);
		let seed = 12345;
		for (let i = 0; i < random.length; i++) {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			random[i] = seed >>> 24;
		}
		for (const data of [new Uint8Array(0), new Uint8Array([7]), random, new Uint8Array(100000)]) {
			expect(new Uint8Array(inflateSync(zlibDeflate(data)))).toStrictEqual(data);
		}
	});
});

describe('encodeCompressedPng', () => {
	it('is materially smaller than the stored-block PNG and decodes to the same pixels', () => {
		const rgba = pattern(400, 300);
		const compressed = encodeCompressedPng(400, 300, rgba);
		const stored = encodePng(400, 300, rgba);
		expect(decodePngDimensions(compressed)).toStrictEqual({ width: 400, height: 300 });
		expect(compressed.length).toBeLessThan(stored.length / 20);
		expect(decodeRgbaPng(compressed)).toStrictEqual(rgba);
	});

	it('rejects a mismatched buffer', () => {
		expect(() => encodeCompressedPng(2, 2, new Uint8Array(3))).toThrow();
	});
});
