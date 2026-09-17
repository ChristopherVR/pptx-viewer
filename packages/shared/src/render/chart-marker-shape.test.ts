import { describe, expect, it } from 'vitest';

import { automaticMarkerSymbol, buildMarkerPrimitive } from './chart-marker-shape';

// COM-measured ground truth: a stacked Line-with-Markers chart, 9 series each
// carrying `<c:marker><c:spPr>.../></c:marker>` with no `c:symbol`
// ("automatic"), `SeriesCollection(i).MarkerStyle` read back via
// `PowerPoint.Application` after a real save/reopen round trip resolved
// idx 0..8 to: Diamond, Square, Triangle, X, Star, Circle, Plus, Dot, Dash.
describe('automaticMarkerSymbol', () => {
	const expectedCycle = [
		'diamond',
		'square',
		'triangle',
		'x',
		'star',
		'circle',
		'plus',
		'dot',
		'dash',
	] as const;

	it('matches the COM-measured 9-shape automatic cycle for idx 0..8', () => {
		expectedCycle.forEach((symbol, idx) => {
			expect(automaticMarkerSymbol(idx)).toBe(symbol);
		});
	});

	it('repeats the cycle every 9 series (idx 9 == idx 0)', () => {
		expect(automaticMarkerSymbol(9)).toBe('diamond');
		expect(automaticMarkerSymbol(10)).toBe('square');
		expect(automaticMarkerSymbol(17)).toBe('dash');
		expect(automaticMarkerSymbol(18)).toBe('diamond');
	});

	// Real-world regression: a stacked line chart's two series carried
	// NON-SEQUENTIAL `c:idx` (1 and 2, not 0 and 1) and no `c:symbol`. Real
	// PowerPoint rendered idx 1 as a square marker and idx 2 as a triangle.
	it('resolves the real-world idx 1 / idx 2 pair to square / triangle', () => {
		expect(automaticMarkerSymbol(1)).toBe('square');
		expect(automaticMarkerSymbol(2)).toBe('triangle');
	});

	it('handles a negative index by wrapping into the cycle', () => {
		expect(automaticMarkerSymbol(-1)).toBe(automaticMarkerSymbol(8));
	});
});

describe('buildMarkerPrimitive shape mapping', () => {
	it('draws a square as a rect', () => {
		const marker = buildMarkerPrimitive({
			symbol: 'square',
			size: undefined,
			cx: 10,
			cy: 10,
			fill: '#000',
			defaultRadius: 3,
		});
		expect(marker?.kind).toBe('rect');
	});

	it('draws a triangle as a polygon', () => {
		const marker = buildMarkerPrimitive({
			symbol: 'triangle',
			size: undefined,
			cx: 10,
			cy: 10,
			fill: '#000',
			defaultRadius: 3,
		});
		expect(marker?.kind).toBe('polygon');
	});
});
