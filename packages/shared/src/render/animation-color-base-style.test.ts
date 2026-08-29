import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getAnimationColorBaseStyle } from './animation-color-base-style';

function paintedShape(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeStyle: {
			fillColor: '#ff0000',
			strokeColor: '#0000ff',
			strokeWidth: 2,
			lineAlignment: 'in',
		},
		textStyle: { color: '#123456' },
	} as unknown as PptxElement;
}

describe('getAnimationColorBaseStyle', () => {
	it('does not alter ordinary non-animated rendering', () => {
		expect(getAnimationColorBaseStyle(paintedShape())).toStrictEqual({});
	});

	it('captures fill, stroke, and text colour before static paint is suppressed', () => {
		expect(
			getAnimationColorBaseStyle(paintedShape(), {
				animatesFill: true,
				animatesStroke: true,
			}),
		).toStrictEqual({
			'--pptx-animation-color-base': '#123456',
			'--pptx-animation-fill-base': '#ff0000',
			'--pptx-animation-stroke-base': '#0000ff',
		});
	});
});
