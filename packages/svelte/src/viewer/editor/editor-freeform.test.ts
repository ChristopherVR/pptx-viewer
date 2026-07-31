import { describe, expect, it } from 'vitest';

import { strokeToFreeformShape } from './editor-freeform';

/**
 * `strokeToFreeformShape` tests: the Draw tab's Freeform tool turns a stroke
 * into a closed custom-geometry SHAPE (fillable, outline-styleable, reshapeable)
 * rather than into ink markup, which is the whole reason the tool exists
 * separately from the pen.
 */

const SQUARE = [
	{ x: 10, y: 10 },
	{ x: 30, y: 10 },
	{ x: 30, y: 30 },
	{ x: 10, y: 30 },
];

describe('strokeToFreeformShape', () => {
	it('discards a tap', () => {
		expect(strokeToFreeformShape([{ x: 5, y: 5 }], '#000', 2)).toBeNull();
		expect(strokeToFreeformShape([], '#000', 2)).toBeNull();
	});

	it('produces a custom-geometry shape, not an ink stroke', () => {
		const shape = strokeToFreeformShape(SQUARE, '#ff0000', 3);
		expect(shape?.type).toBe('shape');
		expect(shape?.shapeType).toBe('custom');
		expect(shape?.customGeometryPaths).toHaveLength(1);
	});

	it('pads the box by the stroke width so a thick outline is not clipped', () => {
		const shape = strokeToFreeformShape(SQUARE, '#000000', 4);
		// Raw bounds are 10..30 on both axes; padding is the stroke width.
		expect(shape?.x).toBe(6);
		expect(shape?.y).toBe(6);
		expect(shape?.width).toBe(28);
		expect(shape?.height).toBe(28);
	});

	it('opens with a moveTo, continues with lineTo, and closes the path', () => {
		const segments = strokeToFreeformShape(SQUARE, '#000000', 1)?.customGeometryPaths?.[0].segments;
		expect(segments?.[0].type).toBe('moveTo');
		expect(segments?.slice(1, -1).every((segment) => segment.type === 'lineTo')).toBeTruthy();
		expect(segments?.at(-1)?.type).toBe('close');
	});

	it('leaves a two-point stroke open, since closing a line means nothing', () => {
		const segments = strokeToFreeformShape(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
			],
			'#000000',
			1,
		)?.customGeometryPaths?.[0].segments;
		expect(segments?.map((segment) => segment.type)).toStrictEqual(['moveTo', 'lineTo']);
	});

	it('emits path coordinates in the 100x geometry space, relative to the box', () => {
		const path = strokeToFreeformShape(SQUARE, '#000000', 2)?.customGeometryPaths?.[0];
		const first = path?.segments[0];
		expect(first?.type === 'moveTo' ? first.pt : null).toStrictEqual({ x: 200, y: 200 });
		expect(path?.width).toBe(2400);
		expect(path?.height).toBe(2400);
	});

	it('outlines in the pen colour and leaves the interior unfilled', () => {
		const shape = strokeToFreeformShape(SQUARE, '#00ff00', 5);
		expect(shape?.shapeStyle?.strokeColor).toBe('#00ff00');
		expect(shape?.shapeStyle?.strokeWidth).toBe(5);
		expect(shape?.shapeStyle?.fillColor).toBe('transparent');
	});
});
