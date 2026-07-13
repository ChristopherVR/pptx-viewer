import { describe, expect, it } from 'vitest';

import { moveSelection, resizeSelection, selectionBounds } from './selection-transform';

const boxes = [
	{ id: 'a', x: 10, y: 20, width: 20, height: 10 },
	{ id: 'b', x: 50, y: 40, width: 30, height: 20 },
];

describe('selection transforms', () => {
	it('computes the union selection bounds', () => {
		expect(selectionBounds(boxes)).toStrictEqual({
			x: 10,
			y: 20,
			width: 70,
			height: 40,
			rotation: 0,
		});
		expect(selectionBounds([])).toBeNull();
	});

	it('moves every selected box by the same delta', () => {
		expect(moveSelection(boxes, 5, -10)).toMatchObject([
			{ id: 'a', x: 15, y: 10 },
			{ id: 'b', x: 55, y: 30 },
		]);
	});

	it('resizes boxes proportionally within the collective boundary', () => {
		const result = resizeSelection(
			boxes,
			{ x: 10, y: 20, width: 70, height: 40 },
			{ x: 20, y: 40, width: 140, height: 80 },
		);
		expect(result).toMatchObject([
			{ id: 'a', x: 20, y: 40, width: 40, height: 20 },
			{ id: 'b', x: 100, y: 80, width: 60, height: 40 },
		]);
	});
});
