import { describe, it, expect } from 'vitest';

import {
	countTrailingZeros,
	parseBitfieldMasks,
	decodeUncompressedRows,
} from './emf-dib-uncompressed';
import type { BitfieldMasks } from './emf-dib-uncompressed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuffer(size: number, writer: (view: DataView) => void): DataView {
	const buf = new ArrayBuffer(size);
	const view = new DataView(buf);
	writer(view);
	return view;
}

/** Default identity masks (used for non-bitfield modes). */
function identityMasks(): BitfieldMasks {
	return {
		rMask: 0,
		gMask: 0,
		bMask: 0,
		rShift: 0,
		gShift: 0,
		bShift: 0,
		rMax: 1,
		gMax: 1,
		bMax: 1,
	};
}

/** Standard RGB555 masks for 16bpp BI_RGB. */
function rgb555Masks(): BitfieldMasks {
	return {
		rMask: 0x7c00,
		gMask: 0x03e0,
		bMask: 0x001f,
		rShift: 10,
		gShift: 5,
		bShift: 0,
		rMax: 31,
		gMax: 31,
		bMax: 31,
	};
}

const BI_RGB = 0;
const BI_BITFIELDS = 3;

// ---------------------------------------------------------------------------
// countTrailingZeros
// ---------------------------------------------------------------------------

describe('countTrailingZeros()', () => {
	it('returns 0 for zero input', () => {
		expect(countTrailingZeros(0)).toBe(0);
	});

	it('returns 0 for 1', () => {
		expect(countTrailingZeros(1)).toBe(0);
	});

	it('returns 0 for all odd numbers', () => {
		expect(countTrailingZeros(3)).toBe(0);
		expect(countTrailingZeros(5)).toBe(0);
		expect(countTrailingZeros(7)).toBe(0);
		expect(countTrailingZeros(0xff)).toBe(0);
		expect(countTrailingZeros(0xffffff)).toBe(0);
		expect(countTrailingZeros(0xffffffff)).toBe(0);
	});

	it('returns correct count for powers of two', () => {
		for (let i = 0; i < 31; i++) {
			expect(countTrailingZeros(1 << i)).toBe(i);
		}
	});

	it('returns 1 for 2', () => {
		expect(countTrailingZeros(2)).toBe(1);
	});

	it('returns 31 for 0x80000000 (bit 31)', () => {
		// 1 << 31 is -2147483648 in signed but we use unsigned shift
		expect(countTrailingZeros(0x80000000)).toBe(31);
	});

	it('handles max uint32 value (0xFFFFFFFF)', () => {
		// All bits set => trailing zeros = 0
		expect(countTrailingZeros(0xffffffff >>> 0)).toBe(0);
	});

	it('handles typical RGB565 masks', () => {
		expect(countTrailingZeros(0xf800)).toBe(11); // red mask
		expect(countTrailingZeros(0x07e0)).toBe(5); // green mask
		expect(countTrailingZeros(0x001f)).toBe(0); // blue mask
	});

	it('handles typical RGB555 masks', () => {
		expect(countTrailingZeros(0x7c00)).toBe(10); // red
		expect(countTrailingZeros(0x03e0)).toBe(5); // green
		expect(countTrailingZeros(0x001f)).toBe(0); // blue
	});

	it('handles typical 32bpp masks (0x00FF0000, etc.)', () => {
		expect(countTrailingZeros(0x00ff0000)).toBe(16); // red
		expect(countTrailingZeros(0x0000ff00)).toBe(8); // green
		expect(countTrailingZeros(0x000000ff)).toBe(0); // blue
	});

	it('handles non-contiguous patterns', () => {
		// 0b1010 => trailing zeros = 1
		expect(countTrailingZeros(0b1010)).toBe(1);
		// 0b110100 => trailing zeros = 2
		expect(countTrailingZeros(0b110100)).toBe(2);
	});

	it('handles value with only highest bit set', () => {
		expect(countTrailingZeros(0x40000000)).toBe(30);
	});

	it('handles large even numbers', () => {
		// 12 = 0b1100, trailing zeros = 2
		expect(countTrailingZeros(12)).toBe(2);
		// 1024 = 2^10
		expect(countTrailingZeros(1024)).toBe(10);
		// 65536 = 2^16
		expect(countTrailingZeros(65536)).toBe(16);
	});
});

// ---------------------------------------------------------------------------
// parseBitfieldMasks
// ---------------------------------------------------------------------------

