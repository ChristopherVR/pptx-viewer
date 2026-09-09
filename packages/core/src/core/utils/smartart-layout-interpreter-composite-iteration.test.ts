import { describe, expect, it } from 'vitest';

import { resolveIterationRect } from './smartart-layout-interpreter-composite-iteration';
import type { SlotDims } from './smartart-layout-interpreter-composite-slots';

const box = { width: 900, height: 500 };

describe('resolveIterationRect', () => {
	it('iterationCount <= 1 returns the plain resolved rect, unsliced (pre-existing single-instance behaviour)', () => {
		const dims: SlotDims = { w: { px: 300 }, h: { px: 200 } };
		const rect = resolveIterationRect(dims, box, 0, 1);
		expect(rect.width).toBe(300);
		expect(rect.height).toBe(200);
	});

	/**
	 * `nested-target--hier5.pptx`'s `oChild` has no `l`/`t`/`ctrX`/`ctrY` of
	 * its own, only `w`/`h`: every iteration shares the same (wide) container,
	 * sliced evenly along the WIDER axis (horizontal, matching the cached
	 * layout's 3-across row).
	 */
	it('slices evenly along the wider axis when the container is wider than tall', () => {
		const dims: SlotDims = {}; // no l/t/w/h -> resolveSlot fills the whole box
		const first = resolveIterationRect(dims, box, 0, 3);
		const second = resolveIterationRect(dims, box, 1, 3);
		const third = resolveIterationRect(dims, box, 2, 3);
		expect(first).toStrictEqual({ x: 0, y: 0, width: 300, height: 500 });
		expect(second).toStrictEqual({ x: 300, y: 0, width: 300, height: 500 });
		expect(third).toStrictEqual({ x: 600, y: 0, width: 300, height: 500 });
	});

	it('slices evenly along the taller axis when the container is taller than wide', () => {
		const tallBox = { width: 400, height: 900 };
		const dims: SlotDims = {};
		const first = resolveIterationRect(dims, tallBox, 0, 3);
		const second = resolveIterationRect(dims, tallBox, 1, 3);
		expect(first).toStrictEqual({ x: 0, y: 0, width: 400, height: 300 });
		expect(second).toStrictEqual({ x: 0, y: 300, width: 400, height: 300 });
	});

	it('slices are contiguous and cover the full container with no gap or overlap', () => {
		const dims: SlotDims = {};
		const count = 4;
		let coveredWidth = 0;
		for (let i = 0; i < count; i++) {
			const rect = resolveIterationRect(dims, box, i, count);
			expect(rect.x).toBe(coveredWidth);
			coveredWidth += rect.width;
		}
		expect(coveredWidth).toBe(box.width);
	});
});
