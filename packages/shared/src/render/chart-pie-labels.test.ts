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

	it('uses the default grey leader-line stroke when no leaderLineStyle is given', () => {
		const result = buildPieDataLabels({ slices, values, ...geom, position: 'outEnd' });
		expect(result.leaderLines[0].stroke).toBe('#94a3b8');
	});

	// Data-label leaderLineStyle, resolved from c:dLbls/c:leaderLines/c:spPr or
	// its chart15-extension mirror (chart-data-label-parser.ts), confirmed
	// against real corpus markup (issue-132-gradient-fill.pptx /
	// issue-132-hr-deck.pptx: a themed grey `a:schemeClr tx1 lumMod/lumOff`
	// resolved to a hex string by core before it reaches this renderer).
	it('uses the authored leaderLineStyle stroke colour when given', () => {
		const result = buildPieDataLabels({
			slices,
			values,
			...geom,
			position: 'outEnd',
			leaderLineStyle: { strokeColor: '#a6a6a6' },
		});
		expect(result.leaderLines).toHaveLength(2);
		expect(result.leaderLines[0].stroke).toBe('#a6a6a6');
		expect(result.leaderLines[1].stroke).toBe('#a6a6a6');
	});

	it('skips slices with an undefined value', () => {
		const result = buildPieDataLabels({ slices, values: [60], ...geom, position: 'ctr' });
		expect(result.labels).toHaveLength(1);
	});

	// Limitations.md "Pie/doughnut manual-layout label offset" (c:dLbl/c:layout).
	describe('manual layout offset (per-point c:dLbl/c:layout)', () => {
		const frame = { width: 200, height: 200 };

		it('shifts an inside label by its per-point manual layout (factor mode)', () => {
			const result = buildPieDataLabels({
				slices,
				values,
				...geom,
				position: 'ctr',
				frame,
				svgWidth: 200,
				svgHeight: 200,
				layoutFor: (pointIndex) => (pointIndex === 0 ? { x: 0.1, y: -0.05 } : undefined),
			});
			// slice 0's auto centroid is (170, 100); factor mode offsets by
			// layout.x/y * frame width/height.
			expect(result.labels[0].x).toBe(170 + 0.1 * 200);
			expect(result.labels[0].y).toBe(100 + -0.05 * 200);
			// slice 1 has no layout override: unaffected.
			expect(result.labels[1].x).toBe(30);
		});

		it('leaves labels unmoved when layoutFor is given but frame is not', () => {
			const result = buildPieDataLabels({
				slices,
				values,
				...geom,
				position: 'ctr',
				layoutFor: () => ({ x: 0.5 }),
			});
			expect(result.labels[0].x).toBe(170);
		});

		it('moves an outside label AND its leader line endpoint together', () => {
			const result = buildPieDataLabels({
				slices,
				values,
				...geom,
				position: 'outEnd',
				frame,
				svgWidth: 200,
				svgHeight: 200,
				layoutFor: (pointIndex) => (pointIndex === 0 ? { x: 0.2, xMode: 'factor' } : undefined),
			});
			const label = result.labels[0];
			const leader = result.leaderLines[0];
			// The leader line's far endpoint must track the moved label, not the
			// original auto position (rim -> unmoved point would be a stale connector).
			expect(leader.x2).toBeCloseTo(label.x - 2, 5);
			expect(leader.y2).toBe(label.y);
		});
	});

	// C2-G1 data-label half: c:dLbl/c:dLbls txPr per-point font override.
	describe('per-point font override (txPr)', () => {
		it('applies fontFamily/fontSize/bold from the resolved label content', () => {
			const result = buildPieDataLabels({
				slices,
				values,
				...geom,
				position: 'ctr',
				labelText: (pointIndex, value) => ({
					text: String(value),
					fontFamily: 'Calibri',
					fontSize: 12,
					bold: true,
				}),
			});
			expect(result.labels[0].fontFamily).toBe('Calibri');
			expect(result.labels[0].fontSize).toBeCloseTo(12 * (4 / 3), 5);
			expect(result.labels[0].fontWeight).toBe('bold');
		});

		it('keeps the fixed default font size when no txPr override resolves', () => {
			const result = buildPieDataLabels({ slices, values, ...geom, position: 'ctr' });
			expect(result.labels[0].fontFamily).toBeUndefined();
		});
	});
});
