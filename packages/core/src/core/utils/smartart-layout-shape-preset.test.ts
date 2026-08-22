import { describe, expect, it } from 'vitest';

import {
	presetCornerRadiusFraction,
	presetPolygonPoints,
	resolvePresetRenderKind,
} from './smartart-layout-shape-preset';

describe('resolvePresetRenderKind', () => {
	it('falls back to the arranger default when the node has no shape override', () => {
		expect(resolvePresetRenderKind(undefined, 'rect')).toBe('rect');
		expect(resolvePresetRenderKind({}, 'circle')).toBe('circle');
	});

	it('maps ellipse-family presets to circle', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'ellipse' }, 'rect')).toBe('circle');
		expect(resolvePresetRenderKind({ presetGeometry: 'donut' }, 'rect')).toBe('circle');
	});

	it('maps chevron/diamond/trapezoid-family presets to polygon', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'chevron' }, 'rect')).toBe('polygon');
		expect(resolvePresetRenderKind({ presetGeometry: 'diamond' }, 'circle')).toBe('polygon');
		// Real fixture presets (layout4.xml, smartart-chart-table-mix.pptx).
		expect(resolvePresetRenderKind({ presetGeometry: 'trapezoid' }, 'rect')).toBe('polygon');
		expect(resolvePresetRenderKind({ presetGeometry: 'nonIsoscelesTrapezoid' }, 'rect')).toBe(
			'polygon',
		);
	});

	it('maps roundRect-family presets and plain rect to rect', () => {
		// Real fixture preset (layout1.xml, smartart-chart-table-mix.pptx).
		expect(resolvePresetRenderKind({ presetGeometry: 'roundRect' }, 'circle')).toBe('rect');
		expect(resolvePresetRenderKind({ presetGeometry: 'rect' }, 'circle')).toBe('rect');
	});

	it('falls back to the arranger default for an unrecognised preset name', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'gear6' }, 'rect')).toBe('rect');
	});
});

describe('presetCornerRadiusFraction', () => {
	it('returns undefined for a non-roundRect-family preset', () => {
		expect(presetCornerRadiusFraction({ presetGeometry: 'rect' })).toBeUndefined();
		expect(presetCornerRadiusFraction(undefined)).toBeUndefined();
	});

	it('returns the PowerPoint default (0.15) when roundRect carries no adjustment', () => {
		expect(presetCornerRadiusFraction({ presetGeometry: 'roundRect' })).toBe(0.15);
	});

	it('uses the idx=1 adjustment value as the corner radius fraction', () => {
		expect(
			presetCornerRadiusFraction({
				presetGeometry: 'roundRect',
				adjustments: [{ index: 1, value: 0.3 }],
			}),
		).toBe(0.3);
	});

	it('normalises a raw 0..100000 guide-unit adjustment value', () => {
		expect(
			presetCornerRadiusFraction({
				presetGeometry: 'roundRect',
				adjustments: [{ index: 1, value: 25000 }],
			}),
		).toBe(0.25);
	});
});

describe('presetPolygonPoints', () => {
	it('builds a chevron via the shared chevronPoints helper', () => {
		expect(presetPolygonPoints('chevron', 0, 0, 100, 40)).toContain(',');
	});

	it('builds a 4-point trapezoid narrower at the top', () => {
		const points = presetPolygonPoints('trapezoid', 0, 0, 100, 40)
			.split(' ')
			.map((pair) => pair.split(',').map(Number));
		expect(points).toHaveLength(4);
		const topWidth = points[1]![0] - points[0]![0];
		const bottomWidth = points[2]![0] - points[3]![0];
		expect(topWidth).toBeLessThan(bottomWidth);
	});

	it('falls back to a plain rectangle outline for an unrecognised polygon preset', () => {
		expect(presetPolygonPoints('gear6', 0, 0, 10, 10)).toBe('0,0 10,0 10,10 0,10');
		expect(presetPolygonPoints(undefined, 0, 0, 10, 10)).toBe('0,0 10,0 10,10 0,10');
	});

	it('builds a 6-point hexagon', () => {
		expect(presetPolygonPoints('hexagon', 0, 0, 100, 40).split(' ')).toHaveLength(6);
	});
});
