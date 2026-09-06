/**
 * Minimal, dependency-free RGBA -> PNG encoder.
 *
 * Used to regenerate OLE icon captions and content previews (grid / paragraph
 * / nested-deck thumbnails) from inside `packages/core`, which runs both in
 * the browser (all five viewer bindings) and in plain Node (the MCP tools in
 * `packages/tools`). Neither environment is guaranteed to have a `<canvas>`
 * or `OffscreenCanvas`, so this cannot depend on DOM rasterisation.
 *
 * The PNG spec requires the `IDAT` chunk to be zlib-compressed, but zlib's
 * DEFLATE format explicitly allows uncompressed ("stored") blocks (RFC 1951
 * SS3.2.4, BTYPE=00). Emitting only stored blocks produces a valid,
 * spec-conformant PNG (larger than a compressed one, which is irrelevant at
 * the small icon/preview sizes this module renders) without needing a zlib
 * implementation.
 *
 * @module png-encoder
 */

/** CRC-32 lookup table, computed once. */
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
		crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
	let a = 1;
	let b = 0;
	const MOD = 65521;
	for (let i = 0; i < bytes.length; i++) {
		a = (a + bytes[i]!) % MOD;
		b = (b + a) % MOD;
	}
	return ((b << 16) | a) >>> 0;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** Wrap raw bytes in a zlib stream using only DEFLATE "stored" blocks. */
function zlibStore(data: Uint8Array): Uint8Array {
	const MAX_BLOCK = 0xffff;
	const blocks: Uint8Array[] = [];
	let offset = 0;
	do {
		const remaining = data.length - offset;
		const size = Math.min(MAX_BLOCK, remaining);
		const isFinal = offset + size >= data.length;
		const header = new Uint8Array(5);
		header[0] = isFinal ? 1 : 0;
		header[1] = size & 0xff;
		header[2] = (size >>> 8) & 0xff;
		const notSize = ~size & 0xffff;
		header[3] = notSize & 0xff;
		header[4] = (notSize >>> 8) & 0xff;
		blocks.push(header, data.subarray(offset, offset + size));
		offset += size;
	} while (offset < data.length);
	if (data.length === 0) {
		// Emit a single empty final block so a zero-byte image still zlib-decodes.
		blocks.push(new Uint8Array([1, 0, 0, 0xff, 0xff]));
	}

	const zlibHeader = new Uint8Array([0x78, 0x01]); // CMF/FLG: 32K window, no dict, fastest
	const adler = adler32(data);
	const adlerBytes = new Uint8Array(4);
	new DataView(adlerBytes.buffer).setUint32(0, adler, false);
	return concatBytes([zlibHeader, ...blocks, adlerBytes]);
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new Uint8Array(4);
	for (let i = 0; i < 4; i++) {
		typeBytes[i] = type.charCodeAt(i);
	}
	const length = new Uint8Array(4);
	new DataView(length.buffer).setUint32(0, data.length, false);
	const crcInput = concatBytes([typeBytes, data]);
	const crc = new Uint8Array(4);
	new DataView(crc.buffer).setUint32(0, crc32(crcInput), false);
	return concatBytes([length, typeBytes, data, crc]);
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Encode an RGBA pixel buffer as a PNG file.
 *
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @param rgba - Pixel data, `width * height * 4` bytes, row-major, RGBA8.
 * @returns The complete PNG file bytes.
 */
export function encodePng(
	width: number,
	height: number,
	rgba: Uint8Array | Uint8ClampedArray,
): Uint8Array {
	if (rgba.length !== width * height * 4) {
		throw new Error(
			`encodePng: rgba length ${rgba.length} does not match ${width}x${height}x4 = ${width * height * 4}`,
		);
	}

	const ihdr = new Uint8Array(13);
	const ihdrView = new DataView(ihdr.buffer);
	ihdrView.setUint32(0, width, false);
	ihdrView.setUint32(4, height, false);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type: RGBA
	ihdr[10] = 0; // compression method
	ihdr[11] = 0; // filter method
	ihdr[12] = 0; // interlace method

	// Each scanline is prefixed with a filter-type byte (0 = None).
	const stride = width * 4;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0;
		raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
	}

	const idatData = zlibStore(raw);

	return concatBytes([
		PNG_SIGNATURE,
		buildChunk('IHDR', ihdr),
		buildChunk('IDAT', idatData),
		buildChunk('IEND', new Uint8Array(0)),
	]);
}

/** Decode a PNG's `IHDR` width/height without decompressing pixel data. */
export function decodePngDimensions(
	png: Uint8Array,
): { width: number; height: number } | undefined {
	if (png.length < 24) {
		return undefined;
	}
	for (let i = 0; i < PNG_SIGNATURE.length; i++) {
		if (png[i] !== PNG_SIGNATURE[i]) {
			return undefined;
		}
	}
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	// IHDR is always the first chunk: [len(4)][type(4)="IHDR"][width(4)][height(4)]...
	const width = view.getUint32(16, false);
	const height = view.getUint32(20, false);
	return { width, height };
}
