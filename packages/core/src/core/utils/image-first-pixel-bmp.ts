/**
 * Synchronous, DOM-free BMP first-pixel (0,0) decoder.
 *
 * Supports uncompressed (`BI_RGB`) 1/4/8-bit paletted and 16/24/32-bit
 * direct-colour rows, plus `BI_BITFIELDS` 16/32-bit. RLE4/RLE8-compressed
 * BMPs (rare in `c:pictureOptions` fills) are not decoded here; the caller's
 * existing async `Image`/canvas fallback still handles those since browsers
 * decode BMP natively.
 *
 * A standard BMP stores rows BOTTOM-UP: pixel (0,0) (top-left) is the first
 * pixel of the LAST stored row. A negative height flips that to top-down.
 * Either way this only needs one row's worth of bytes, seeked to directly.
 *
 * @module image-first-pixel-bmp
 */

function readMaskChannel(value: number, mask: number): number {
	if (mask === 0) {
		return 0;
	}
	let m = mask;
	let shift = 0;
	while ((m & 1) === 0) {
		m >>>= 1;
		shift++;
	}
	const bits = 32 - Math.clz32(m);
	const raw = (value & mask) >>> shift;
	const maxVal = (1 << bits) - 1;
	return maxVal === 0 ? 0 : Math.round((raw / maxVal) * 255);
}

/**
 * Decode a BMP's pixel (0,0) synchronously with no DOM. Returns `undefined`
 * for an unrecognised/unsupported BMP (RLE compression, exotic header).
 */
export function decodeBmpFirstPixel(
	bytes: Uint8Array,
): { r: number; g: number; b: number; a: number } | undefined {
	if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const pixelDataOffset = view.getUint32(10, true);
	const headerSize = view.getUint32(14, true);
	if (headerSize < 40) {
		return undefined; // BITMAPCOREHEADER and other legacy variants not supported
	}
	const width = view.getInt32(18, true);
	const rawHeight = view.getInt32(22, true);
	const bitCount = view.getUint16(28, true);
	const compression = view.getUint32(30, true);
	if (width <= 0 || rawHeight === 0) {
		return undefined;
	}
	const topDown = rawHeight < 0;
	const height = Math.abs(rawHeight);

	let redMask = 0x00ff0000;
	let greenMask = 0x0000ff00;
	let blueMask = 0x000000ff;
	let paletteOffset = 14 + headerSize;
	if (compression === 3) {
		// BI_BITFIELDS: three (or four, with alpha) DWORD masks follow the header.
		redMask = view.getUint32(54, true);
		greenMask = view.getUint32(58, true);
		blueMask = view.getUint32(62, true);
		paletteOffset = 54 + 12;
	} else if (compression !== 0) {
		return undefined; // RLE4/RLE8/JPEG/PNG-in-BMP not supported here
	}

	const rowStride = Math.ceil((width * bitCount) / 32) * 4;
	const rowIndexFromTop = 0; // pixel (0,0) is always the top row of the IMAGE
	const storedRowIndex = topDown ? rowIndexFromTop : height - 1 - rowIndexFromTop;
	const rowStart = pixelDataOffset + storedRowIndex * rowStride;
	if (rowStart < 0 || rowStart + Math.ceil(bitCount / 8) > bytes.length) {
		return undefined;
	}

	if (bitCount <= 8) {
		const paletteCount = 1 << bitCount;
		if (paletteOffset + paletteCount * 4 > bytes.length) {
			return undefined;
		}
		let index: number;
		if (bitCount === 8) {
			index = bytes[rowStart]!;
		} else {
			const byte = bytes[rowStart]!;
			index = byte >> (8 - bitCount);
		}
		const entry = paletteOffset + index * 4;
		return { r: bytes[entry + 2]!, g: bytes[entry + 1]!, b: bytes[entry]!, a: 255 };
	}

	if (bitCount === 24) {
		return { r: bytes[rowStart + 2]!, g: bytes[rowStart + 1]!, b: bytes[rowStart]!, a: 255 };
	}
	if (bitCount === 32) {
		const value =
			bytes[rowStart]! |
			(bytes[rowStart + 1]! << 8) |
			(bytes[rowStart + 2]! << 16) |
			(bytes[rowStart + 3]! << 24);
		return {
			r: readMaskChannel(value, redMask),
			g: readMaskChannel(value, greenMask),
			b: readMaskChannel(value, blueMask),
			a: 255,
		};
	}
	if (bitCount === 16) {
		const value = bytes[rowStart]! | (bytes[rowStart + 1]! << 8);
		if (compression === 3) {
			return {
				r: readMaskChannel(value, redMask),
				g: readMaskChannel(value, greenMask),
				b: readMaskChannel(value, blueMask),
				a: 255,
			};
		}
		// Default BI_RGB 16-bit is X1R5G5B5.
		const r5 = (value >> 10) & 0x1f;
		const g5 = (value >> 5) & 0x1f;
		const b5 = value & 0x1f;
		const scale = (v: number) => Math.round((v / 31) * 255);
		return { r: scale(r5), g: scale(g5), b: scale(b5), a: 255 };
	}
	return undefined;
}
