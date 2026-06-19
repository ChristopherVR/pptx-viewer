import { describe, expect, it } from 'vitest';

import {
	alignElements,
	computeAlign,
	computeDistribute,
	distributeElements,
} from './element-align';
import type { AlignBox, BoundingBoxElement } from './element-align';

function box(id: string, x: number, y: number, width = 100, height = 50): BoundingBoxElement {
	return { id, x, y, width, height };
}

describe('alignElements', () => {
	it('returns an empty map for fewer than two elements', () => {
		expect(alignElements([], 'left').size).toBe(0);
		expect(alignElements([box('a', 10, 10)], 'left').size).toBe(0);
	});

	it('align-left sets all x to the minimum x', () => {
		const els = [box('a', 50, 0), box('b', 10, 0), box('c', 80, 0)];
		const map = alignElements(els, 'left');
		expect(map.get('a')).toStrictEqual({ x: 10 });
		expect(map.get('b')).toStrictEqual({ x: 10 });
		expect(map.get('c')).toStrictEqual({ x: 10 });
	});

	it('align-right sets all right edges to the maximum right edge', () => {
		// widths differ to prove it aligns the right edge, not x.
		const els = [box('a', 0, 0, 100), box('b', 0, 0, 40)];
		const map = alignElements(els, 'right'); // maxX = 100
		expect(map.get('a')).toStrictEqual({ x: 0 });
		expect(map.get('b')).toStrictEqual({ x: 60 });
	});

	it('align-centerH centres each element on the selection mid-line', () => {
		const els = [box('a', 0, 0, 100), box('b', 0, 0, 40)];
		const map = alignElements(els, 'centerH'); // minX 0, maxX 100, center 50
		expect(map.get('a')).toStrictEqual({ x: 0 });
		expect(map.get('b')).toStrictEqual({ x: 30 });
	});

	it('align-top sets all y to the minimum y', () => {
		const els = [box('a', 0, 30), box('b', 0, 5), box('c', 0, 80)];
		const map = alignElements(els, 'top');
		expect(map.get('a')).toStrictEqual({ y: 5 });
		expect(map.get('b')).toStrictEqual({ y: 5 });
		expect(map.get('c')).toStrictEqual({ y: 5 });
	});

	it('align-bottom sets all bottom edges to the maximum bottom edge', () => {
		const els = [box('a', 0, 0, 100, 50), box('b', 0, 0, 100, 20)];
		const map = alignElements(els, 'bottom'); // maxY = 50
		expect(map.get('a')).toStrictEqual({ y: 0 });
		expect(map.get('b')).toStrictEqual({ y: 30 });
	});

	it('align-middle centres each element on the selection mid-line', () => {
		const els = [box('a', 0, 0, 100, 100), box('b', 0, 0, 100, 40)];
		const map = alignElements(els, 'middle'); // minY 0 maxY 100 center 50
		expect(map.get('a')).toStrictEqual({ y: 0 });
		expect(map.get('b')).toStrictEqual({ y: 30 });
	});
});

