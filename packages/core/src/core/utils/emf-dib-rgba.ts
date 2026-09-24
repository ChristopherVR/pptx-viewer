/**
 * Minimal device-independent-bitmap (DIB) decoder used by the EMF raster-op
 * normaliser (`emf-raster-op-normalize.ts`). Decodes an uncompressed
 * BITMAPINFOHEADER DIB (1/4/8/16/24/32 bpp, BI_RGB or BI_BITFIELDS) into a
 * top-down RGBA byte array. RLE-compressed and exotic formats return
 * `undefined`, leaving the caller to pass the record through untouched.
 */

/** A decoded DIB: top-down, 4 bytes (R, G, B, A) per pixel. */
export interface DecodedDib {
	width: number;
	height: number;
	rgba: Uint8Array;
}

const BI_RGB = 0;
const BI_BITFIELDS = 3;
const MAX_DIB_SIDE = 4096;

interface ChannelMask {
	mask: number;
	shift: number;
	max: number;
}

function channel(mask: number): ChannelMask {
	if (mask === 0) {
		return { mask: 0, shift: 0, max: 1 };
	}
	let shift = 0;
	while (((mask >>> shift) & 1) === 0) {
		shift++;
	}
	return { mask, shift, max: mask >>> shift };
}

function readMasked(value: number, c: ChannelMask): number {
	if (c.mask === 0) {
		return 0;
	}
	return Math.round((((value & c.mask) >>> c.shift) * 255) / c.max);
}

/**
 * Decode the DIB whose BITMAPINFO starts at `bmiOffset` and whose pixel bits
 * start at `bitsOffset` inside `view`.
 */
export function decodeDibToRgba(
	view: DataView,
	bmiOffset: number,
	bitsOffset: number,
	bitsSize: number,
): DecodedDib | undefined {
	if (bmiOffset < 0 || bmiOffset + 40 > view.byteLength) {
		return undefined;
	}
	if (bitsOffset < 0 || bitsOffset + bitsSize > view.byteLength) {
		return undefined;
	}
	const headerSize = view.getUint32(bmiOffset, true);
	const width = view.getInt32(bmiOffset + 4, true);
	const heightRaw = view.getInt32(bmiOffset + 8, true);
	const bitCount = view.getUint16(bmiOffset + 14, true);
	const compression = view.getUint32(bmiOffset + 16, true);
	const height = Math.abs(heightRaw);
	if (headerSize < 40 || width <= 0 || height === 0) {
		return undefined;
	}
	if (width > MAX_DIB_SIDE || height > MAX_DIB_SIDE) {
		return undefined;
	}
	if (![1, 4, 8, 16, 24, 32].includes(bitCount)) {
		return undefined;
	}
	if (compression !== BI_RGB && !(compression === BI_BITFIELDS && bitCount >= 16)) {
		return undefined;
	}
	const stride = Math.floor((bitCount * width + 31) / 32) * 4;
	if (stride * height > bitsSize) {
		return undefined;
	}

	const palette: Array<[number, number, number]> = [];
	if (bitCount <= 8) {
		const colorsUsed = view.getUint32(bmiOffset + 32, true) || 1 << bitCount;
		const count = Math.min(colorsUsed, 1 << bitCount);
		const tableOffset = bmiOffset + headerSize;
		for (let i = 0; i < count && tableOffset + i * 4 + 3 < view.byteLength; i++) {
			const at = tableOffset + i * 4;
			palette.push([view.getUint8(at + 2), view.getUint8(at + 1), view.getUint8(at)]);
		}
	}

	let r = channel(bitCount === 16 ? 0x7c00 : 0xff0000);
	let g = channel(bitCount === 16 ? 0x03e0 : 0x00ff00);
	let b = channel(bitCount === 16 ? 0x001f : 0x0000ff);
	if (compression === BI_BITFIELDS) {
		const maskOffset = bmiOffset + 40;
		if (maskOffset + 12 > view.byteLength) {
			return undefined;
		}
		r = channel(view.getUint32(maskOffset, true));
		g = channel(view.getUint32(maskOffset + 4, true));
		b = channel(view.getUint32(maskOffset + 8, true));
	}

	const rgba = new Uint8Array(width * height * 4);
	const topDown = heightRaw < 0;
	for (let y = 0; y < height; y++) {
		const row = bitsOffset + (topDown ? y : height - 1 - y) * stride;
		for (let x = 0; x < width; x++) {
			const out = (y * width + x) * 4;
			let rgb: [number, number, number] = [0, 0, 0];
			if (bitCount <= 8) {
				const bitPos = x * bitCount;
				const byte = view.getUint8(row + (bitPos >> 3));
				const index = (byte >> (8 - bitCount - (bitPos & 7))) & ((1 << bitCount) - 1);
				rgb = palette[index] ?? [0, 0, 0];
			} else if (bitCount === 24) {
				const at = row + x * 3;
				rgb = [view.getUint8(at + 2), view.getUint8(at + 1), view.getUint8(at)];
			} else {
				const value =
					bitCount === 16 ? view.getUint16(row + x * 2, true) : view.getUint32(row + x * 4, true);
				rgb = [readMasked(value, r), readMasked(value, g), readMasked(value, b)];
			}
			rgba[out] = rgb[0];
			rgba[out + 1] = rgb[1];
			rgba[out + 2] = rgb[2];
			rgba[out + 3] = 255;
		}
	}
	return { width, height, rgba };
}
