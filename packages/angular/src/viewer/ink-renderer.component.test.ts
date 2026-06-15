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
import { buildInkStrokes, inkViewBox } from './ink-renderer-helpers';

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