describe('distributeElements', () => {
	it('returns an empty map for fewer than three elements', () => {
		expect(distributeElements([], 'horizontal').size).toBe(0);
		expect(distributeElements([box('a', 0, 0), box('b', 100, 0)], 'horizontal').size).toBe(0);
	});

	it('distributes horizontally with even gaps, pinning the outer two', () => {
		// three 100-wide boxes spanning x=0..400 => free space 100, two gaps of 50.
		const els = [box('a', 0, 0, 100), box('c', 300, 0, 100), box('b', 120, 0, 100)];
		const map = distributeElements(els, 'horizontal');
		expect(map.get('a')).toStrictEqual({ x: 0 }); // outer pinned
		expect(map.get('b')).toStrictEqual({ x: 150 }); // 100 + 50 gap
		expect(map.get('c')).toStrictEqual({ x: 300 }); // outer pinned
	});

	it('distributes vertically with even gaps, pinning the outer two', () => {
		const els = [box('a', 0, 0, 100, 50), box('c', 0, 300, 100, 50), box('b', 0, 90, 100, 50)];
		const map = distributeElements(els, 'vertical');
		// span 0..350 = 350, total size 150, free 200, two gaps of 100.
		expect(map.get('a')).toStrictEqual({ y: 0 });
		expect(map.get('b')).toStrictEqual({ y: 150 }); // 50 + 100 gap
		expect(map.get('c')).toStrictEqual({ y: 300 });
	});

	it('produces equal gaps for unequal element sizes', () => {
		const els = [box('a', 0, 0, 50), box('b', 200, 0, 30), box('c', 400, 0, 70)];
		const map = distributeElements(els, 'horizontal');
		// span 0..470 = 470, total 150, free 320, gap 160.
		const ax = map.get('a')!.x!;
		const bx = map.get('b')!.x!;
		const cx = map.get('c')!.x!;
		const gap1 = bx - (ax + 50);
		const gap2 = cx - (bx + 30);
		expect(gap1).toBeCloseTo(gap2);
		expect(ax).toBe(0);
		expect(cx).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// computeAlign / computeDistribute — skip-unchanged variants (Angular surface)
// ---------------------------------------------------------------------------

const threeBoxes: readonly AlignBox[] = [
	{ id: 'a', x: 0, y: 0, width: 50, height: 30 },
	{ id: 'b', x: 100, y: 50, width: 60, height: 40 },
	{ id: 'c', x: 200, y: 110, width: 40, height: 20 },
];

const twoBoxes: readonly AlignBox[] = [
	{ id: 'a', x: 10, y: 20, width: 80, height: 60 },
	{ id: 'b', x: 150, y: 90, width: 100, height: 40 },
];

const oneBox: readonly AlignBox[] = [{ id: 'a', x: 5, y: 5, width: 50, height: 50 }];

describe('computeAlign — guards and skip-unchanged', () => {
	it('returns an empty map for fewer than two boxes', () => {
		expect(computeAlign([], 'left').size).toBe(0);
		expect(computeAlign(oneBox, 'left').size).toBe(0);
	});

	it('omits boxes already on the target edge (left)', () => {
		const map = computeAlign(twoBoxes, 'left');
		expect(map.get('a')).toBeUndefined();
		expect(map.get('b')).toStrictEqual({ x: 10 });
	});

	it('aligns to group right, omitting the box already at the right edge', () => {
		const map = computeAlign(twoBoxes, 'right');
		expect(map.get('a')).toStrictEqual({ x: 170 });
		expect(map.get('b')).toBeUndefined();
	});

	it('centres boxes on the group horizontal centre', () => {
		const map = computeAlign(threeBoxes, 'centerH');
		expect(map.get('a')).toStrictEqual({ x: 95 });
		expect(map.get('b')).toStrictEqual({ x: 90 });
		expect(map.get('c')).toStrictEqual({ x: 100 });
	});

	it('aligns to bottom, omitting the box already at the bottom edge', () => {
		const map = computeAlign(threeBoxes, 'bottom');
		expect(map.get('a')).toStrictEqual({ y: 100 });
		expect(map.get('b')).toStrictEqual({ y: 90 });
		expect(map.get('c')).toBeUndefined();
	});

	it('left mode never sets y', () => {
		for (const [, pos] of computeAlign(threeBoxes, 'left')) {
			expect(pos).not.toHaveProperty('y');
		}
	});
});

describe('computeDistribute — guards and skip-unchanged', () => {
	it('returns an empty map for fewer than three boxes', () => {
		expect(computeDistribute([], 'horizontal').size).toBe(0);
		expect(computeDistribute(twoBoxes, 'horizontal').size).toBe(0);
	});

	it('keeps extremes fixed and equally spaces three equal-width boxes', () => {
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 100, height: 50 },
			{ id: 'b', x: 50, y: 0, width: 100, height: 50 },
			{ id: 'c', x: 300, y: 0, width: 100, height: 50 },
		];
		const map = computeDistribute(boxes, 'horizontal');
		expect(map.get('a')).toBeUndefined();
		expect(map.get('b')).toStrictEqual({ x: 150 });
		expect(map.get('c')).toBeUndefined();
	});

	it('distributes vertically, keeping the extremes fixed', () => {
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 50 },
			{ id: 'b', x: 0, y: 30, width: 50, height: 50 },
			{ id: 'c', x: 0, y: 200, width: 50, height: 50 },
		];
		const map = computeDistribute(boxes, 'vertical');
		expect(map.get('a')).toBeUndefined();
		expect(map.get('b')).toStrictEqual({ y: 100 });
		expect(map.get('c')).toBeUndefined();
	});

	it('horizontal distribute never sets y', () => {
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 30 },
			{ id: 'b', x: 70, y: 0, width: 50, height: 30 },
			{ id: 'c', x: 200, y: 0, width: 50, height: 30 },
		];
		for (const [, pos] of computeDistribute(boxes, 'horizontal')) {
			expect(pos).not.toHaveProperty('y');
		}
	});
});
