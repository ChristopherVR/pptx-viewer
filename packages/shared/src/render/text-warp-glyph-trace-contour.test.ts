import { describe, expect, it } from 'vitest';

import type { OutlinePoint } from './text-warp-glyph-outline';
import { contourRaster } from './text-warp-glyph-trace-contour';

function raster(w: number, h: number, inside: (x: number, y: number) => number): Float32Array {
	const values = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			values[y * w + x] = inside(x, y);
		}
	}
	return values;
}

function area(ring: OutlinePoint[]): number {
	let sum = 0;
	ring.forEach((a, i) => {
		const b = ring[(i + 1) % ring.length];
		sum += a.x * b.y - b.x * a.y;
	});
	return sum / 2;
}

describe('contourRaster', () => {
	it('traces a filled square as one ring at the 50% crossings', () => {
		const rings = contourRaster(
			raster(10, 10, (x, y) => (x >= 2 && x <= 6 && y >= 3 && y <= 5 ? 1 : 0)),
			10,
			10,
			0.5,
		);
		expect(rings).toHaveLength(1);
		const xs = rings[0].map((p) => p.x);
		const ys = rings[0].map((p) => p.y);
		expect(Math.min(...xs)).toBeCloseTo(1.5, 6);
		expect(Math.max(...xs)).toBeCloseTo(6.5, 6);
		expect(Math.min(...ys)).toBeCloseTo(2.5, 6);
		expect(Math.max(...ys)).toBeCloseTo(5.5, 6);
	});

	it('interpolates partial coverage to a sub-pixel edge', () => {
		const rings = contourRaster(
			raster(8, 8, (x, y) => (y < 2 || y > 5 ? 0 : x >= 2 && x <= 4 ? 1 : x === 5 ? 0.75 : 0)),
			8,
			8,
			0.5,
		);
		// Between x=5 (0.75) and x=6 (0): the 0.5 crossing is at 5 + 0.25/0.75.
		expect(Math.max(...rings[0].map((p) => p.x))).toBeCloseTo(5 + 1 / 3, 6);
	});

	it('winds a counter opposite to its outer contour (nonzero fill keeps the hole)', () => {
		const rings = contourRaster(
			raster(12, 12, (x, y) => {
				const outer = x >= 2 && x <= 9 && y >= 2 && y <= 9;
				const hole = x >= 5 && x <= 6 && y >= 5 && y <= 6;
				return outer && !hole ? 1 : 0;
			}),
			12,
			12,
			0.5,
		);
		expect(rings).toHaveLength(2);
		const [a, b] = rings.map(area);
		expect(Math.sign(a)).toBe(-Math.sign(b));
	});
});
