import { describe, expect, it } from 'vitest';

import { buildPieDataLabels, isOutsidePosition } from './chart-pie-labels';
import type { PieSliceGeometry } from './chart-view-model';

const slices: PieSliceGeometry[] = [
	{ d: 'M0,0', midAngle: 0, labelX: 170, labelY: 100 },
	{ d: 'M0,0', midAngle: Math.PI, labelX: 30, labelY: 100 },
];
const values = [60, 40];
const geom = { cx: 100, cy: 100, outerR: 80 };

describe('isOutsidePosition', () => {
	it('treats outEnd and bestFit as outside', () => {
		expect(isOutsidePosition('outEnd')).toBeTruthy();
		expect(isOutsidePosition('bestFit')).toBeTruthy();
	});

	it('treats ctr / inEnd / undefined as inside', () => {
		expect(isOutsidePosition('ctr')).toBeFalsy();
		expect(isOutsidePosition('inEnd')).toBeFalsy();
		expect(isOutsidePosition(undefined)).toBeFalsy();
	});
});

describe('buildPieDataLabels', () => {
	it('places inside labels at the slice centroid with no leader lines', () => {
		const result = buildPieDataLabels({ slices, values, ...geom, position: 'ctr' });
		expect(result.labels).toHaveLength(2);
		expect(result.leaderLines).toHaveLength(0);
		expect(result.labels[0].x).toBe(170);
		expect(result.labels[0].fill).toBe('#ffffff');
	});

	it('places outside labels beyond the rim with leader lines', () => {
		const result = buildPieDataLabels({ slices, values, ...geom, position: 'outEnd' });
		expect(result.labels).toHaveLength(2);
		expect(result.leaderLines).toHaveLength(2);
		// slice 0 points right (midAngle 0): label to the right of the rim, start anchor.
		expect(result.labels[0].x).toBeGreaterThan(geom.cx + geom.outerR);
		expect(result.labels[0].textAnchor).toBe('start');
		// slice 1 points left (midAngle PI): end anchor.
		expect(result.labels[1].textAnchor).toBe('end');
	});

	it('suppresses leader lines when showLeaderLines is false', () => {
		const result = buildPieDataLabels({
			slices,
			values,
			...geom,
			position: 'outEnd',
			showLeaderLines: false,
		});
		expect(result.leaderLines).toHaveLength(0);
	});

	it('skips slices with an undefined value', () => {
		const result = buildPieDataLabels({ slices, values: [60], ...geom, position: 'ctr' });
		expect(result.labels).toHaveLength(1);
	});
});
