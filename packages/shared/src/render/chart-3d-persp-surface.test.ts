import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSurfaceGeometry, surfaceBands, surfaceRowZ } from './chart-3d-persp-surface';

const layout = {
	view: { box: { w: 1, h: 0.36, d: 0.75 } } as never,
	range: { min: 0, max: 5, majorUnit: 1 },
	valueScale: 0.36 / 5,
	categoryX: [0, 0.5, 1],
};

function chart(extra: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'surface',
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'S1', values: [0.5, 2.5, 4.5] },
			{ name: 'S2', values: [1.5, 3.5, 4.5] },
		],
		...extra,
	} as PptxChartData;
}

describe('surface bands', () => {
	it('makes one band per major unit, from c:bandFmts or the palette cycle', () => {
		const bands = surfaceBands(
			chart({ bandFmts: [{ index: 1, spPr: { fillColor: '#123456' } }] }),
			layout.range,
			['#AA0000', '#00AA00'],
		);
		expect(bands.map((b) => b.label)).toStrictEqual(['0-1', '1-2', '2-3', '3-4', '4-5']);
		expect(bands[0].color).toBe('#AA0000');
		expect(bands[1].color).toBe('#123456');
		// The second trip round the palette is darker.
		expect(bands[2].color).not.toBe('#AA0000');
	});

	it('clips every triangle into the bands it crosses, each piece inside its band', () => {
		const geo = buildSurfaceGeometry(chart(), layout, ['#AA0000']);
		expect(geo.triangles.length).toBeGreaterThan(4);
		for (const tri of geo.triangles) {
			for (const p of tri.points) {
				const lo = tri.band * layout.valueScale - 1e-9;
				const hi = (tri.band + 1) * layout.valueScale + 1e-9;
				expect(p[1]).toBeGreaterThanOrEqual(lo);
				expect(p[1]).toBeLessThanOrEqual(hi);
			}
		}
		expect(new Set(geo.triangles.map((t) => t.band)).size).toBe(5);
	});

	it('runs series 1 along the front and the last series on the back wall', () => {
		expect(surfaceRowZ(layout, 0, 3)).toBe(0);
		expect(surfaceRowZ(layout, 2, 3)).toBe(0.75);
	});

	it('draws a wireframe as band-coloured lines, no fills', () => {
		const geo = buildSurfaceGeometry(chart({ wireframe: true }), layout, ['#AA0000']);
		expect(geo.triangles).toHaveLength(0);
		expect(geo.segments.length).toBeGreaterThan(0);
		for (const seg of geo.segments) {
			expect(seg.band).toBeGreaterThanOrEqual(0);
			expect(seg.band).toBeLessThan(5);
		}
	});
});
