/**
 * Unit tests for ink-renderer pure helpers.
 *
 * All assertions target functions exported from `ink-renderer-helpers.ts`
 * (the Angular-free layer). No TestBed or DOM involved, following the same
 * pattern as `connector-renderer.component.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_STROKE_COLOR } from './constants';
import {
	buildInkStrokes,
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	interpolateWidth,
	inkViewBox,
	pressuresToWidths,
} from './ink-renderer-helpers';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ink(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'ink',
		id: 'ink 1',
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		inkPaths: ['M0 0 L10 10', 'M20 20 L30 30'],
		inkColors: ['#ff0000', '#00ff00'],
		inkWidths: [2, 4],
		inkOpacities: [1, 0.5],
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// buildInkStrokes
// ---------------------------------------------------------------------------

describe('buildInkStrokes', () => {
	it('returns one InkStroke per path with resolved colour/width/opacity', () => {
		const strokes = buildInkStrokes(ink());
		expect(strokes).toHaveLength(2);
		expect(strokes[0].d).toBe('M0 0 L10 10');
		expect(strokes[0].color).toBe('#ff0000');
		expect(strokes[0].width).toBe(2);
		expect(strokes[0].opacity).toBe(1);
		expect(strokes[1].color).toBe('#00ff00');
		expect(strokes[1].width).toBe(4);
		expect(strokes[1].opacity).toBe(0.5);
	});

	it('falls back to DEFAULT_STROKE_COLOR when inkColors is absent', () => {
		const strokes = buildInkStrokes(ink({ inkColors: undefined }));
		expect(strokes[0].color).toBe(DEFAULT_STROKE_COLOR);
	});

	it('falls back to width=1 when inkWidths is absent', () => {
		const strokes = buildInkStrokes(ink({ inkWidths: undefined }));
		expect(strokes[0].width).toBe(1);
	});

	it('falls back to opacity=1 when inkOpacities is absent', () => {
		const strokes = buildInkStrokes(ink({ inkOpacities: undefined }));
		expect(strokes[0].opacity).toBe(1);
	});

	it('returns empty array when inkPaths is empty', () => {
		expect(buildInkStrokes(ink({ inkPaths: [] }))).toStrictEqual([]);
	});

	it('returns empty array for non-ink elements', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		expect(buildInkStrokes(shape)).toStrictEqual([]);
	});

	it('leaves circles null for constant-width strokes', () => {
		const strokes = buildInkStrokes(ink({ inkWidths: [2, 2] }));
		expect(strokes[0].circles).toBeNull();
		expect(strokes[1].circles).toBeNull();
	});

	it('emits pressure circles when inkPointPressures varies', () => {
		const strokes = buildInkStrokes(
			ink({
				inkPaths: ['M0 0 L10 10 L20 20'],
				inkWidths: [4],
				inkPointPressures: [[0, 0.5, 1]],
			}),
		);
		expect(strokes[0].circles).toBeDefined();
		expect(strokes[0].circles).toHaveLength(3);
		// Radius grows with pressure along the stroke.
		const rs = strokes[0].circles!.map((c) => c.r);
		expect(rs[2]).toBeGreaterThan(rs[0]);
	});

	it('falls back to a varying inkWidths array as per-point widths', () => {
		const strokes = buildInkStrokes(
			ink({
				inkPaths: ['M0 0 L10 10 L20 20'],
				inkWidths: [1, 3, 6],
				inkColors: undefined,
				inkOpacities: undefined,
			}),
		);
		expect(strokes[0].circles).toBeDefined();
		expect(strokes[0].circles).toHaveLength(3);
	});

	it('projects calligraphic nib marks (not circles) when inkPointTiltX/Y carry a genuine lean', () => {
		const strokes = buildInkStrokes(
			ink({
				inkPaths: ['M0 0 L10 0 L20 0'],
				inkWidths: [4],
				inkPointPressures: [[0.1, 0.9, 0.3]],
				inkPointTiltX: [[10, 0, 0]],
				inkPointTiltY: [[0, 20, 0]],
			}),
		);
		expect(strokes[0].circles).toBeNull();
		expect(strokes[0].nibMarks).not.toBeNull();
		expect(strokes[0].nibMarks?.length).toBeGreaterThan(0);
	});

	it('leaves nibMarks null when tilt data is absent', () => {
		const strokes = buildInkStrokes(ink());
		expect(strokes[0].nibMarks).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// inkViewBox
// ---------------------------------------------------------------------------

describe('inkViewBox', () => {
	it('produces "0 0 <w> <h>" for normal dimensions', () => {
		expect(inkViewBox(ink())).toBe('0 0 200 100');
	});

	it('clamps width and height to a minimum of 1', () => {
		expect(inkViewBox(ink({ width: 0, height: 0 }))).toBe('0 0 1 1');
	});

	it('only clamps the zero dimension', () => {
		expect(inkViewBox(ink({ width: 0, height: 50 }))).toBe('0 0 1 50');
	});
});

// ---------------------------------------------------------------------------
// Pressure math
// ---------------------------------------------------------------------------

describe('extractPathPoints', () => {
	it('extracts coordinate pairs from an SVG path', () => {
		expect(extractPathPoints('M0 0 L10 10 L20 30')).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 30 },
		]);
	});

	it('returns an empty array for a path with no numbers', () => {
		expect(extractPathPoints('Z')).toStrictEqual([]);
	});
});

describe('interpolateWidth', () => {
	it('interpolates linearly between samples', () => {
		expect(interpolateWidth([0, 10], 0.5)).toBe(5);
	});

	it('clamps t to [0, 1]', () => {
		expect(interpolateWidth([2, 8], -1)).toBe(2);
		expect(interpolateWidth([2, 8], 5)).toBe(8);
	});

	it('returns the single sample when only one is present', () => {
		expect(interpolateWidth([7], 0.9)).toBe(7);
	});
});

describe('hasPressureVariation', () => {
	it('is false for uniform values', () => {
		expect(hasPressureVariation([3, 3, 3])).toBeFalsy();
	});

	it('is false for a single value', () => {
		expect(hasPressureVariation([3])).toBeFalsy();
	});

	it('is true when values differ', () => {
		expect(hasPressureVariation([1, 2, 3])).toBeTruthy();
	});
});

describe('pressuresToWidths', () => {
	it('maps 0..1 pressure to baseWidth * (minScale..maxScale)', () => {
		expect(pressuresToWidths([0, 1], 10)).toStrictEqual([3, 18]);
	});

	it('clamps out-of-range pressures', () => {
		expect(pressuresToWidths([-1, 2], 10)).toStrictEqual([3, 18]);
	});
});

describe('generatePressureCircles', () => {
	it('returns one circle per point', () => {
		const circles = generatePressureCircles(
			[
				{ x: 0, y: 0 },
				{ x: 5, y: 5 },
			],
			[2, 6],
			4,
		);
		expect(circles).toHaveLength(2);
		expect(circles[0].cx).toBe(0);
		expect(circles[1].cx).toBe(5);
	});

	it('returns an empty array for no points', () => {
		expect(generatePressureCircles([], [1], 2)).toStrictEqual([]);
	});
});
