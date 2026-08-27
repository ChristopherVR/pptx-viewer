import type { ContentPartInkStroke, ContentPartPptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildContentPartStrokes, contentPartViewBox } from './content-part-strokes';

function makeElement(strokes: ContentPartInkStroke[]): ContentPartPptxElement {
	return {
		type: 'contentPart',
		id: 'cp-1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		inkStrokes: strokes,
	};
}

describe('contentPartViewBox', () => {
	it('should build a viewBox from the element size', () => {
		expect(contentPartViewBox(makeElement([]))).toBe('0 0 100 80');
	});

	it('should floor a zero-sized element to 1x1', () => {
		const el = makeElement([]);
		el.width = 0;
		el.height = 0;
		expect(contentPartViewBox(el)).toBe('0 0 1 1');
	});
});

describe('buildContentPartStrokes - plain path (no pressure, no tilt)', () => {
	it('should render a plain path when neither pressure nor tilt data is present', () => {
		const el = makeElement([{ path: 'M 0 0 L 10 10', color: '#000', width: 2, opacity: 1 }]);
		const [view] = buildContentPartStrokes(el);
		expect(view.d).toBe('M 0 0 L 10 10');
		expect(view.circles).toBeNull();
		expect(view.nibMarks).toBeNull();
	});
});

describe('buildContentPartStrokes - pressure circles (no tilt)', () => {
	it('should render pressure circles when pressures vary and no tilt data is present', () => {
		const el = makeElement([
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#000',
				width: 2,
				opacity: 1,
				pressures: [0.1, 0.9, 0.3],
			},
		]);
		const [view] = buildContentPartStrokes(el);
		expect(view.nibMarks).toBeNull();
		expect(view.circles).not.toBeNull();
		expect(view.circles).toHaveLength(3);
	});
});

describe('buildContentPartStrokes - tilt-driven nib marks', () => {
	it('should render nib marks (not circles) when tiltAngles is present', () => {
		const el = makeElement([
			{
				path: 'M 0 0 L 10 0',
				color: '#123456',
				width: 3,
				opacity: 0.9,
				tiltAngles: [0, Math.PI / 2],
				tiltMagnitudes: [0.2, 0.9],
			},
		]);
		const [view] = buildContentPartStrokes(el);
		expect(view.circles).toBeNull();
		expect(view.nibMarks).not.toBeNull();
		expect(view.nibMarks).toHaveLength(2);
		// Second point leans harder => its wide axis should exceed the first's.
		expect(view.nibMarks?.[1].rPerp).toBeGreaterThan(view.nibMarks?.[0].rPerp ?? Infinity);
	});

	it('should take tilt priority over pressure data when both are present', () => {
		const el = makeElement([
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#000',
				width: 2,
				opacity: 1,
				pressures: [0.1, 0.9, 0.3],
				tiltAngles: [0, 0, 0],
				tiltMagnitudes: [0.5, 0.5, 0.5],
			},
		]);
		const [view] = buildContentPartStrokes(el);
		expect(view.circles).toBeNull();
		expect(view.nibMarks).not.toBeNull();
	});

	it('should default missing tiltMagnitudes to a moderate constant lean', () => {
		const el = makeElement([
			{
				path: 'M 0 0 L 10 0',
				color: '#000',
				width: 2,
				opacity: 1,
				tiltAngles: [0, 0],
			},
		]);
		const [view] = buildContentPartStrokes(el);
		expect(view.nibMarks).not.toBeNull();
		expect(view.nibMarks?.every((m) => m.rPerp > m.rTilt)).toBeTruthy();
	});

	it('should gracefully degrade to the plain-path behaviour when tiltAngles is absent', () => {
		const withTilt = makeElement([
			{
				path: 'M 0 0 L 10 0',
				color: '#000',
				width: 2,
				opacity: 1,
				tiltAngles: [],
				tiltMagnitudes: [],
			},
		]);
		const [view] = buildContentPartStrokes(withTilt);
		// An empty tiltAngles array is treated the same as absent: no nib marks.
		expect(view.nibMarks).toBeNull();
		expect(view.circles).toBeNull();
	});
});
