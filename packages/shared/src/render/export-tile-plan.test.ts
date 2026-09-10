import { describe, expect, it } from 'vitest';

import { computeExportTilePlan, tileRectToSourceRect } from './export-tile-plan';

describe('computeExportTilePlan', () => {
	it('does not tile when the full raster fits within the cap', () => {
		const plan = computeExportTilePlan(1920, 1080, 8192);
		expect(plan.tiled).toBeFalsy();
		expect(plan.cols).toBe(1);
		expect(plan.rows).toBe(1);
		expect(plan.tiles).toStrictEqual([{ col: 0, row: 0, x: 0, y: 0, width: 1920, height: 1080 }]);
	});

	it('tiles a raster that exceeds the cap on one axis', () => {
		// 8x scale of a 1920x1080 (16:9) slide = 15360x8640, cap 8192.
		const plan = computeExportTilePlan(15360, 8640, 8192);
		expect(plan.tiled).toBeTruthy();
		expect(plan.cols).toBe(2);
		expect(plan.rows).toBe(2);
		expect(plan.tiles).toHaveLength(4);

		// Tiles reassemble to the exact full size with no gaps/overlaps.
		const maxX = Math.max(...plan.tiles.map((t) => t.x + t.width));
		const maxY = Math.max(...plan.tiles.map((t) => t.y + t.height));
		expect(maxX).toBe(15360);
		expect(maxY).toBe(8640);
	});

	it('tiles a raster that exceeds the cap on both axes with an uneven remainder', () => {
		const plan = computeExportTilePlan(10000, 4000, 4096);
		expect(plan.tiled).toBeTruthy();
		// cols = ceil(10000/4096) = 3, rows = ceil(4000/4096) = 1
		expect(plan.cols).toBe(3);
		expect(plan.rows).toBe(1);

		let coveredWidth = 0;
		for (const tile of plan.tiles.filter((t) => t.row === 0)) {
			expect(tile.x).toBe(coveredWidth);
			coveredWidth += tile.width;
			expect(tile.width).toBeLessThanOrEqual(4096);
		}
		expect(coveredWidth).toBe(10000);
	});

	it('produces contiguous, non-overlapping tiles covering the full raster', () => {
		const plan = computeExportTilePlan(20000, 13000, 5000);
		const covered = new Set<string>();
		for (const t of plan.tiles) {
			for (let x = t.x; x < t.x + t.width; x += 997) {
				for (let y = t.y; y < t.y + t.height; y += 997) {
					const key = `${x},${y}`;
					expect(covered.has(key)).toBeFalsy();
					covered.add(key);
				}
			}
		}
	});

	it('clamps a degenerate cap to a minimum usable tile size', () => {
		const plan = computeExportTilePlan(1000, 1000, 1);
		expect(plan.tiled).toBeTruthy();
		for (const tile of plan.tiles) {
			expect(tile.width).toBeGreaterThan(0);
			expect(tile.height).toBeGreaterThan(0);
		}
	});
});

describe('tileRectToSourceRect', () => {
	it('divides the tile rect by the export scale', () => {
		const rect = tileRectToSourceRect(
			{ col: 1, row: 0, x: 4096, y: 0, width: 4096, height: 2160 },
			4,
		);
		expect(rect).toStrictEqual({ x: 1024, y: 0, width: 1024, height: 540 });
	});

	it('treats a non-positive scale as 1x', () => {
		const rect = tileRectToSourceRect({ col: 0, row: 0, x: 10, y: 20, width: 30, height: 40 }, 0);
		expect(rect).toStrictEqual({ x: 10, y: 20, width: 30, height: 40 });
	});
});
