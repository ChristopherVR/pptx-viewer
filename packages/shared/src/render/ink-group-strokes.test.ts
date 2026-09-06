import type { InkPptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildInkGroupStrokes, inkGroupViewBox } from './ink-group-strokes';

const DEFAULTS = { color: '#000000', width: 1 };

function makeElement(partial: Partial<InkPptxElement>): InkPptxElement {
	return {
		type: 'ink',
		id: 'ink-1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		inkPaths: [],
		...partial,
	};
}

describe('inkGroupViewBox', () => {
	it('builds a viewBox from the element size', () => {
		expect(inkGroupViewBox(makeElement({ width: 100, height: 80 }))).toBe('0 0 100 80');
	});

	it('floors a zero-sized element to 1x1', () => {
		expect(inkGroupViewBox(makeElement({ width: 0, height: 0 }))).toBe('0 0 1 1');
	});
});

describe('buildInkGroupStrokes - plain path', () => {
	it('renders a plain path when neither pressure nor tilt data is present', () => {
		const el = makeElement({ inkPaths: ['M 0 0 L 10 10'], inkColors: ['#111'], inkWidths: [2] });
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.d).toBe('M 0 0 L 10 10');
		expect(view.color).toBe('#111');
		expect(view.width).toBe(2);
		expect(view.circles).toBeNull();
		expect(view.nibMarks).toBeNull();
	});

	it('falls back to the caller-supplied defaults when colour/width are missing', () => {
		const el = makeElement({ inkPaths: ['M 0 0 L 10 10'] });
		const [view] = buildInkGroupStrokes(el, { color: '#fed', width: 5 });
		expect(view.color).toBe('#fed');
		expect(view.width).toBe(5);
	});
});

describe('buildInkGroupStrokes - pressure circles', () => {
	it('renders pressure circles when inkPointPressures genuinely varies', () => {
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0 L 20 0'],
			inkWidths: [2],
			inkPointPressures: [[0.1, 0.9, 0.3]],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.nibMarks).toBeNull();
		expect(view.circles).not.toBeNull();
		expect(view.circles).toHaveLength(3);
	});

	it('treats a uniform (device-default) pressure reading as no real pressure data', () => {
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0'],
			inkWidths: [2],
			inkPointPressures: [[0.5, 0.5]],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.circles).toBeNull();
	});

	it('treats a legacy multi-entry inkWidths array (more entries than there are paths) as per-point widths', () => {
		// ONE path (a single stroke) with a 3-entry `inkWidths`: this is the
		// pre-`inkPointPressures` legacy format, where `inkWidths` itself held
		// one width per sampled POINT rather than one per PATH.
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0 L 20 0'],
			inkWidths: [1, 6, 2],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.circles).not.toBeNull();
	});

	it('does NOT treat a normal one-entry-per-path inkWidths array as legacy per-point data', () => {
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0'],
			inkWidths: [4],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.circles).toBeNull();
	});
});

describe('buildInkGroupStrokes - tilt-driven nib marks', () => {
	it('renders nib marks (not circles) when inkPointTiltX/Y carry a genuine lean', () => {
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0 L 20 0'],
			inkWidths: [3],
			inkPointTiltX: [[10, 0, 0]],
			inkPointTiltY: [[0, 20, 0]],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.circles).toBeNull();
		expect(view.nibMarks).not.toBeNull();
		expect(view.nibMarks).toHaveLength(3);
		// Point 1 (OTy=20, the largest magnitude in the stroke) leans harder
		// than point 0 (OTx=10), so its wide axis exceeds point 0's.
		expect(view.nibMarks?.[1].rPerp).toBeGreaterThan(view.nibMarks?.[0].rPerp ?? Infinity);
	});

	it('degrades to plain-path/pressure behaviour when tilt is absent', () => {
		const el = makeElement({ inkPaths: ['M 0 0 L 10 0'], inkWidths: [2] });
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.nibMarks).toBeNull();
	});

	it('a constant (0, 0) tilt reading still produces nib marks, but degenerates visually to circles (rPerp === rTilt)', () => {
		// The upstream write-time gate (`strokeToInkElement`) is what normally
		// keeps an all-flat reading from ever reaching `inkPointTiltX/Y` at
		// all; this exercises the renderer directly with that (still valid)
		// input and confirms it degrades safely rather than distorting the
		// stroke, matching `generateNibMarks`'s own "zero magnitude -> circle"
		// contract.
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0'],
			inkWidths: [2],
			inkPointTiltX: [[0, 0]],
			inkPointTiltY: [[0, 0]],
		});
		const [view] = buildInkGroupStrokes(el, DEFAULTS);
		expect(view.nibMarks).not.toBeNull();
		expect(view.nibMarks?.every((m) => m.rPerp === m.rTilt)).toBeTruthy();
	});

	it('handles multiple strokes independently by path index', () => {
		const el = makeElement({
			inkPaths: ['M 0 0 L 10 0', 'M 0 5 L 10 5'],
			inkColors: ['#111', '#222'],
			inkWidths: [2, 3],
			inkPointTiltX: [[10, 0], undefined as unknown as number[]],
			inkPointTiltY: [[0, 10], undefined as unknown as number[]],
		});
		const views = buildInkGroupStrokes(el, DEFAULTS);
		expect(views).toHaveLength(2);
		expect(views[0].nibMarks).not.toBeNull();
		expect(views[1].nibMarks).toBeNull();
		expect(views[1].color).toBe('#222');
	});
});
