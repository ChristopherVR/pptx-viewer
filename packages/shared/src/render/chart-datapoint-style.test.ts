import { describe, it, expect } from 'vitest';

import {
	findDataPoint,
	resolveDataPointExplosion,
	resolveDataPointFill,
} from './chart-datapoint-style';

describe('chart-datapoint-style', () => {
	const series = {
		color: '#4472C4',
		explosion: 5,
		dataPoints: [
			{ idx: 1, spPr: { fillColor: '#FF0000' }, explosion: 30 },
			{ idx: 3, explosion: 0 },
		],
	};

	it('finds a data point by idx', () => {
		expect(findDataPoint(series, 1)?.spPr?.fillColor).toBe('#FF0000');
		expect(findDataPoint(series, 2)).toBeUndefined();
	});

	it('resolves per-point fill over the series colour', () => {
		expect(resolveDataPointFill(series, 1)).toBe('#FF0000');
	});

	it('falls back to series colour when no per-point fill', () => {
		expect(resolveDataPointFill(series, 0)).toBe('#4472C4');
	});

	it('falls back to the supplied fallback when nothing is set', () => {
		expect(resolveDataPointFill({}, 0, '#00FF00')).toBe('#00FF00');
		expect(resolveDataPointFill({}, 0)).toBeUndefined();
	});

	it('resolves per-point explosion over the series default', () => {
		expect(resolveDataPointExplosion(series, 1)).toBe(30);
	});

	it('uses the series explosion when no per-point override', () => {
		expect(resolveDataPointExplosion(series, 2)).toBe(5);
	});

	it('honours an explicit zero per-point explosion', () => {
		expect(resolveDataPointExplosion(series, 3)).toBe(0);
	});

	it('defaults to 0 when nothing is set', () => {
		expect(resolveDataPointExplosion({}, 0)).toBe(0);
	});
});
