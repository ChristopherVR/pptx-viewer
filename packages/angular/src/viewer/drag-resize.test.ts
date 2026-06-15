import { describe, expect, it } from 'vitest';

import { applyMove, applyResize, handleAnchor, handleCursor, RESIZE_HANDLES } from './drag-resize';
import type { Box } from './drag-resize';

const start: Box = { x: 100, y: 100, width: 200, height: 100 };

describe('applyMove', () => {
	it('translates the box, preserving size', () => {
		expect(applyMove(start, 10, -20)).toStrictEqual({ x: 110, y: 80, width: 200, height: 100 });
	});
});

describe('applyResize', () => {
	it('grows from the east handle without moving x', () => {
		expect(applyResize(start, 'e', 30, 0)).toStrictEqual({
			x: 100,
			y: 100,
			width: 230,
			height: 100,
		});
	});

	it('grows from the south handle', () => {
		expect(applyResize(start, 's', 0, 40)).toMatchObject({ height: 140, y: 100 });
	});

	it('drags the west handle, moving x and shrinking width', () => {
		expect(applyResize(start, 'w', 50, 0)).toStrictEqual({
			x: 150,
			y: 100,
			width: 150,
			height: 100,
		});
	});

	it('drags a corner (nw) on both axes', () => {
		expect(applyResize(start, 'nw', 20, 10)).toStrictEqual({
			x: 120,
			y: 110,
			width: 180,
			height: 90,
		});
	});

	it('clamps to the min size keeping the opposite edge fixed (west)', () => {
		// Drag west handle far right → width would go negative; clamp to min,
		// x pinned so the east edge (x=300) stays put.
		const out = applyResize(start, 'w', 500, 0, 8);
		expect(out.width).toBe(8);
		expect(out.x).toBe(292); // 100 + 200 - 8
	});

	it('clamps min height from the north handle', () => {
		const out = applyResize(start, 'n', 0, 500, 8);
		expect(out.height).toBe(8);
		expect(out.y).toBe(192); // 100 + 100 - 8
	});
});

describe('handleAnchor', () => {
	it('maps handles to box fractions', () => {
		expect(handleAnchor('nw')).toStrictEqual({ fx: 0, fy: 0 });
		expect(handleAnchor('se')).toStrictEqual({ fx: 1, fy: 1 });
		expect(handleAnchor('n')).toStrictEqual({ fx: 0.5, fy: 0 });
		expect(handleAnchor('e')).toStrictEqual({ fx: 1, fy: 0.5 });
	});
});

describe('handleCursor', () => {
	it('returns axis-appropriate cursors', () => {
		expect(handleCursor('n')).toBe('ns-resize');
		expect(handleCursor('e')).toBe('ew-resize');
		expect(handleCursor('nw')).toBe('nwse-resize');
		expect(handleCursor('ne')).toBe('nesw-resize');
	});
});

describe('rESIZE_HANDLES', () => {
	it('has the eight handles', () => {
		expect(RESIZE_HANDLES).toHaveLength(8);
	});
});
