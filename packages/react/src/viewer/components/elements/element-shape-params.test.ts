/**
 * A width-only, fill-less `<a:ln>` paints NO outline.
 *
 * The real-world media deck's photos all carry
 * `<a:ln w="12700"><a:miter lim="400000"/></a:ln>` with no fill child and no
 * `<p:style>/<a:lnRef>`, so the line FILL is unspecified. A PowerPoint render
 * of those slides shows the pictures frameless, but React substituted
 * `DEFAULT_STROKE_COLOR` for the missing colour and painted a 1px
 * rgb(31,41,55) frame around every photo that no other binding (and not
 * PowerPoint) drew. `paintedStrokeWidth` (shared) is the single rule now.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { shapeParams } from './element-shape-params';

function picture(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		id: 'pic-1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('shapeParams stroke width', () => {
	it('is 0 for a width-only line with no fill child', () => {
		expect(shapeParams(picture({ strokeWidth: 1.333 })).sw).toBe(0);
	});

	it('keeps the width when the line carries a colour', () => {
		expect(shapeParams(picture({ strokeWidth: 2, strokeColor: '#FF0000' })).sw).toBe(2);
	});

	it('keeps the width when only a gradient/pattern fill mode is present', () => {
		expect(shapeParams(picture({ strokeWidth: 3, strokeFillMode: 'gradient' })).sw).toBe(3);
	});
});
