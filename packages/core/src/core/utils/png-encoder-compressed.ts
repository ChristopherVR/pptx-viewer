/**
 * RGBA -> PNG encoder with a DEFLATE-compressed `IDAT` and per-row adaptive
 * scanline filters (None / Sub / Up). `encodePng` (from `@christophervr/ole2`)
 * only emits stored blocks, which is fine for small icon rasters but makes a
 * large picture (a GIF frame in a `.ppt`) many times bigger than necessary.
 *
 * @module png-encoder-compressed
 */

import { zlibDeflate } from './deflate-encode';

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length, false);
	for (let i = 0; i < 4; i++) {
		out[4 + i] = type.charCodeAt(i);
	}
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)), false);
	return out;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Filter one RGBA row (None, Sub or Up, whichever has the lowest cost) into `out`. */
function filterRow(
	rgba: Uint8Array,
	y: number,
	stride: number,
	out: Uint8Array,
	outOffset: number,
): void {
	const row = y * stride;
	const left = (i: number): number => (i >= 4 ? rgba[row + i - 4] : 0);
	const up = (i: number): number => (y > 0 ? rgba[row - stride + i] : 0);
	const cost = (d: number): number => (d < 128 ? d : 256 - d);
	let none = 0;
	let sub = 0;
	let upCost = 0;
	for (let i = 0; i < stride; i++) {
		const v = rgba[row + i];
		none += cost(v);
		sub += cost((v - left(i)) & 0xff);
		upCost += cost((v - up(i)) & 0xff);
	}
	const type = sub < none && sub <= upCost ? 1 : upCost < none ? 2 : 0;
	out[outOffset] = type;
	for (let i = 0; i < stride; i++) {
		const v = rgba[row + i];
		out[outOffset + 1 + i] =
			type === 0 ? v : type === 1 ? (v - left(i)) & 0xff : (v - up(i)) & 0xff;
	}
}

/** Encode `width * height * 4` RGBA bytes as a PNG with a compressed `IDAT`. */
export function encodeCompressedPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
	if (rgba.length !== width * height * 4) {
		throw new Error(
			`encodeCompressedPng: rgba length ${rgba.length} does not match ${width}x${height}x4`,
		);
	}
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, width, false);
	view.setUint32(4, height, false);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // RGBA
	const stride = width * 4;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		filterRow(rgba, y, stride, raw, y * (stride + 1));
	}
	const parts = [
		new Uint8Array(SIGNATURE),
		chunk('IHDR', ihdr),
		chunk('IDAT', zlibDeflate(raw)),
		chunk('IEND', new Uint8Array(0)),
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}
