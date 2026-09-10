import { describe, expect, it } from 'vitest';

import { placeTileOnPage } from './pdf-tile-placement';

describe('placeTileOnPage', () => {
	it('places a single full-cover tile at the origin on a native-size page (no letterboxing)', () => {
		// vue/svelte/vanilla/angular convention: page == natural size, tile ==
		// the full (scaled) raster.
		const placement = placeTileOnPage(
			{ x: 0, y: 0, width: 1920, height: 1080 },
			1920,
			1080,
			960,
			540,
		);
		expect(placement).toStrictEqual({ x: 0, y: 0, width: 960, height: 540 });
	});

	it('divides tile coordinates by the export scale on a native-size page', () => {
		// A 2x export (fullWidth=1920 for a 960-wide natural page) of the right
		// half of the raster must land at native x=480, half the native width.
		const placement = placeTileOnPage(
			{ x: 960, y: 0, width: 960, height: 1080 },
			1920,
			1080,
			960,
			540,
		);
		expect(placement).toStrictEqual({ x: 480, y: 0, width: 480, height: 540 });
	});

	it('letterboxes and centers a full-cover tile on a fixed-aspect page (react A4 convention)', () => {
		const PAGE_W = 842;
		const PAGE_H = 595;
		// A 4:3 (1600x1200) full raster fitted into 842x595 (wider than tall):
		// height-constrained, fitScale = 595/1200.
		const placement = placeTileOnPage(
			{ x: 0, y: 0, width: 1600, height: 1200 },
			1600,
			1200,
			PAGE_W,
			PAGE_H,
		);
		const fitScale = PAGE_H / 1200;
		expect(placement.width).toBeCloseTo(1600 * fitScale, 5);
		expect(placement.height).toBeCloseTo(PAGE_H, 5);
		expect(placement.x).toBeCloseTo((PAGE_W - 1600 * fitScale) / 2, 5);
		expect(placement.y).toBeCloseTo(0, 5);
	});

	it('four quadrant tiles reassemble to exactly cover the fitted full-page rectangle', () => {
		const fullWidth = 4000;
		const fullHeight = 3000;
		const pageWidth = 842;
		const pageHeight = 595;
		const quadrants = [
			{ x: 0, y: 0, width: 2000, height: 1500 },
			{ x: 2000, y: 0, width: 2000, height: 1500 },
			{ x: 0, y: 1500, width: 2000, height: 1500 },
			{ x: 2000, y: 1500, width: 2000, height: 1500 },
		];
		const placements = quadrants.map((q) =>
			placeTileOnPage(q, fullWidth, fullHeight, pageWidth, pageHeight),
		);

		const fullPlacement = placeTileOnPage(
			{ x: 0, y: 0, width: fullWidth, height: fullHeight },
			fullWidth,
			fullHeight,
			pageWidth,
			pageHeight,
		);

		// Top-left + bottom-right quadrant corners must match the full fitted rect.
		expect(placements[0].x).toBeCloseTo(fullPlacement.x, 5);
		expect(placements[0].y).toBeCloseTo(fullPlacement.y, 5);
		const bottomRight = placements[3];
		expect(bottomRight.x + bottomRight.width).toBeCloseTo(fullPlacement.x + fullPlacement.width, 5);
		expect(bottomRight.y + bottomRight.height).toBeCloseTo(
			fullPlacement.y + fullPlacement.height,
			5,
		);

		// No gaps between horizontally adjacent tiles.
		expect(placements[0].x + placements[0].width).toBeCloseTo(placements[1].x, 5);
		// No gaps between vertically adjacent tiles.
		expect(placements[0].y + placements[0].height).toBeCloseTo(placements[2].y, 5);
	});

	it('returns a degenerate placement rather than NaN/Infinity for a zero-size full raster', () => {
		const placement = placeTileOnPage({ x: 0, y: 0, width: 0, height: 0 }, 0, 0, 842, 595);
		expect(Number.isFinite(placement.x)).toBeTruthy();
		expect(Number.isFinite(placement.y)).toBeTruthy();
		expect(Number.isFinite(placement.width)).toBeTruthy();
		expect(Number.isFinite(placement.height)).toBeTruthy();
	});
});
