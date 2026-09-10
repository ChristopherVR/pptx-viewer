/**
 * Pure PNG chunk/byte-stream assembly: the framing PNG needs around a
 * zlib-compressed IDAT payload (signature, IHDR, one or more IDAT chunks,
 * IEND), each with a length prefix, ASCII type, and CRC-32 trailer. No
 * external dependency (see `png-crc32.ts`); the zlib compression itself is
 * produced by the browser's native `CompressionStream` in
 * `streaming-png-encoder.ts`, not here, so this module is pure byte math and
 * unit-testable without any browser API.
 */
import { crc32 } from './png-crc32';

/** The 8-byte PNG file signature, always first. */
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function u32be(value: number): Uint8Array {
	return new Uint8Array([
		(value >>> 24) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 8) & 0xff,
		value & 0xff,
	]);
}

function asciiBytes(type: string): Uint8Array {
	const out = new Uint8Array(type.length);
	for (let i = 0; i < type.length; i++) {
		out[i] = type.charCodeAt(i);
	}
	return out;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
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
 * Frame one PNG chunk: 4-byte big-endian length, 4-byte ASCII type, the raw
 * data, then a CRC-32 over (type + data).
 */
export function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = asciiBytes(type);
	const crc = crc32(concatBytes([typeBytes, data]));
	return concatBytes([u32be(data.length), typeBytes, data, u32be(crc)]);
}

/** PNG colour type for 8-bit-per-channel RGBA (what `getImageData` produces). */
export const PNG_COLOR_TYPE_RGBA = 6;

/** Build the `IHDR` chunk for an 8-bit RGBA, non-interlaced image. */
export function buildIhdrChunk(width: number, height: number): Uint8Array {
	const data = new Uint8Array(13);
	data.set(u32be(width), 0);
	data.set(u32be(height), 4);
	data[8] = 8; // bit depth
	data[9] = PNG_COLOR_TYPE_RGBA;
	data[10] = 0; // compression method (deflate, the only defined value)
	data[11] = 0; // filter method (adaptive filtering per scanline)
	data[12] = 0; // interlace method (none)
	return buildPngChunk('IHDR', data);
}

/** Build the empty `IEND` chunk that terminates every PNG file. */
export function buildIendChunk(): Uint8Array {
	return buildPngChunk('IEND', new Uint8Array(0));
}

/**
 * Assemble a complete PNG file from its pieces: signature, IHDR, one or more
 * already-framed IDAT chunks (a zlib stream may be split across several
 * IDATs; PNG readers concatenate their data before inflating), and IEND.
 */
export function assemblePng(
	width: number,
	height: number,
	idatChunks: readonly Uint8Array[],
): Uint8Array {
	return concatBytes([
		PNG_SIGNATURE,
		buildIhdrChunk(width, height),
		...idatChunks,
		buildIendChunk(),
	]);
}

/** Wrap a raw zlib-compressed byte buffer in one `IDAT` chunk. */
export function buildIdatChunk(zlibBytes: Uint8Array): Uint8Array {
	return buildPngChunk('IDAT', zlibBytes);
}