describe('parseBitfieldMasks()', () => {
	describe('bI_RGB (compression=0)', () => {
		it('returns zero masks for 24bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 24);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
			expect(masks!.gMask).toBe(0);
			expect(masks!.bMask).toBe(0);
			expect(masks!.rShift).toBe(0);
			expect(masks!.gShift).toBe(0);
			expect(masks!.bShift).toBe(0);
			expect(masks!.rMax).toBe(1);
			expect(masks!.gMax).toBe(1);
			expect(masks!.bMax).toBe(1);
		});

		it('returns zero masks for 32bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 32);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
			expect(masks!.gMask).toBe(0);
			expect(masks!.bMask).toBe(0);
		});

		it('returns zero masks for 8bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 8);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
		});

		it('returns zero masks for 4bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 4);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
		});

		it('returns zero masks for 1bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 1);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
		});

		it('returns default RGB555 masks for 16bpp BI_RGB', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_RGB, 16);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0x7c00);
			expect(masks!.gMask).toBe(0x03e0);
			expect(masks!.bMask).toBe(0x001f);
			expect(masks!.rShift).toBe(10);
			expect(masks!.gShift).toBe(5);
			expect(masks!.bShift).toBe(0);
			expect(masks!.rMax).toBe(31);
			expect(masks!.gMax).toBe(31);
			expect(masks!.bMax).toBe(31);
		});
	});

	describe('bI_BITFIELDS (compression=3)', () => {
		it('reads standard 32bpp BGRA masks', () => {
			const view = buildBuffer(60, (v) => {
				v.setUint32(40, 0x00ff0000, true); // rMask
				v.setUint32(44, 0x0000ff00, true); // gMask
				v.setUint32(48, 0x000000ff, true); // bMask
			});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0x00ff0000);
			expect(masks!.gMask).toBe(0x0000ff00);
			expect(masks!.bMask).toBe(0x000000ff);
			expect(masks!.rShift).toBe(16);
			expect(masks!.gShift).toBe(8);
			expect(masks!.bShift).toBe(0);
			expect(masks!.rMax).toBe(255);
			expect(masks!.gMax).toBe(255);
			expect(masks!.bMax).toBe(255);
		});

		it('reads RGB565 masks for 16bpp', () => {
			const view = buildBuffer(60, (v) => {
				v.setUint32(40, 0xf800, true); // rMask
				v.setUint32(44, 0x07e0, true); // gMask
				v.setUint32(48, 0x001f, true); // bMask
			});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 16);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0xf800);
			expect(masks!.gMask).toBe(0x07e0);
			expect(masks!.bMask).toBe(0x001f);
			expect(masks!.rShift).toBe(11);
			expect(masks!.gShift).toBe(5);
			expect(masks!.bShift).toBe(0);
			expect(masks!.rMax).toBe(31);
			expect(masks!.gMax).toBe(63);
			expect(masks!.bMax).toBe(31);
		});

		it('reads RGB555 masks for 16bpp via BI_BITFIELDS', () => {
			const view = buildBuffer(60, (v) => {
				v.setUint32(40, 0x7c00, true); // rMask
				v.setUint32(44, 0x03e0, true); // gMask
				v.setUint32(48, 0x001f, true); // bMask
			});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 16);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0x7c00);
			expect(masks!.rShift).toBe(10);
			expect(masks!.rMax).toBe(31);
			expect(masks!.gMax).toBe(31);
			expect(masks!.bMax).toBe(31);
		});

		it('returns null when buffer is too small for mask data', () => {
			// Need 40 (headerSize) + 12 (masks) = 52 bytes, but buffer is only 44
			const view = buildBuffer(44, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
			expect(masks).toBeNull();
		});

		it('returns null when bmiOffset pushes masks beyond view', () => {
			// bmiOffset=20, headerSize=40, need 20+40+12=72, only have 60
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 20, 40, BI_BITFIELDS, 32);
			expect(masks).toBeNull();
		});

		it('returns null at exact boundary (bfOff + 12 == byteLength + 1)', () => {
			// bfOff = 0 + 40 = 40. Need bfOff + 12 = 52. Buffer size = 51 => null
			const view = buildBuffer(51, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
			expect(masks).toBeNull();
		});

		it('succeeds at exact boundary (bfOff + 12 == byteLength)', () => {
			// bfOff = 0 + 40 = 40. Need bfOff + 12 = 52. Buffer size = 52 => ok
			const view = buildBuffer(52, (v) => {
				v.setUint32(40, 0xff0000, true);
				v.setUint32(44, 0x00ff00, true);
				v.setUint32(48, 0x0000ff, true);
			});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0xff0000);
		});

		it('handles non-zero bmiOffset correctly', () => {
			const bmiOffset = 14; // typical BMP file header size
			const headerSize = 40;
			const view = buildBuffer(80, (v) => {
				v.setUint32(bmiOffset + headerSize, 0xf800, true);
				v.setUint32(bmiOffset + headerSize + 4, 0x07e0, true);
				v.setUint32(bmiOffset + headerSize + 8, 0x001f, true);
			});
			const masks = parseBitfieldMasks(view, bmiOffset, headerSize, BI_BITFIELDS, 16);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0xf800);
			expect(masks!.gMask).toBe(0x07e0);
			expect(masks!.bMask).toBe(0x001f);
			expect(masks!.rShift).toBe(11);
		});

		it('handles all-zero masks (sets max to 1 via || fallback)', () => {
			const view = buildBuffer(60, (v) => {
				v.setUint32(40, 0, true); // rMask = 0
				v.setUint32(44, 0, true); // gMask = 0
				v.setUint32(48, 0, true); // bMask = 0
			});
			const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
			expect(masks).not.toBeNull();
			// countTrailingZeros(0) returns 0, 0 >>> 0 = 0, 0 || 1 = 1
			expect(masks!.rMax).toBe(1);
			expect(masks!.gMax).toBe(1);
			expect(masks!.bMax).toBe(1);
			expect(masks!.rShift).toBe(0);
			expect(masks!.gShift).toBe(0);
			expect(masks!.bShift).toBe(0);
		});

		it('handles larger header sizes (e.g., BITMAPV4HEADER = 108)', () => {
			const headerSize = 108;
			const view = buildBuffer(headerSize + 12, (v) => {
				v.setUint32(headerSize, 0xff0000, true);
				v.setUint32(headerSize + 4, 0x00ff00, true);
				v.setUint32(headerSize + 8, 0x0000ff, true);
			});
			const masks = parseBitfieldMasks(view, 0, headerSize, BI_BITFIELDS, 32);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0xff0000);
		});
	});

	describe('other compression values', () => {
		it('returns zero masks for compression=1 (BI_RLE8) with 8bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, 1, 8);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
		});

		it('returns zero masks for compression=2 (BI_RLE4) with 4bpp', () => {
			const view = buildBuffer(60, () => {});
			const masks = parseBitfieldMasks(view, 0, 40, 2, 4);
			expect(masks).not.toBeNull();
			expect(masks!.rMask).toBe(0);
		});
	});
});

