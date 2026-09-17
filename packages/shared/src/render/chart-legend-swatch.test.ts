import { describe, expect, it } from 'vitest';

import { buildLineLegendSwatch, resolveLegendSwatchKind } from './chart-legend-swatch';

describe('resolveLegendSwatchKind', () => {
	it('gives line/scatter a line-style swatch', () => {
		expect(resolveLegendSwatchKind('line')).toBe('line');
		expect(resolveLegendSwatchKind('scatter')).toBe('line');
	});

	it('keeps every other kind on the default filled-rect swatch', () => {
		expect(resolveLegendSwatchKind('bar')).toBe('rect');
		expect(resolveLegendSwatchKind('area')).toBe('rect');
		expect(resolveLegendSwatchKind('pie')).toBe('rect');
		expect(resolveLegendSwatchKind('radar')).toBe('rect');
		expect(resolveLegendSwatchKind('bubble')).toBe('rect');
	});
});

describe('buildLineLegendSwatch', () => {
	it('draws a line primitive and a marker primitive by default', () => {
		const swatch = buildLineLegendSwatch({}, '#00B0F0');
		expect(swatch.primitives.some((p) => p.kind === 'line')).toBeTruthy();
		// No `c:symbol` authored -> the marker default, a filled circle (matches
		// the plotted data-point marker's own default, see chart-marker-shape.ts).
		expect(swatch.primitives.some((p) => p.kind === 'circle')).toBeTruthy();
	});

	it('colours the line and default marker with the resolved series colour', () => {
		const swatch = buildLineLegendSwatch({}, '#00B0F0');
		// eslint-disable-next-line one-var -- pre-existing pattern in this suite
		const line = swatch.primitives.find((p) => p.kind === 'line'),
			circle = swatch.primitives.find((p) => p.kind === 'circle');
		expect(line?.kind === 'line' && line.stroke).toBe('#00B0F0');
		expect(circle?.kind === 'circle' && circle.fill).toBe('#00B0F0');
	});

	it('suppresses the line primitive for a marker-only series (c:ser/a:ln/a:noFill)', () => {
		const swatch = buildLineLegendSwatch({ lineNoFill: true }, '#404040');
		expect(swatch.primitives.some((p) => p.kind === 'line')).toBeFalsy();
		// The marker sample still draws: PowerPoint's marker-only scatter legend
		// still shows the point symbol, just no connecting line.
		expect(swatch.primitives.some((p) => p.kind === 'circle')).toBeTruthy();
	});

	it('omits the marker entirely when the resolved symbol is none', () => {
		const swatch = buildLineLegendSwatch({ marker: { symbol: 'none' } }, '#00B0F0');
		expect(swatch.primitives.some((p) => p.kind !== 'line')).toBeFalsy();
	});

	it('draws the SERIES marker shape, never a c:dPt override', () => {
		const swatch = buildLineLegendSwatch(
			{
				marker: { symbol: 'square' },
				dataPoints: [{ idx: 0, marker: { symbol: 'star' } }],
			},
			'#00B0F0',
		);
		// square -> a rect primitive, not a 10-point star polygon.
		expect(swatch.primitives.some((p) => p.kind === 'rect')).toBeTruthy();
		expect(swatch.primitives.some((p) => p.kind === 'polygon')).toBeFalsy();
	});

	it('prefers the marker fill over the resolved series colour', () => {
		const swatch = buildLineLegendSwatch(
			{ marker: { symbol: 'square', spPr: { fillColor: '#FF0000' } } },
			'#00B0F0',
		);
		// eslint-disable-next-line one-var -- pre-existing pattern in this suite
		const rect = swatch.primitives.find((p) => p.kind === 'rect');
		expect(rect?.kind === 'rect' && rect.fill).toBe('#FF0000');
	});
});
