import { describe, it, expect } from 'vitest';

import {
	decodeEmfPlusBitmapPixels,
	PIXELFORMAT_24BPP_RGB,
	PIXELFORMAT_32BPP_RGB,
	PIXELFORMAT_32BPP_ARGB,
	PIXELFORMAT_32BPP_PARGB,
} from './emf-plus-bitmap-decoder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a DataView with pixel data written by the callback.
 */
function buildPixelView(size: number, writer: (view: DataView) => void): DataView {
	const buf = new ArrayBuffer(size);
	const view = new DataView(buf);
	writer(view);
	return view;
}

/**
 * Read the BMP file header from a result buffer and return basic info.
 */
function readBmpHeader(buf: ArrayBuffer) {
	const view = new DataView(buf);
	const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1));
	const fileSize = view.getUint32(2, true);
	const pixelOffset = view.getUint32(10, true);
	const dibHeaderSize = view.getUint32(14, true);
	const width = view.getInt32(18, true);
	const height = view.getInt32(22, true);
	const bpp = view.getUint16(28, true);
	return { magic, fileSize, pixelOffset, dibHeaderSize, width, height, bpp };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emf-plus-bitmap-decoder', () => {
	describe('decodeEmfPlusBitmapPixels()', () => {
		it('returns null for unsupported pixel format', () => {
			const view = buildPixelView(16, () => {});
			const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, 0x12345678);
			expect(result).toBeNull();
		});

		// -----------------------------------------------------------------------
		// 32bpp ARGB
		// -----------------------------------------------------------------------
		describe('32bpp ARGB', () => {
			it('decodes a 1x1 pixel', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0x11); // B
					v.setUint8(1, 0x22); // G
					v.setUint8(2, 0x33); // R
					v.setUint8(3, 0xff); // A
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();
				const header = readBmpHeader(result!);
				expect(header.magic).toBe('BM');
				expect(header.width).toBe(1);
				expect(header.height).toBe(1);
				expect(header.bpp).toBe(32);
			});

			it('produces a valid BMP file with correct file size', () => {
				const view = buildPixelView(16, (v) => {
					// 2x2 image, stride=8
					for (let i = 0; i < 16; i++) {
						v.setUint8(i, i % 256);
					}
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 2, 2, 8, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();
				const header = readBmpHeader(result!);
				expect(header.magic).toBe('BM');
				expect(header.fileSize).toBe(result!.byteLength);
				expect(header.dibHeaderSize).toBe(108); // BITMAPV4HEADER
			});

			it('preserves alpha channel', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0); // B
					v.setUint8(1, 0); // G
					v.setUint8(2, 0xff); // R
					v.setUint8(3, 0x80); // A = 128
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();

				// Read back the pixel data from the BMP
				const bmpView = new DataView(result!);
				const pixelOffset = bmpView.getUint32(10, true);
				// pixel should be BGRA in BMP: B, G, R, A
				const b = bmpView.getUint8(pixelOffset);
				const g = bmpView.getUint8(pixelOffset + 1);
				const r = bmpView.getUint8(pixelOffset + 2);
				const a = bmpView.getUint8(pixelOffset + 3);
				expect(r).toBe(0xff);
				expect(g).toBe(0);
				expect(b).toBe(0);
				expect(a).toBe(0x80);
			});
		});

		// -----------------------------------------------------------------------
		// 32bpp PARGB (premultiplied alpha)
		// -----------------------------------------------------------------------
		describe('32bpp PARGB', () => {
			it('un-premultiplies alpha', () => {
				// Premultiplied: r=128, g=0, b=0 with alpha=128
				// Unpremultiplied should be: r=255, g=0, b=0, a=128
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0); // B
					v.setUint8(1, 0); // G
					v.setUint8(2, 128); // R (premultiplied)
					v.setUint8(3, 128); // A
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_PARGB);
				expect(result).not.toBeNull();

				const bmpView = new DataView(result!);
				const pixelOffset = bmpView.getUint32(10, true);
				const r = bmpView.getUint8(pixelOffset + 2);
				// Should be un-premultiplied: round(128 * 255 / 128) = 255
				expect(r).toBe(255);
			});

			it('handles fully opaque PARGB (no change needed)', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0x44); // B
					v.setUint8(1, 0x88); // G
					v.setUint8(2, 0xcc); // R
					v.setUint8(3, 0xff); // A = 255 (fully opaque)
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_PARGB);
				expect(result).not.toBeNull();

				const bmpView = new DataView(result!);
				const pixelOffset = bmpView.getUint32(10, true);
				// No un-premultiplication needed for alpha=255
				expect(bmpView.getUint8(pixelOffset + 2)).toBe(0xcc); // R unchanged
			});

			it('handles zero alpha (no division by zero)', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0);
					v.setUint8(1, 0);
					v.setUint8(2, 0);
					v.setUint8(3, 0); // alpha = 0
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_PARGB);
				expect(result).not.toBeNull();
				// Should not crash — alpha=0 skips un-premultiply
			});
		});

		// -----------------------------------------------------------------------
		// 32bpp RGB (no alpha)
		// -----------------------------------------------------------------------
		describe('32bpp RGB', () => {
			it('sets alpha to 255', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0x10); // B
					v.setUint8(1, 0x20); // G
					v.setUint8(2, 0x30); // R
					v.setUint8(3, 0); // unused byte (would be alpha)
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_RGB);
				expect(result).not.toBeNull();

				const bmpView = new DataView(result!);
				const pixelOffset = bmpView.getUint32(10, true);
				expect(bmpView.getUint8(pixelOffset + 3)).toBe(255); // forced alpha
			});
		});

		// -----------------------------------------------------------------------
		// 24bpp RGB
		// -----------------------------------------------------------------------
		describe('24bpp RGB', () => {
			it('decodes 24bpp pixels and sets alpha to 255', () => {
				// 1x1, stride=3 (minimum for 24bpp 1px)
				// Actually stride for 24bpp 1px would be ceil to 4-byte boundary
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0xaa); // B
					v.setUint8(1, 0xbb); // G
					v.setUint8(2, 0xcc); // R
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_24BPP_RGB);
				expect(result).not.toBeNull();

				const bmpView = new DataView(result!);
				const pixelOffset = bmpView.getUint32(10, true);
				expect(bmpView.getUint8(pixelOffset)).toBe(0xaa); // B
				expect(bmpView.getUint8(pixelOffset + 1)).toBe(0xbb); // G
				expect(bmpView.getUint8(pixelOffset + 2)).toBe(0xcc); // R
				expect(bmpView.getUint8(pixelOffset + 3)).toBe(255); // A forced
			});
		});

		// -----------------------------------------------------------------------
		// Top-down vs bottom-up
		// -----------------------------------------------------------------------
		describe('stride direction', () => {
			it('handles positive stride (top-down)', () => {
				// 1x2 image, top-down (stride > 0)
				const view = buildPixelView(8, (v) => {
					// row 0 (top): BGRA
					v.setUint8(0, 0xff);
					v.setUint8(1, 0);
					v.setUint8(2, 0);
					v.setUint8(3, 0xff);
					// row 1 (bottom): BGRA
					v.setUint8(4, 0);
					v.setUint8(5, 0xff);
					v.setUint8(6, 0);
					v.setUint8(7, 0xff);
				});

				const result = decodeEmfPlusBitmapPixels(
					view,
					0,
					1,
					2,
					4, // positive = top-down
					PIXELFORMAT_32BPP_ARGB,
				);
				expect(result).not.toBeNull();
			});

			it('handles negative stride (bottom-up)', () => {
				const view = buildPixelView(8, (v) => {
					// row 0 (bottom in memory)
					v.setUint8(0, 0);
					v.setUint8(1, 0xff);
					v.setUint8(2, 0);
					v.setUint8(3, 0xff);
					// row 1 (top in memory)
					v.setUint8(4, 0xff);
					v.setUint8(5, 0);
					v.setUint8(6, 0);
					v.setUint8(7, 0xff);
				});

				const result = decodeEmfPlusBitmapPixels(
					view,
					0,
					1,
					2,
					-4, // negative = bottom-up
					PIXELFORMAT_32BPP_ARGB,
				);
				expect(result).not.toBeNull();
			});
		});

		// -----------------------------------------------------------------------
		// Multi-pixel images
		// -----------------------------------------------------------------------
		describe('multi-pixel images', () => {
			it('decodes a 2x2 32bpp image correctly', () => {
				// 2x2, stride=8
				const view = buildPixelView(16, (v) => {
					// Row 0: two red pixels (B=0, G=0, R=255, A=255)
					v.setUint8(0, 0);
					v.setUint8(1, 0);
					v.setUint8(2, 255);
					v.setUint8(3, 255);
					v.setUint8(4, 0);
					v.setUint8(5, 0);
					v.setUint8(6, 255);
					v.setUint8(7, 255);
					// Row 1: two blue pixels (B=255, G=0, R=0, A=255)
					v.setUint8(8, 255);
					v.setUint8(9, 0);
					v.setUint8(10, 0);
					v.setUint8(11, 255);
					v.setUint8(12, 255);
					v.setUint8(13, 0);
					v.setUint8(14, 0);
					v.setUint8(15, 255);
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 2, 2, 8, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();
				const header = readBmpHeader(result!);
				expect(header.width).toBe(2);
				expect(header.height).toBe(2);
			});
		});

		// -----------------------------------------------------------------------
		// BMP file structure
		// -----------------------------------------------------------------------
		describe('bMP file structure', () => {
			it('writes correct BITMAPV4HEADER fields', () => {
				const view = buildPixelView(4, (v) => {
					v.setUint8(0, 0);
					v.setUint8(1, 0);
					v.setUint8(2, 0);
					v.setUint8(3, 0xff);
				});

				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();
				const bmpView = new DataView(result!);

				// BITMAPFILEHEADER
				expect(bmpView.getUint8(0)).toBe(0x42); // 'B'
				expect(bmpView.getUint8(1)).toBe(0x4d); // 'M'
				expect(bmpView.getUint32(10, true)).toBe(14 + 108); // pixel data offset

				// BITMAPV4HEADER
				expect(bmpView.getUint32(14, true)).toBe(108); // header size
				expect(bmpView.getUint16(26, true)).toBe(1); // planes
				expect(bmpView.getUint16(28, true)).toBe(32); // bpp
				expect(bmpView.getUint32(30, true)).toBe(3); // BI_BITFIELDS

				// Channel masks
				expect(bmpView.getUint32(54, true)).toBe(0x00ff0000); // R
				expect(bmpView.getUint32(58, true)).toBe(0x0000ff00); // G
				expect(bmpView.getUint32(62, true)).toBe(0x000000ff); // B
				expect(bmpView.getUint32(66, true)).toBe(0xff000000); // A

				// sRGB color space
				expect(bmpView.getUint32(70, true)).toBe(0x73524742); // 'BGRs'
			});
		});

		// -----------------------------------------------------------------------
		// Edge cases
		// -----------------------------------------------------------------------
		describe('edge cases', () => {
			it('handles pixelStart offset', () => {
				// Put pixel data at offset 10
				const view = buildPixelView(14, (v) => {
					v.setUint8(10, 0);
					v.setUint8(11, 0xff);
					v.setUint8(12, 0);
					v.setUint8(13, 0xff);
				});

				const result = decodeEmfPlusBitmapPixels(view, 10, 1, 1, 4, PIXELFORMAT_32BPP_ARGB);
				expect(result).not.toBeNull();
			});

			it('handles pixel data that goes beyond view boundary gracefully', () => {
				// 1x1 but only 2 bytes available (needs 4 for 32bpp)
				const view = buildPixelView(2, () => {});
				const result = decodeEmfPlusBitmapPixels(view, 0, 1, 1, 4, PIXELFORMAT_32BPP_ARGB);
				// Should produce a BMP with zeroed pixel data (break in inner loop)
				expect(result).not.toBeNull();
			});
		});
	});
});
