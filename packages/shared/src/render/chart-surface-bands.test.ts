import { describe, expect, it } from 'vitest';

import { buildSurfaceWallPanels, isoProject, resolveSurfaceBandFill } from './chart-surface-bands';

describe('isoProject', () => {
	it('projects the origin to the screen origin', () => {
		expect(isoProject(0, 0, 0)).toStrictEqual({ screenX: 0, screenY: 0 });
	});

	it('height (z) only shifts screenY, never screenX', () => {
		const flat = isoProject(1, 1, 0);
		const raised = isoProject(1, 1, 5);
		expect(raised.screenX).toBeCloseTo(flat.screenX);
		expect(raised.screenY).toBeCloseTo(flat.screenY - 5);
	});
});

describe('resolveSurfaceBandFill', () => {
	it('returns undefined when there are no bands', () => {
		expect(resolveSurfaceBandFill(0.5, undefined)).toBeUndefined();
		expect(resolveSurfaceBandFill(0.5, [])).toBeUndefined();
	});

	it('buckets t into N equal-width bands sorted by index', () => {
		const bands = [
			{ index: 1, spPr: { fillColor: '#B' } },
			{ index: 0, spPr: { fillColor: '#A' } },
			{ index: 2, spPr: { fillColor: '#C' } },
		];
		expect(resolveSurfaceBandFill(0, bands)).toBe('#A');
		expect(resolveSurfaceBandFill(0.4, bands)).toBe('#B');
		expect(resolveSurfaceBandFill(0.99, bands)).toBe('#C');
	});

	it('clamps t=1 into the last band rather than overflowing', () => {
		const bands = [
			{ index: 0, spPr: { fillColor: '#A' } },
			{ index: 1, spPr: { fillColor: '#B' } },
		];
		expect(resolveSurfaceBandFill(1, bands)).toBe('#B');
	});

	it('returns undefined for a band with no spPr.fillColor', () => {
		expect(resolveSurfaceBandFill(0.5, [{ index: 0 }])).toBeUndefined();
	});
});

describe('buildSurfaceWallPanels', () => {
	it('returns no panels when no surface has a fill colour', () => {
		expect(buildSurfaceWallPanels(4, 3, 10, 20, 0, 0, {})).toStrictEqual([]);
	});

	it('builds one panel per authored surface, back-wall/side-wall/floor order', () => {
		const panels = buildSurfaceWallPanels(4, 3, 10, 20, 0, 0, {
			floor: { spPr: { fillColor: '#111111' } },
			backWall: { spPr: { fillColor: '#222222' } },
			sideWall: { spPr: { fillColor: '#333333' } },
		});
		expect(panels.map((p) => p.fill)).toStrictEqual(['#222222', '#333333', '#111111']);
		for (const panel of panels) {
			expect(panel.kind).toBe('polygon');
			expect(panel.points.split(' ')).toHaveLength(4);
		}
	});

	it('offsets every panel point by offsetX/offsetY', () => {
		const [floor] = buildSurfaceWallPanels(2, 2, 10, 20, 0, 0, {
			floor: { spPr: { fillColor: '#111111' } },
		});
		const [floorOffset] = buildSurfaceWallPanels(2, 2, 10, 20, 100, 50, {
			floor: { spPr: { fillColor: '#111111' } },
		});
		const first = floor.points.split(' ')[0].split(',').map(Number);
		const firstOffset = floorOffset.points.split(' ')[0].split(',').map(Number);
		expect(firstOffset[0]).toBeCloseTo(first[0] + 100);
		expect(firstOffset[1]).toBeCloseTo(first[1] + 50);
	});
});
