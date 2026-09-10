import { describe, expect, it } from 'vitest';

import { combineTileRowPixels } from './tile-row-stitch';

function solidTile(width: number, height: number, value: number): Uint8Array {
	const pixels = new Uint8Array(width * height * 4);
	pixels.fill(value);
	return pixels;
}

describe('combineTileRowPixels', () => {
	it('concatenates two tiles left to right, row by row', () => {
		const left = { pixels: solidTile(2, 2, 10), width: 2, height: 2 };
		const right = { pixels: solidTile(1, 2, 20), width: 1, height: 2 };
		const combined = combineTileRowPixels([left, right], 3);

		expect(combined).toHaveLength(3 * 2 * 4);
		// Row 0: [10,10,10,10, 10,10,10,10, 20,20,20,20]
		expect(Array.from(combined.subarray(0, 12))).toStrictEqual([
			10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20,
		]);
		// Row 1 starts at byte 12
		expect(Array.from(combined.subarray(12, 24))).toStrictEqual([
			10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20,
		]);
	});

	it('passes a single full-width tile through unchanged', () => {
		const tile = { pixels: solidTile(4, 3, 99), width: 4, height: 3 };
		const combined = combineTileRowPixels([tile], 4);
		expect(combined).toStrictEqual(tile.pixels);
	});

	it('throws when tile widths do not sum to fullWidth', () => {
		const tile = { pixels: solidTile(2, 2, 1), width: 2, height: 2 };
		expect(() => combineTileRowPixels([tile], 5)).toThrow(/tile widths sum to/u);
	});

	it('throws when tiles in the same row have mismatched heights', () => {
		const a = { pixels: solidTile(2, 2, 1), width: 2, height: 2 };
		const b = { pixels: solidTile(2, 3, 1), width: 2, height: 3 };
		expect(() => combineTileRowPixels([a, b], 4)).toThrow(/same height/u);
	});

	it('throws when given no tiles', () => {
		expect(() => combineTileRowPixels([], 0)).toThrow(/at least one tile/u);
	});

	it("accepts Uint8ClampedArray tile pixel data (getImageData's native type)", () => {
		const clamped = new Uint8ClampedArray(2 * 2 * 4).fill(5);
		const tile = { pixels: clamped, width: 2, height: 2 };
		const combined = combineTileRowPixels([tile], 2);
		expect(Array.from(combined)).toStrictEqual(Array.from(clamped));
	});
});
