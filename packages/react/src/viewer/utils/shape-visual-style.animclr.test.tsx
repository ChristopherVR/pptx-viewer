import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { getShapeVisualStyle } from './shape-visual-style';

/**
 * `p:animClr` fill/stroke recolor at the container level: an HTML-box preset
 * shape (e.g. an ellipse) paints its fill as `backgroundColor` and its stroke
 * as `borderColor`. When a colour animation targets fill / stroke, the wrapper
 * relinquishes that static paint so the animated `background-color` /
 * `border-color` keyframes own it. Without the flags the static paint stays.
 */

function ellipseShape(): PptxElement {
	return {
		id: 'ell1',
		type: 'shape',
		shapeType: 'ellipse',
		x: 0,
		y: 0,
		width: 40,
		height: 40,
		shapeStyle: {},
	} as unknown as PptxElement;
}

describe('getShapeVisualStyle p:animClr fill/stroke recolor', () => {
	it('keeps the static container fill/stroke without animation flags', () => {
		const style = getShapeVisualStyle(ellipseShape(), true, '#ff0000', 2, '#0000ff');
		expect(style.backgroundColor).toBeTruthy();
		expect(style.borderColor).toBeTruthy();
	});

	it('drops the static container fill when a fill animation is active', () => {
		const style = getShapeVisualStyle(ellipseShape(), true, '#ff0000', 2, '#0000ff', true, false);
		expect(style.backgroundColor).toBeUndefined();
		expect(style.backgroundImage).toBeUndefined();
		// Stroke untouched when only the fill is animated.
		expect(style.borderColor).toBeTruthy();
	});

	it('drops the static container stroke when a stroke animation is active', () => {
		const style = getShapeVisualStyle(ellipseShape(), true, '#ff0000', 2, '#0000ff', false, true);
		expect(style.borderColor).toBeUndefined();
		// Fill untouched when only the stroke is animated.
		expect(style.backgroundColor).toBeTruthy();
	});
});
