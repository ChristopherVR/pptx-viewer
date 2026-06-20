import { describe, expect, it } from 'vitest';

import { computeAlign, computeDistribute } from './align-distribute';
import type { AlignBox } from './align-distribute';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Three non-overlapping boxes arranged left-to-right, top-to-bottom. */
const threeBoxes: readonly AlignBox[] = [
	{ id: 'a', x: 0, y: 0, width: 50, height: 30 },
	{ id: 'b', x: 100, y: 50, width: 60, height: 40 },
	{ id: 'c', x: 200, y: 110, width: 40, height: 20 },
];

/** Two boxes. */
const twoBoxes: readonly AlignBox[] = [
	{ id: 'a', x: 10, y: 20, width: 80, height: 60 },
	{ id: 'b', x: 150, y: 90, width: 100, height: 40 },
];

/** Single box. */
const oneBox: readonly AlignBox[] = [{ id: 'a', x: 5, y: 5, width: 50, height: 50 }];

// ---------------------------------------------------------------------------
// computeAlign: guard: <2 boxes
// ---------------------------------------------------------------------------

describe('computeAlign: fewer than 2 boxes', () => {
	it('returns an empty map for zero boxes', () => {
		expect(computeAlign([], 'left').size).toBe(0);
	});

	it('returns an empty map for one box', () => {
		expect(computeAlign(oneBox, 'left').size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// computeAlign: horizontal modes
// ---------------------------------------------------------------------------

describe('computeAlign: left', () => {
	it('moves all boxes so their left edge equals the group left edge (min x)', () => {
		// group left = 0
		const map = computeAlign(twoBoxes, 'left');
		// box a is already at x=10, group min x = 10, gets moved to 10
		// box b is at x=150, gets moved to 10
		// group min = 10
		expect(map.get('a')).toBeUndefined(); // already at left
		expect(map.get('b')).toStrictEqual({ x: 10 });
	});

	it('aligns three boxes to group left (x=0)', () => {
		const map = computeAlign(threeBoxes, 'left');
		// group left = 0 (box a)
		expect(map.get('a')).toBeUndefined(); // already 0
		expect(map.get('b')).toStrictEqual({ x: 0 });
		expect(map.get('c')).toStrictEqual({ x: 0 });
	});
});

describe('computeAlign: right', () => {
	it('aligns boxes so their right edges meet the group right edge', () => {
		// twoBoxes: right edges are 10+80=90, 150+100=250; group right = 250
		const map = computeAlign(twoBoxes, 'right');
		expect(map.get('a')).toStrictEqual({ x: 250 - 80 }); // 170
		expect(map.get('b')).toBeUndefined(); // already at right edge
	});

	it('aligns three boxes to group right (200+40=240)', () => {
		const map = computeAlign(threeBoxes, 'right');
		expect(map.get('a')).toStrictEqual({ x: 240 - 50 }); // 190
		expect(map.get('b')).toStrictEqual({ x: 240 - 60 }); // 180
		expect(map.get('c')).toBeUndefined(); // already at x=200, right=240
	});
});

describe('computeAlign: centerH', () => {
	it('centres boxes on the group horizontal centre', () => {
		// threeBoxes: left=0, right=240, centre=120
		const map = computeAlign(threeBoxes, 'centerH');
		// box a (w=50): newX = 120 - 25 = 95
		expect(map.get('a')).toStrictEqual({ x: 95 });
		// box b (w=60): newX = 120 - 30 = 90
		expect(map.get('b')).toStrictEqual({ x: 90 });
		// box c (w=40): newX = 120 - 20 = 100
		expect(map.get('c')).toStrictEqual({ x: 100 });
	});
});

// ---------------------------------------------------------------------------
// computeAlign: vertical modes
// ---------------------------------------------------------------------------

describe('computeAlign: top', () => {
	it('moves all boxes to the group top edge (min y)', () => {
		// threeBoxes: min y = 0
		const map = computeAlign(threeBoxes, 'top');
		expect(map.get('a')).toBeUndefined(); // already 0
		expect(map.get('b')).toStrictEqual({ y: 0 });
		expect(map.get('c')).toStrictEqual({ y: 0 });
	});
});

describe('computeAlign: bottom', () => {
	it('aligns boxes so their bottom edges meet the group bottom edge', () => {
		// threeBoxes: bottom edges are 30, 90, 130; group bottom = 130
		const map = computeAlign(threeBoxes, 'bottom');
		expect(map.get('a')).toStrictEqual({ y: 130 - 30 }); // 100
		expect(map.get('b')).toStrictEqual({ y: 130 - 40 }); // 90
		expect(map.get('c')).toBeUndefined(); // already at bottom
	});
});

describe('computeAlign: middle', () => {
	it('centres boxes on the group vertical centre', () => {
		// threeBoxes: top=0, bottom=130, centre=65
		const map = computeAlign(threeBoxes, 'middle');
		// box a (h=30): newY = 65 - 15 = 50
		expect(map.get('a')).toStrictEqual({ y: 50 });
		// box b (h=40): newY = 65 - 20 = 45
		expect(map.get('b')).toStrictEqual({ y: 45 });
		// box c (h=20): newY = 65 - 10 = 55
		expect(map.get('c')).toStrictEqual({ y: 55 });
	});
});

// ---------------------------------------------------------------------------
// computeAlign: only the relevant axis key is returned
// ---------------------------------------------------------------------------

describe('computeAlign: axis isolation', () => {
	it('left mode never sets y', () => {
		for (const [, pos] of computeAlign(threeBoxes, 'left')) {
			expect(pos).not.toHaveProperty('y');
		}
	});

	it('top mode never sets x', () => {
		for (const [, pos] of computeAlign(threeBoxes, 'top')) {
			expect(pos).not.toHaveProperty('x');
		}
	});
});

// ---------------------------------------------------------------------------
// computeDistribute: guard: <3 boxes
// ---------------------------------------------------------------------------

describe('computeDistribute: fewer than 3 boxes', () => {
	it('returns an empty map for zero boxes', () => {
		expect(computeDistribute([], 'horizontal').size).toBe(0);
	});

	it('returns an empty map for one box', () => {
		expect(computeDistribute(oneBox, 'horizontal').size).toBe(0);
	});

	it('returns an empty map for two boxes', () => {
		expect(computeDistribute(twoBoxes, 'horizontal').size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// computeDistribute: horizontal
// ---------------------------------------------------------------------------

describe('computeDistribute: horizontal', () => {
	it('keeps extremes fixed and equally spaces three equal-width boxes', () => {
		// Three boxes, each width=100, gaps to equalise.
		// Initial: a(x=0), b(x=50), c(x=300)
		// span: 0 → 400; total box width = 300; gap space = 100; 2 gaps → 50 each
		// Expected: a stays at 0, b → 150, c stays at 300
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 100, height: 50 },
			{ id: 'b', x: 50, y: 0, width: 100, height: 50 },
			{ id: 'c', x: 300, y: 0, width: 100, height: 50 },
		];

		const map = computeDistribute(boxes, 'horizontal');

		// First box (leftmost) stays.
		expect(map.get('a')).toBeUndefined();
		// Middle box repositioned.
		expect(map.get('b')).toStrictEqual({ x: 150 });
		// Last box (rightmost) stays.
		expect(map.get('c')).toBeUndefined();
	});

	it('produces equal gaps between all adjacent boxes', () => {
		// Boxes of varying widths: use the distributed positions to measure gaps.
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 10 },
			{ id: 'b', x: 20, y: 0, width: 30, height: 10 },
			{ id: 'c', x: 60, y: 0, width: 40, height: 10 },
			{ id: 'd', x: 200, y: 0, width: 60, height: 10 },
		];

		const map = computeDistribute(boxes, 'horizontal');

		// Build final positions by merging original + updates.
		const finalX: Record<string, number> = {};
		const finalW: Record<string, number> = {};
		for (const box of boxes) {
			finalX[box.id] = map.get(box.id)?.x ?? box.x;
			finalW[box.id] = box.width;
		}

		// Sort by final x.
		const ids = ['a', 'b', 'c', 'd'].sort((p, q) => finalX[p] - finalX[q]);
		const gaps: number[] = [];
		for (let i = 1; i < ids.length; i++) {
			const prev = ids[i - 1];
			const curr = ids[i];
			gaps.push(finalX[curr] - (finalX[prev] + finalW[prev]));
		}

		// All gaps must be equal (within floating-point tolerance).
		for (const gap of gaps) {
			expect(gap).toBeCloseTo(gaps[0], 10);
		}
	});

	it('handles already-evenly-distributed boxes (returns no changes or same positions)', () => {
		// Boxes already at equal gaps of 10.
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 10 },
			{ id: 'b', x: 60, y: 0, width: 50, height: 10 },
			{ id: 'c', x: 120, y: 0, width: 50, height: 10 },
		];

		const map = computeDistribute(boxes, 'horizontal');

		// Positions should remain unchanged (map entries may be absent or same value).
		for (const box of boxes) {
			const update = map.get(box.id);
			if (update?.x !== undefined) {
				expect(update.x).toBeCloseTo(box.x, 10);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// computeDistribute: vertical
// ---------------------------------------------------------------------------

describe('computeDistribute: vertical', () => {
	it('keeps extremes fixed and equally spaces three equal-height boxes', () => {
		// Three boxes, each height=50.
		// Initial: a(y=0), b(y=30), c(y=200)
		// span: 0 → 250; total height = 150; gap space = 100; 2 gaps → 50 each
		// Expected: a stays, b → 100, c stays
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

	it('produces equal gaps between all adjacent boxes (vertical)', () => {
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 30 },
			{ id: 'b', x: 0, y: 10, width: 50, height: 20 },
			{ id: 'c', x: 0, y: 40, width: 50, height: 40 },
			{ id: 'd', x: 0, y: 200, width: 50, height: 60 },
		];

		const map = computeDistribute(boxes, 'vertical');

		const finalY: Record<string, number> = {};
		const finalH: Record<string, number> = {};
		for (const box of boxes) {
			finalY[box.id] = map.get(box.id)?.y ?? box.y;
			finalH[box.id] = box.height;
		}

		const ids = ['a', 'b', 'c', 'd'].sort((p, q) => finalY[p] - finalY[q]);
		const gaps: number[] = [];
		for (let i = 1; i < ids.length; i++) {
			const prev = ids[i - 1];
			const curr = ids[i];
			gaps.push(finalY[curr] - (finalY[prev] + finalH[prev]));
		}

		for (const gap of gaps) {
			expect(gap).toBeCloseTo(gaps[0], 10);
		}
	});

	it('distribute vertical never sets x', () => {
		const boxes: readonly AlignBox[] = [
			{ id: 'a', x: 0, y: 0, width: 50, height: 30 },
			{ id: 'b', x: 0, y: 50, width: 50, height: 30 },
			{ id: 'c', x: 0, y: 200, width: 50, height: 30 },
		];

		for (const [, pos] of computeDistribute(boxes, 'vertical')) {
			expect(pos).not.toHaveProperty('x');
		}
	});

	it('distribute horizontal never sets y', () => {
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
