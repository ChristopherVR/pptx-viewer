import { describe, expect, it } from 'vitest';

import { build3DSurfacePanels, primitivesBounds } from './chart-3d-surfaces';
import type { SvgPolyline, SvgRect } from './chart-view-model';

describe('primitivesBounds', () => {
	it('returns undefined for an empty primitive list', () => {
		expect(primitivesBounds([])).toBeUndefined();
	});

	it('bounds a single rect', () => {
		const rect: SvgRect = { kind: 'rect', x: 10, y: 20, w: 30, h: 40, fill: '#000' };
		expect(primitivesBounds([rect])).toStrictEqual({ minX: 10, maxX: 40, minY: 20, maxY: 60 });
	});

	it('bounds a polyline by parsing its points string', () => {
		const line: SvgPolyline = {
			kind: 'polyline',
			points: '0,10 20,-5 5,30',
			stroke: '#000',
			strokeWidth: 1,
			fill: 'none',
		};
		expect(primitivesBounds([line])).toStrictEqual({ minX: 0, maxX: 20, minY: -5, maxY: 30 });
	});

	it('ignores primitive kinds with no plottable extent (text)', () => {
		expect(
			primitivesBounds([
				{
					kind: 'text',
					x: 5,
					y: 5,
					text: 'x',
					fontSize: 10,
					fill: '#000',
					textAnchor: 'start',
				},
			]),
		).toBeUndefined();
	});
});

describe('build3DSurfacePanels', () => {
	const bars: SvgRect[] = [
		{ kind: 'rect', x: 10, y: 20, w: 20, h: 60, fill: '#4472C4' },
		{ kind: 'rect', x: 40, y: 40, w: 20, h: 40, fill: '#4472C4' },
	];
	const depth = { dx: 12, dy: -8, magnitude: 14 };

	it('returns no panels when no surface has a fill colour', () => {
		expect(build3DSurfacePanels(bars, {}, depth)).toStrictEqual([]);
	});

	it('returns no panels when there is no plottable geometry', () => {
		expect(
			build3DSurfacePanels([], { floor: { spPr: { fillColor: '#CCCCCC' } } }, depth),
		).toStrictEqual([]);
	});

	it('builds one panel per authored surface, floor last', () => {
		const panels = build3DSurfacePanels(
			bars,
			{
				floor: { spPr: { fillColor: '#111111' } },
				backWall: { spPr: { fillColor: '#222222' } },
				sideWall: { spPr: { fillColor: '#333333' } },
			},
			depth,
		);
		expect(panels).toHaveLength(3);
		expect(panels.map((p) => p.fill)).toStrictEqual(['#222222', '#111111', '#333333']);
		for (const panel of panels) {
			expect(panel.kind).toBe('polygon');
		}
	});

	it('carries authored stroke colour/width through, defaulting to no stroke', () => {
		const [withStroke] = build3DSurfacePanels(
			bars,
			{ backWall: { spPr: { fillColor: '#222222', strokeColor: '#000000', strokeWidth: 2 } } },
			depth,
		);
		expect(withStroke.stroke).toBe('#000000');
		expect(withStroke.strokeWidth).toBe(2);

		const [noStroke] = build3DSurfacePanels(
			bars,
			{ floor: { spPr: { fillColor: '#111111' } } },
			depth,
		);
		expect(noStroke.stroke).toBe('none');
		expect(noStroke.strokeWidth).toBe(0);
	});
});
