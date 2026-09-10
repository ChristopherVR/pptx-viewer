/**
 * Synchronous, DOM-free PNG first-pixel (0,0) decoder.
 *
 * Only decodes as much of the `IDAT` stream as is needed for the very first
 * pixel. For ANY PNG filter type, the top-left pixel of row 0 (or, for an
 * Adam7-interlaced image, of pass 1's row 0, which the deflate stream always
 * emits first and which always starts at image (0,0)) has no "left" or "up"
 * neighbour, so every PNG filter (None/Sub/Up/Average/Paeth) reconstructs to
 * exactly the raw filtered byte for that pixel's samples: the predictor is 0
 * in every case. That means this module never needs to implement PNG
 * unfiltering at all, only enough of {@link module:inflate} to read the first
 * few decompressed bytes.
 *
 * @module image-first-pixel-png
 */
import { zlibInflate } from './inflate';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface PngHeader {
	width: number;
	height: number;
	bitDepth: number;
	colorType: number;
}

/** Channel count per PNG colour type (ISO/IEC 15948 Table 11.1). */
function channelsForColorType(colorType: number): number | undefined {
	switch (colorType) {
		case 0:
			return 1; // grayscale
		case 2:
			return 3; // truecolor
		case 3:
			return 1; // indexed
		case 4:
			return 2; // grayscale + alpha
		case 6:
			return 4; // truecolor + alpha
		default:
			return undefined;
	}
}

function hasPngSignature(bytes: Uint8Array): boolean {
	if (bytes.length < 8) {
		return false;
	}
	for (let i = 0; i < PNG_SIGNATURE.length; i++) {
		if (bytes[i] !== PNG_SIGNATURE[i]) {
			return false;
		}
	}
	return true;
}

/** Walk PNG chunks, returning the IHDR fields, PLTE bytes, tRNS bytes, and concatenated IDAT bytes. */
function readChunks(bytes: Uint8Array): {
	header: PngHeader | undefined;
	palette: Uint8Array | undefined;
	transparency: Uint8Array | undefined;
	idat: Uint8Array;
} {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 8;
	let header: PngHeader | undefined;
	let palette: Uint8Array | undefined;
	let transparency: Uint8Array | undefined;
	const idatParts: Uint8Array[] = [];
	let idatTotal = 0;

	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset, false);
		const type = String.fromCharCode(
			bytes[offset + 4]!,
			bytes[offset + 5]!,
			bytes[offset + 6]!,
			bytes[offset + 7]!,
		);
		const dataStart = offset + 8;
		if (dataStart + length > bytes.length) {
			break;
		}
		const data = bytes.subarray(dataStart, dataStart + length);
		if (type === 'IHDR' && length >= 13) {
			header = {
				width: view.getUint32(dataStart, false),
				height: view.getUint32(dataStart + 4, false),
				bitDepth: data[8]!,
				colorType: data[9]!,
			};
		} else if (type === 'PLTE') {
			palette = data;
		} else if (type === 'tRNS') {
			transparency = data;
		} else if (type === 'IDAT') {
			idatParts.push(data);
			idatTotal += data.length;
			// A handful of small IDAT chunks is already enough compressed data to
			// decode the first pixel; stop collecting once there is plainly
			// enough, so a huge multi-megabyte photo does not get fully buffered
			// just to read pixel (0,0).
			if (idatTotal > 4096) {
				break;
			}
		} else if (type === 'IEND') {
			break;
		}
		offset = dataStart + length + 4; // skip CRC
	}

	const idat = new Uint8Array(idatTotal);
	let pos = 0;
	for (const part of idatParts) {
		idat.set(part, pos);
		pos += part.length;
	}
	return { header, palette, transparency, idat };
}

/** Read an N-bit-per-sample value at bit offset 0 of `byte` (MSB-first packing, PNG's bit order). */
function firstSample(byte: number, bitDepth: number): number {
	if (bitDepth >= 8) {
		return byte;
	}
	return byte >> (8 - bitDepth);
}

/** Scale a `bitDepth`-bit sample up to 0-255. */
function scaleTo8Bit(value: number, bitDepth: number): number {
	if (bitDepth === 8) {
		return value;
	}
	if (bitDepth === 16) {
		return value; // caller already took the high byte
	}
	const maxVal = (1 << bitDepth) - 1;
	return Math.round((value / maxVal) * 255);
}

/**
 * Decode a PNG's pixel (0,0) synchronously with no DOM. Returns `undefined`
 * for an unrecognised/unsupported PNG (unknown colour type, corrupt chunk
 * stream) or when the pixel is fully transparent, matching the DOM-based
 * sampler's existing "give up, use the fallback colour" contract.
 */
export function decodePngFirstPixel(
	bytes: Uint8Array,
): { r: number; g: number; b: number; a: number } | undefined {
	if (!hasPngSignature(bytes)) {
		return undefined;
	}
	const { header, palette, transparency, idat } = readChunks(bytes);
	if (!header || idat.length === 0) {
		return undefined;
	}
	const channels = channelsForColorType(header.colorType);
	if (channels === undefined) {
		return undefined;
	}

	const bytesPerSample = header.bitDepth === 16 ? 2 : 1;
	const neededDataBytes = header.bitDepth < 8 ? 1 : channels * bytesPerSample;
	let raw: Uint8Array;
	try {
		raw = zlibInflate(idat, 1 + neededDataBytes);
	} catch {
		return undefined;
	}
	if (raw.length < 1 + neededDataBytes) {
		return undefined;
	}
	const data = raw.subarray(1); // drop the leading filter-type byte

	const readSample = (index: number): number => {
		if (header.bitDepth < 8) {
			return firstSample(data[0]!, header.bitDepth);
		}
		if (header.bitDepth === 16) {
			return data[index * 2]!; // high byte
		}
		return data[index]!;
	};

	switch (header.colorType) {
		case 0: {
			const gray = scaleTo8Bit(readSample(0), header.bitDepth);
			const isTransparent =
				transparency && transparency.length >= 2 && readSample(0) === (transparency[1] ?? -1);
			return { r: gray, g: gray, b: gray, a: isTransparent ? 0 : 255 };
		}
		case 2: {
			const r = scaleTo8Bit(readSample(0), header.bitDepth);
			const g = scaleTo8Bit(readSample(1), header.bitDepth);
			const b = scaleTo8Bit(readSample(2), header.bitDepth);
			return { r, g, b, a: 255 };
		}
		case 3: {
			const index = readSample(0);
			if (!palette || palette.length < (index + 1) * 3) {
				return undefined;
			}
			const alpha = transparency && transparency.length > index ? transparency[index]! : 255;
			return {
				r: palette[index * 3]!,
				g: palette[index * 3 + 1]!,
				b: palette[index * 3 + 2]!,
				a: alpha,
			};
		}
		case 4: {
			const gray = scaleTo8Bit(readSample(0), header.bitDepth);
			const alpha = scaleTo8Bit(readSample(1), header.bitDepth);
			return { r: gray, g: gray, b: gray, a: alpha };
		}
		case 6: {
			const r = scaleTo8Bit(readSample(0), header.bitDepth);
			const g = scaleTo8Bit(readSample(1), header.bitDepth);
			const b = scaleTo8Bit(readSample(2), header.bitDepth);
			const a = scaleTo8Bit(readSample(3), header.bitDepth);
			return { r, g, b, a };
		}
		default:
			return undefined;
	}
}