// ---------------------------------------------------------------------------
// decodeUncompressedRows
// ---------------------------------------------------------------------------

describe('decodeUncompressedRows()', () => {
	// -----------------------------------------------------------------------
	// 1 bpp (monochrome)
	// -----------------------------------------------------------------------
	describe('1 bpp (monochrome)', () => {
		const bwTable: Array<[number, number, number]> = [
			[0, 0, 0], // bit 0: black
			[255, 255, 255], // bit 1: white
		];

		it('decodes alternating bits in a single byte', () => {
			// 8px wide, 1bpp => 1 byte pixels, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0b10101010);
			});
			const out = new Uint8ClampedArray(8 * 1 * 4);
			decodeUncompressedRows(view, 0, 8, 1, false, 1, bwTable, identityMasks(), out);

			// Bit 7 (pixel 0) = 1 => white
			expect(out[0]).toBe(255);
			expect(out[1]).toBe(255);
			expect(out[2]).toBe(255);
			expect(out[3]).toBe(255);
			// Bit 6 (pixel 1) = 0 => black
			expect(out[4]).toBe(0);
			expect(out[5]).toBe(0);
			expect(out[6]).toBe(0);
			expect(out[7]).toBe(255); // alpha always 255
			// Bit 5 (pixel 2) = 1 => white
			expect(out[8]).toBe(255);
		});

		it('decodes all-zero byte as all black', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x00);
			});
			const out = new Uint8ClampedArray(8 * 1 * 4);
			decodeUncompressedRows(view, 0, 8, 1, false, 1, bwTable, identityMasks(), out);

			for (let x = 0; x < 8; x++) {
				expect(out[x * 4]).toBe(0);
				expect(out[x * 4 + 1]).toBe(0);
				expect(out[x * 4 + 2]).toBe(0);
				expect(out[x * 4 + 3]).toBe(255);
			}
		});

		it('decodes all-one byte as all white', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0xff);
			});
			const out = new Uint8ClampedArray(8 * 1 * 4);
			decodeUncompressedRows(view, 0, 8, 1, false, 1, bwTable, identityMasks(), out);

			for (let x = 0; x < 8; x++) {
				expect(out[x * 4]).toBe(255);
				expect(out[x * 4 + 1]).toBe(255);
				expect(out[x * 4 + 2]).toBe(255);
				expect(out[x * 4 + 3]).toBe(255);
			}
		});

		it('handles width not a multiple of 8 (only first N bits matter)', () => {
			// 3px wide, 1bpp => 1 byte, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0b11100000); // only first 3 bits matter
			});
			const out = new Uint8ClampedArray(3 * 1 * 4);
			decodeUncompressedRows(view, 0, 3, 1, false, 1, bwTable, identityMasks(), out);

			// All 3 pixels should be white
			for (let x = 0; x < 3; x++) {
				expect(out[x * 4]).toBe(255);
				expect(out[x * 4 + 3]).toBe(255);
			}
		});

		it('handles index out of color table bounds gracefully (no crash)', () => {
			// Color table has only 1 entry (index 0), bit 1 is out of bounds
			const singleEntry: Array<[number, number, number]> = [[128, 128, 128]];
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0b10000000); // bit 0 is 1, out of color table
			});
			const out = new Uint8ClampedArray(1 * 1 * 4);
			decodeUncompressedRows(view, 0, 1, 1, false, 1, singleEntry, identityMasks(), out);
			// Should not crash; alpha still set to 255
			expect(out[3]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// 4 bpp (16-color indexed)
	// -----------------------------------------------------------------------
	describe('4 bpp (16-color indexed)', () => {
		const colorTable: Array<[number, number, number]> = [
			[0, 0, 0], // 0: black
			[255, 0, 0], // 1: red
			[0, 255, 0], // 2: green
			[0, 0, 255], // 3: blue
			[255, 255, 0], // 4: yellow
			[255, 0, 255], // 5: magenta
			[0, 255, 255], // 6: cyan
			[255, 255, 255], // 7: white
		];

		it('decodes two pixels from a single byte (high and low nibble)', () => {
			// 2px wide, 4bpp => 1 byte pixels, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x12); // high nibble=1 (red), low nibble=2 (green)
			});
			const out = new Uint8ClampedArray(2 * 1 * 4);
			decodeUncompressedRows(view, 0, 2, 1, false, 4, colorTable, identityMasks(), out);

			// Pixel 0: red
			expect(out[0]).toBe(255);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(255);
			// Pixel 1: green
			expect(out[4]).toBe(0);
			expect(out[5]).toBe(255);
			expect(out[6]).toBe(0);
			expect(out[7]).toBe(255);
		});

		it('decodes odd-width image (3 pixels from 2 bytes)', () => {
			// 3px wide, 4bpp => 2 bytes pixels, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x34); // nibbles: 3 (blue), 4 (yellow)
				v.setUint8(1, 0x50); // nibble: 5 (magenta), 0 (unused)
			});
			const out = new Uint8ClampedArray(3 * 1 * 4);
			decodeUncompressedRows(view, 0, 3, 1, false, 4, colorTable, identityMasks(), out);

			// Pixel 0: blue
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(255);
			// Pixel 1: yellow
			expect(out[4]).toBe(255);
			expect(out[5]).toBe(255);
			expect(out[6]).toBe(0);
			// Pixel 2: magenta
			expect(out[8]).toBe(255);
			expect(out[9]).toBe(0);
			expect(out[10]).toBe(255);
		});

		it('sets alpha to 255 for all pixels', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x00);
			});
			const out = new Uint8ClampedArray(2 * 1 * 4);
			decodeUncompressedRows(view, 0, 2, 1, false, 4, colorTable, identityMasks(), out);
			expect(out[3]).toBe(255);
			expect(out[7]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// 8 bpp (256-color indexed)
	// -----------------------------------------------------------------------
	describe('8 bpp (indexed)', () => {
		const colorTable: Array<[number, number, number]> = [
			[0, 0, 0], // 0: black
			[255, 0, 0], // 1: red
			[0, 255, 0], // 2: green
			[0, 0, 255], // 3: blue
		];

		it('maps single index to colour table entry', () => {
			// 1x1 8bpp, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 2); // index 2 => green
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 8, colorTable, identityMasks(), out);
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(255);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(255);
		});

		it('maps multiple indices correctly across a row', () => {
			// 4px wide, 8bpp => 4 bytes, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0); // black
				v.setUint8(1, 1); // red
				v.setUint8(2, 2); // green
				v.setUint8(3, 3); // blue
			});
			const out = new Uint8ClampedArray(4 * 1 * 4);
			decodeUncompressedRows(view, 0, 4, 1, false, 8, colorTable, identityMasks(), out);

			// black
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			// red
			expect(out[4]).toBe(255);
			expect(out[5]).toBe(0);
			expect(out[6]).toBe(0);
			// green
			expect(out[8]).toBe(0);
			expect(out[9]).toBe(255);
			// blue
			expect(out[12]).toBe(0);
			expect(out[13]).toBe(0);
			expect(out[14]).toBe(255);
		});

		it('handles index out of color table bounds (no crash, pixel unchanged)', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 200); // index 200, beyond the 4-entry table
			});
			const out = new Uint8ClampedArray(4);
			out.fill(0);
			decodeUncompressedRows(view, 0, 1, 1, false, 8, colorTable, identityMasks(), out);
			// RGB stays 0 (unchanged), alpha is 255
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// 16 bpp
	// -----------------------------------------------------------------------
	describe('16 bpp', () => {
		it('decodes pure white in RGB555', () => {
			// RGB555: white = 0x7FFF (0_11111_11111_11111)
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x7fff, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], rgb555Masks(), out);
			expect(out[0]).toBe(255); // R
			expect(out[1]).toBe(255); // G
			expect(out[2]).toBe(255); // B
			expect(out[3]).toBe(255); // A
		});

		it('decodes pure black in RGB555', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x0000, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], rgb555Masks(), out);
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(255);
		});

		it('decodes pure red in RGB555', () => {
			// RGB555 red: 0_11111_00000_00000 = 0x7C00
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x7c00, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], rgb555Masks(), out);
			expect(out[0]).toBe(255); // R
			expect(out[1]).toBe(0); // G
			expect(out[2]).toBe(0); // B
		});

		it('decodes pure green in RGB555', () => {
			// RGB555 green: 0_00000_11111_00000 = 0x03E0
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x03e0, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], rgb555Masks(), out);
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(255);
			expect(out[2]).toBe(0);
		});

		it('decodes pure blue in RGB555', () => {
			// RGB555 blue: 0_00000_00000_11111 = 0x001F
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x001f, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], rgb555Masks(), out);
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(255);
		});

		it('decodes with RGB565 bitfield masks', () => {
			const masks: BitfieldMasks = {
				rMask: 0xf800,
				gMask: 0x07e0,
				bMask: 0x001f,
				rShift: 11,
				gShift: 5,
				bShift: 0,
				rMax: 31,
				gMax: 63,
				bMax: 31,
			};
			// Pure red in RGB565: 11111_000000_00000 = 0xF800
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0xf800, true);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 16, [], masks, out);
			expect(out[0]).toBe(255);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
		});

		it('decodes multiple 16bpp pixels in a row', () => {
			// 2px wide => 4 bytes pixel data, row stride = 4
			const view = buildBuffer(4, (v) => {
				v.setUint16(0, 0x7c00, true); // red
				v.setUint16(2, 0x001f, true); // blue
			});
			const out = new Uint8ClampedArray(2 * 4);
			decodeUncompressedRows(view, 0, 2, 1, false, 16, [], rgb555Masks(), out);
			// Pixel 0: red
			expect(out[0]).toBe(255);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			// Pixel 1: blue
			expect(out[4]).toBe(0);
			expect(out[5]).toBe(0);
			expect(out[6]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// 24 bpp
	// -----------------------------------------------------------------------
	describe('24 bpp', () => {
		it('decodes a 1x1 pixel (BGR -> RGBA)', () => {
			// row stride for 1px 24bpp: ceil((24*1+31)/32)*4 = 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0xff); // B
				v.setUint8(1, 0x80); // G
				v.setUint8(2, 0x40); // R
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 24, [], identityMasks(), out);
			expect(out[0]).toBe(0x40); // R
			expect(out[1]).toBe(0x80); // G
			expect(out[2]).toBe(0xff); // B
			expect(out[3]).toBe(255); // A
		});

		it('decodes a 2x1 row with proper stride padding', () => {
			// 2px 24bpp => 6 bytes data, row stride = 8
			const view = buildBuffer(8, (v) => {
				// Pixel 0: B=0, G=0, R=0xFF (red)
				v.setUint8(0, 0x00);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0xff);
				// Pixel 1: B=0xFF, G=0, R=0 (blue)
				v.setUint8(3, 0xff);
				v.setUint8(4, 0x00);
				v.setUint8(5, 0x00);
			});
			const out = new Uint8ClampedArray(2 * 4);
			decodeUncompressedRows(view, 0, 2, 1, false, 24, [], identityMasks(), out);
			// Pixel 0: RGBA(255, 0, 0, 255)
			expect(out[0]).toBe(0xff);
			expect(out[1]).toBe(0x00);
			expect(out[2]).toBe(0x00);
			expect(out[3]).toBe(255);
			// Pixel 1: RGBA(0, 0, 255, 255)
			expect(out[4]).toBe(0x00);
			expect(out[5]).toBe(0x00);
			expect(out[6]).toBe(0xff);
			expect(out[7]).toBe(255);
		});

		it('decodes bottom-up 1x2 image (row order flipped)', () => {
			// Row stride = 4
			const view = buildBuffer(8, (v) => {
				// File row 0 (bottom): B=0, G=0xFF, R=0 => green
				v.setUint8(0, 0x00);
				v.setUint8(1, 0xff);
				v.setUint8(2, 0x00);
				// File row 1 (top): B=0, G=0, R=0xFF => red
				v.setUint8(4, 0x00);
				v.setUint8(5, 0x00);
				v.setUint8(6, 0xff);
			});
			const out = new Uint8ClampedArray(1 * 2 * 4);
			decodeUncompressedRows(view, 0, 1, 2, false, 24, [], identityMasks(), out);
			// Output row 0 (top) should be file row 1 => red
			expect(out[0]).toBe(0xff);
			expect(out[1]).toBe(0x00);
			expect(out[2]).toBe(0x00);
			// Output row 1 (bottom) should be file row 0 => green
			expect(out[4]).toBe(0x00);
			expect(out[5]).toBe(0xff);
			expect(out[6]).toBe(0x00);
		});

		it('handles pure white (B=255, G=255, R=255)', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 255);
				v.setUint8(1, 255);
				v.setUint8(2, 255);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 24, [], identityMasks(), out);
			expect(out[0]).toBe(255);
			expect(out[1]).toBe(255);
			expect(out[2]).toBe(255);
			expect(out[3]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// 32 bpp
	// -----------------------------------------------------------------------
	describe('32 bpp', () => {
		it('decodes BGRA -> RGBA with alpha=0 becoming 255', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x11); // B
				v.setUint8(1, 0x22); // G
				v.setUint8(2, 0x33); // R
				v.setUint8(3, 0x00); // A=0 => treated as 255
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
			expect(out[0]).toBe(0x33);
			expect(out[1]).toBe(0x22);
			expect(out[2]).toBe(0x11);
			expect(out[3]).toBe(255);
		});

		it('preserves non-zero alpha', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x00); // B
				v.setUint8(1, 0x00); // G
				v.setUint8(2, 0xff); // R
				v.setUint8(3, 0x80); // A=128
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
			expect(out[0]).toBe(0xff);
			expect(out[3]).toBe(0x80);
		});

		it('preserves alpha=1 (minimum non-zero)', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0x00);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0x00);
				v.setUint8(3, 0x01); // A=1
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
			expect(out[3]).toBe(1);
		});

		it('preserves alpha=255 (fully opaque)', () => {
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0xaa);
				v.setUint8(1, 0xbb);
				v.setUint8(2, 0xcc);
				v.setUint8(3, 0xff);
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
			expect(out[0]).toBe(0xcc); // R
			expect(out[1]).toBe(0xbb); // G
			expect(out[2]).toBe(0xaa); // B
			expect(out[3]).toBe(0xff); // A
		});

		it('decodes a 2x1 row', () => {
			// 2px 32bpp => 8 bytes, row stride = 8
			const view = buildBuffer(8, (v) => {
				// Pixel 0: BGRA
				v.setUint8(0, 0xff); // B
				v.setUint8(1, 0x00); // G
				v.setUint8(2, 0x00); // R
				v.setUint8(3, 0x80); // A=128
				// Pixel 1: BGRA
				v.setUint8(4, 0x00); // B
				v.setUint8(5, 0xff); // G
				v.setUint8(6, 0x00); // R
				v.setUint8(7, 0x00); // A=0 => 255
			});
			const out = new Uint8ClampedArray(2 * 4);
			decodeUncompressedRows(view, 0, 2, 1, false, 32, [], identityMasks(), out);
			// Pixel 0: RGBA(0, 0, 255, 128)
			expect(out[0]).toBe(0x00);
			expect(out[1]).toBe(0x00);
			expect(out[2]).toBe(0xff);
			expect(out[3]).toBe(0x80);
			// Pixel 1: RGBA(0, 255, 0, 255) - alpha 0 => 255
			expect(out[4]).toBe(0x00);
			expect(out[5]).toBe(0xff);
			expect(out[6]).toBe(0x00);
			expect(out[7]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// Top-down vs bottom-up
	// -----------------------------------------------------------------------
	describe('top-down vs bottom-up', () => {
		it('top-down preserves file row order', () => {
			// 1x2, 24bpp, row stride = 4
			const view = buildBuffer(8, (v) => {
				// Row 0: B=0xff, G=0, R=0 => blue
				v.setUint8(0, 0xff);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0x00);
				// Row 1: B=0, G=0xff, R=0 => green
				v.setUint8(4, 0x00);
				v.setUint8(5, 0xff);
				v.setUint8(6, 0x00);
			});
			const out = new Uint8ClampedArray(1 * 2 * 4);
			decodeUncompressedRows(view, 0, 1, 2, true, 24, [], identityMasks(), out);
			// Row 0 in output: R=0, G=0, B=0xFF
			expect(out[0]).toBe(0x00);
			expect(out[1]).toBe(0x00);
			expect(out[2]).toBe(0xff);
			// Row 1 in output: R=0, G=0xFF, B=0
			expect(out[4]).toBe(0x00);
			expect(out[5]).toBe(0xff);
			expect(out[6]).toBe(0x00);
		});

		it('bottom-up flips row order', () => {
			// Same data as above but bottom-up
			const view = buildBuffer(8, (v) => {
				v.setUint8(0, 0xff);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0x00);
				v.setUint8(4, 0x00);
				v.setUint8(5, 0xff);
				v.setUint8(6, 0x00);
			});
			const out = new Uint8ClampedArray(1 * 2 * 4);
			decodeUncompressedRows(view, 0, 1, 2, false, 24, [], identityMasks(), out);
			// Output row 0 should be file row 1 (green)
			expect(out[0]).toBe(0x00);
			expect(out[1]).toBe(0xff);
			expect(out[2]).toBe(0x00);
			// Output row 1 should be file row 0 (blue)
			expect(out[4]).toBe(0x00);
			expect(out[5]).toBe(0x00);
			expect(out[6]).toBe(0xff);
		});

		it('top-down with 3 rows preserves order', () => {
			// 1x3, 24bpp, row stride = 4
			const view = buildBuffer(12, (v) => {
				// Row 0: red (R=0xFF, G=0, B=0)
				v.setUint8(0, 0x00); // B
				v.setUint8(1, 0x00); // G
				v.setUint8(2, 0xff); // R
				// Row 1: green
				v.setUint8(4, 0x00);
				v.setUint8(5, 0xff);
				v.setUint8(6, 0x00);
				// Row 2: blue
				v.setUint8(8, 0xff);
				v.setUint8(9, 0x00);
				v.setUint8(10, 0x00);
			});
			const out = new Uint8ClampedArray(1 * 3 * 4);
			decodeUncompressedRows(view, 0, 1, 3, true, 24, [], identityMasks(), out);
			expect(out[0]).toBe(0xff); // Row 0: R
			expect(out[4]).toBe(0x00); // Row 1: R (green)
			expect(out[5]).toBe(0xff); // Row 1: G
			expect(out[8]).toBe(0x00); // Row 2: R (blue)
			expect(out[10]).toBe(0xff); // Row 2: B
		});
	});

	// -----------------------------------------------------------------------
	// bitsOffset parameter
	// -----------------------------------------------------------------------
	describe('bitsOffset parameter', () => {
		it('reads pixel data starting from the specified offset', () => {
			const offset = 10;
			const view = buildBuffer(14, (v) => {
				// Write pixel data starting at offset 10
				v.setUint8(offset, 0x00); // B
				v.setUint8(offset + 1, 0x80); // G
				v.setUint8(offset + 2, 0xff); // R
			});
			const out = new Uint8ClampedArray(4);
			decodeUncompressedRows(view, offset, 1, 1, false, 24, [], identityMasks(), out);
			expect(out[0]).toBe(0xff); // R
			expect(out[1]).toBe(0x80); // G
			expect(out[2]).toBe(0x00); // B
			expect(out[3]).toBe(255);
		});
	});

	// -----------------------------------------------------------------------
	// Row stride / padding
	// -----------------------------------------------------------------------
	describe('row stride and padding', () => {
		it('correctly pads rows to 4-byte boundary (24bpp, 1px = 3 bytes -> 4 stride)', () => {
			// 1px wide 24bpp: 3 bytes data, padded to 4
			// 2 rows => 8 bytes total
			const view = buildBuffer(8, (v) => {
				v.setUint8(0, 0xff);
				v.setUint8(1, 0);
				v.setUint8(2, 0); // row 0: blue
				// byte 3 is padding
				v.setUint8(4, 0);
				v.setUint8(5, 0xff);
				v.setUint8(6, 0); // row 1: green
			});
			const out = new Uint8ClampedArray(1 * 2 * 4);
			decodeUncompressedRows(view, 0, 1, 2, true, 24, [], identityMasks(), out);
			// Row 0: blue
			expect(out[2]).toBe(0xff);
			// Row 1: green
			expect(out[5]).toBe(0xff);
		});

		it('correctly pads rows to 4-byte boundary (24bpp, 3px = 9 bytes -> 12 stride)', () => {
			// 3px wide 24bpp: 9 bytes data, padded to 12
			const view = buildBuffer(12, (v) => {
				v.setUint8(0, 0xff);
				v.setUint8(1, 0);
				v.setUint8(2, 0); // px0: blue
				v.setUint8(3, 0);
				v.setUint8(4, 0xff);
				v.setUint8(5, 0); // px1: green
				v.setUint8(6, 0);
				v.setUint8(7, 0);
				v.setUint8(8, 0xff); // px2: red
				// bytes 9-11 are padding
			});
			const out = new Uint8ClampedArray(3 * 1 * 4);
			decodeUncompressedRows(view, 0, 3, 1, false, 24, [], identityMasks(), out);
			// px0: BGR(0xFF,0,0) => RGBA(0, 0, 0xFF, 255) => blue
			expect(out[0]).toBe(0x00); // px0 R
			expect(out[1]).toBe(0x00); // px0 G
			expect(out[2]).toBe(0xff); // px0 B
			// px1: BGR(0,0xFF,0) => RGBA(0, 0xFF, 0, 255) => green
			expect(out[4]).toBe(0x00); // px1 R
			expect(out[5]).toBe(0xff); // px1 G
			expect(out[6]).toBe(0x00); // px1 B
			// px2: BGR(0,0,0xFF) => RGBA(0xFF, 0, 0, 255) => red
			expect(out[8]).toBe(0xff); // px2 R
			expect(out[9]).toBe(0x00); // px2 G
			expect(out[10]).toBe(0x00); // px2 B
		});
	});

	// -----------------------------------------------------------------------
	// Boundary: row extends beyond view
	// -----------------------------------------------------------------------
	describe('out-of-bounds rows', () => {
		it('skips rows whose data extends beyond the view', () => {
			// 1x2, 24bpp, row stride = 4, need 8 bytes total, but only provide 4
			const view = buildBuffer(4, (v) => {
				v.setUint8(0, 0xff);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0x00);
			});
			const out = new Uint8ClampedArray(1 * 2 * 4);
			out.fill(0);
			// Bottom-up: output row 0 reads file row 1 (at offset 4), which is beyond buffer
			//            output row 1 reads file row 0 (at offset 0), which is valid
			decodeUncompressedRows(view, 0, 1, 2, false, 24, [], identityMasks(), out);
			// Row 0 (top) should be skipped (zeroed)
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(0);
			// Row 1 (bottom) should be decoded from file row 0
			expect(out[4]).toBe(0x00); // R
			expect(out[5]).toBe(0x00); // G
			expect(out[6]).toBe(0xff); // B
			expect(out[7]).toBe(255); // A
		});

		it('handles completely empty view gracefully', () => {
			const view = buildBuffer(0, () => {});
			const out = new Uint8ClampedArray(4);
			out.fill(0);
			// Should not crash
			decodeUncompressedRows(view, 0, 1, 1, false, 24, [], identityMasks(), out);
			// Row should be skipped, output stays zeroed
			expect(out[0]).toBe(0);
			expect(out[3]).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// Multi-row, multi-pixel integration
	// -----------------------------------------------------------------------
	describe('multi-row multi-pixel integration', () => {
		it('decodes a 2x2 24bpp bottom-up image correctly', () => {
			// 2px wide 24bpp => 6 bytes data, row stride = 8
			const view = buildBuffer(16, (v) => {
				// File row 0 (bottom row in output):
				// px(0,0): B=0xFF, G=0, R=0 => blue
				v.setUint8(0, 0xff);
				v.setUint8(1, 0x00);
				v.setUint8(2, 0x00);
				// px(1,0): B=0, G=0xFF, R=0 => green
				v.setUint8(3, 0x00);
				v.setUint8(4, 0xff);
				v.setUint8(5, 0x00);

				// File row 1 (top row in output):
				// px(0,1): B=0, G=0, R=0xFF => red
				v.setUint8(8, 0x00);
				v.setUint8(9, 0x00);
				v.setUint8(10, 0xff);
				// px(1,1): B=0xFF, G=0xFF, R=0xFF => white
				v.setUint8(11, 0xff);
				v.setUint8(12, 0xff);
				v.setUint8(13, 0xff);
			});
			const out = new Uint8ClampedArray(2 * 2 * 4);
			decodeUncompressedRows(view, 0, 2, 2, false, 24, [], identityMasks(), out);

			// Output row 0 = file row 1 (top): red, white
			expect(out[0]).toBe(0xff);
			expect(out[1]).toBe(0x00);
			expect(out[2]).toBe(0x00); // red
			expect(out[4]).toBe(0xff);
			expect(out[5]).toBe(0xff);
			expect(out[6]).toBe(0xff); // white

			// Output row 1 = file row 0 (bottom): blue, green
			expect(out[8]).toBe(0x00);
			expect(out[9]).toBe(0x00);
			expect(out[10]).toBe(0xff); // blue
			expect(out[12]).toBe(0x00);
			expect(out[13]).toBe(0xff);
			expect(out[14]).toBe(0x00); // green
		});

		it('decodes a 3x3 8bpp image', () => {
			const colorTable: Array<[number, number, number]> = [
				[0, 0, 0], // 0: black
				[255, 0, 0], // 1: red
				[0, 255, 0], // 2: green
				[0, 0, 255], // 3: blue
				[255, 255, 0], // 4: yellow
				[255, 0, 255], // 5: magenta
				[0, 255, 255], // 6: cyan
				[255, 255, 255], // 7: white
				[128, 128, 128], // 8: gray
			];
			// 3px wide 8bpp => 3 bytes, row stride = 4
			const view = buildBuffer(12, (v) => {
				// Row 0: indices 0,1,2
				v.setUint8(0, 0);
				v.setUint8(1, 1);
				v.setUint8(2, 2);
				// Row 1: indices 3,4,5
				v.setUint8(4, 3);
				v.setUint8(5, 4);
				v.setUint8(6, 5);
				// Row 2: indices 6,7,8
				v.setUint8(8, 6);
				v.setUint8(9, 7);
				v.setUint8(10, 8);
			});
			const out = new Uint8ClampedArray(3 * 3 * 4);
			decodeUncompressedRows(view, 0, 3, 3, true, 8, colorTable, identityMasks(), out);

			// Check a few key pixels
			// (0,0): index 0 => black
			expect(out[0]).toBe(0);
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			// (2,0): index 2 => green
			expect(out[8]).toBe(0);
			expect(out[9]).toBe(255);
			expect(out[10]).toBe(0);
			// (1,1): index 4 => yellow
			const px11 = (1 * 3 + 1) * 4;
			expect(out[px11]).toBe(255);
			expect(out[px11 + 1]).toBe(255);
			expect(out[px11 + 2]).toBe(0);
			// (2,2): index 8 => gray
			const px22 = (2 * 3 + 2) * 4;
			expect(out[px22]).toBe(128);
			expect(out[px22 + 1]).toBe(128);
			expect(out[px22 + 2]).toBe(128);

			// All alpha values should be 255
			for (let i = 3; i < out.length; i += 4) {
				expect(out[i]).toBe(255);
			}
		});
	});
});
