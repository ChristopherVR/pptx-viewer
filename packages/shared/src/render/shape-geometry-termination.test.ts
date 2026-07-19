import { describe, it, expect } from 'vitest';

import { buildCustomGeometryClipPath, getResolvedShapeClipPathFor } from './shape-geometry';

/**
 * Termination / no-runaway-loop guard for the shape clip-path helpers.
 *
 * The freeform clip-path builder ({@link buildCustomGeometryClipPath}) and the
 * preset clip-path resolver ({@link getResolvedShapeClipPathFor}) run on the hot
 * render path (once per shape per render). These assertions pin that they always
 * TERMINATE quickly, including for degenerate dimensions, extreme adjustment
 * values, and very large / malformed freeform path strings, so a geometry change
 * can never turn a shape render into an unbounded loop or pathological compute.
 */

const PRESETS = [
	'roundRect',
	'rect',
	'ellipse',
	'triangle',
	'diamond',
	'pentagon',
	'hexagon',
	'star5',
	'rightArrow',
	'cloud',
	'heart',
	'can',
	'donut',
	'pie',
	'blockArc',
	'round2DiagRect',
	'wedgeRectCallout',
];

const DEGENERATE_DIMS: Array<[number, number]> = [
	[150, 150],
	[0, 150],
	[150, 0],
	[-10, 150],
	[1, 1],
	[1e9, 1],
	[Number.NaN, 150],
	[Number.POSITIVE_INFINITY, 150],
	[0.0001, 0.0001],
];

const ADJUSTMENTS: Array<Record<string, number> | undefined> = [
	undefined,
	{ adj: 0 },
	{ adj: 50000 },
	{ adj: -99999 },
	{ adj: 1e12 },
	{ adj: Number.NaN },
];

describe('getResolvedShapeClipPathFor termination', () => {
	it('returns quickly for every preset under degenerate dims/adjustments', () => {
		const started = Date.now();
		for (const shape of PRESETS) {
			for (const [w, h] of DEGENERATE_DIMS) {
				for (const adj of ADJUSTMENTS) {
					// Must not throw and must not spin.
					getResolvedShapeClipPathFor(shape, w, h, adj);
				}
			}
		}
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it('produces a border-box path for a normal round-rect', () => {
		const clip = getResolvedShapeClipPathFor('roundRect', 150, 150, undefined);
		expect(clip).toBeTypeOf('string');
		expect(clip).toMatch(/^(path|inset|polygon)\(/);
	});
});

describe('buildCustomGeometryClipPath termination', () => {
	it('handles large and malformed freeform paths quickly', () => {
		const cases = [
			'M0 0 L10 10 Z',
			'A'.repeat(2000),
			`M0 0${' L1 1'.repeat(100_000)}`,
			'z'.repeat(50_000),
			`M0,0${'C1 2 3 4 5 6'.repeat(20_000)}`,
			'M0 0 A 25 25 0 0 1 25 0 A 25 25 0 0 1 0 25 Z',
			'garbage tokens with no numbers @@@ ###',
		];
		const started = Date.now();
		for (const path of cases) {
			// Must terminate; result may be a path() string or undefined.
			buildCustomGeometryClipPath(path, 100, 100, 200, 200);
		}
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it('rescales a simple freeform into the element box', () => {
		const clip = buildCustomGeometryClipPath('M0 0 L100 0 L100 100 L0 100 Z', 100, 100, 200, 50);
		expect(clip).toBe("path('M 0 0 L 200 0 L 200 50 L 0 50 Z')");
	});

	it('returns undefined for non-positive dimensions', () => {
		expect(buildCustomGeometryClipPath('M0 0 L10 10 Z', 0, 100, 200, 200)).toBeUndefined();
		expect(buildCustomGeometryClipPath('M0 0 L10 10 Z', 100, 100, -5, 200)).toBeUndefined();
		expect(buildCustomGeometryClipPath('M0 0 L10 10 Z', 100, 100, Number.NaN, 200)).toBeUndefined();
	});
});
