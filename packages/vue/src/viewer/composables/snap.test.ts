import { describe, expect, it } from 'vitest';

import { snapBox, snapValue } from './snap';

describe('snapValue', () => {
	it('rounds to the nearest grid multiple', () => {
		expect(snapValue(0, 8)).toBe(0);
		expect(snapValue(3, 8)).toBe(0);
		expect(snapValue(5, 8)).toBe(8);
		expect(snapValue(23, 8)).toBe(24);
		expect(snapValue(-5, 8)).toBe(-8);
	});
});

describe('snapBox', () => {
	it('snaps position and size to the grid', () => {
		expect(snapBox({ x: 23, y: 17, width: 101, height: 55 }, 8)).toStrictEqual({
			x: 24,
			y: 16,
			width: 104,
			height: 56,
		});
	});

	it('clamps size to at least one grid cell', () => {
		expect(snapBox({ x: 0, y: 0, width: 2, height: 1 }, 8)).toStrictEqual({
			x: 0,
			y: 0,
			width: 8,
			height: 8,
		});
	});
});
