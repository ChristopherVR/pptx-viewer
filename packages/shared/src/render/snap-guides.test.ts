import { describe, expect, it } from 'vitest';

import { computeSnap, computeSnapToShape, snapBox, snapToGridStep, snapValue } from './snap-guides';
import type { SnapBox, SnapGuide, SnapResult } from './snap-guides';

// ---------------------------------------------------------------------------
// computeSnapToShape (React / Vue model) — siblings + guides → snap lines
// ---------------------------------------------------------------------------

describe('computeSnapToShape', () => {
	it('returns original position when no siblings', () => {
		const result = computeSnapToShape(100, 100, 50, 50, [], new Set(), []);
		expect(result.x).toBe(100);
		expect(result.y).toBe(100);
		expect(result.lines).toStrictEqual([]);
	});

	it('snaps to sibling left edge when within threshold', () => {
		const siblings = [{ x: 103, y: 200, width: 50, height: 50, id: 'sib-1' }];
		const result = computeSnapToShape(100, 100, 50, 50, siblings, new Set(), []);
		expect(result.x).toBe(103);
	});

	it('does not snap to elements that are being dragged', () => {
		const siblings = [{ x: 103, y: 200, width: 50, height: 50, id: 'sib-1' }];
		const result = computeSnapToShape(100, 100, 50, 50, siblings, new Set(['sib-1']), []);
		expect(result.x).toBe(100);
	});

	it('snaps to vertical guide', () => {
		const guides = [{ axis: 'v' as const, position: 102 }];
		const result = computeSnapToShape(100, 100, 50, 50, [], new Set(), guides);
		expect(result.x).toBe(102);
	});

	it('snaps to horizontal guide', () => {
		const guides = [{ axis: 'h' as const, position: 103 }];
		const result = computeSnapToShape(100, 100, 50, 50, [], new Set(), guides);
		expect(result.y).toBe(103);
	});

	it('produces snap lines when snapping occurs', () => {
		const siblings = [{ x: 100, y: 200, width: 50, height: 50, id: 'sib-1' }];
		const result = computeSnapToShape(100, 100, 50, 50, siblings, new Set(), []);
		expect(result.lines.length).toBeGreaterThan(0);
		expect(result.lines.some((l) => l.axis === 'v')).toBeTruthy();
	});

	it('honours an explicit threshold override', () => {
		const siblings = [{ x: 108, y: 200, width: 50, height: 50, id: 'sib-1' }];
		// default threshold 6 would not snap (dist 8); explicit 10 does
		expect(computeSnapToShape(100, 100, 50, 50, siblings, new Set(), []).x).toBe(100);
		expect(computeSnapToShape(100, 100, 50, 50, siblings, new Set(), [], 10).x).toBe(108);
	});
});

// ---------------------------------------------------------------------------
// computeSnap (Angular model) — closest-per-axis span guides
// ---------------------------------------------------------------------------

function box(x: number, y: number, w: number, h: number): SnapBox {
	return { x, y, width: w, height: h };
}

describe('x-axis: left-edge snap', () => {
	const moving = box(103, 50, 80, 60);
	const other = box(100, 10, 120, 40);
	const result: SnapResult = computeSnap(moving, [other], 5);

	it('adjusts x so moving left aligns with other left', () => {
		expect(result.x).toBe(100);
	});

	it('does not adjust y', () => {
		expect(result.y).toBe(moving.y);
	});

	it('emits exactly one x guide', () => {
		expect(result.guides.filter((g: SnapGuide) => g.axis === 'x')).toHaveLength(1);
	});

	it('x guide is positioned at the matched line (100)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(100);
	});

	it('guide span covers both boxes on the y axis', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.start).toBe(10);
		expect(g?.end).toBe(110);
	});
});

describe('x-axis: centre snap', () => {
	const moving = box(200, 0, 80, 50);
	const other = box(100, 0, 280, 50);
	const result = computeSnap(moving, [other], 5);

	it('x stays at 200 when centres already align', () => {
		expect(result.x).toBe(200);
	});

	it('emits an x guide at position 240 (the shared centre)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(240);
	});
});

describe('x-axis: right-edge snap', () => {
	const moving = box(50, 20, 100, 60);
	const other = box(10, 30, 143, 40);
	const result = computeSnap(moving, [other], 5);

	it('adjusts x so moving right aligns with other right', () => {
		expect(result.x).toBe(53);
	});

	it('guide pos is the matched right edge (153)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(153);
	});
});

describe('y-axis: top-edge snap', () => {
	const moving = box(0, 204, 60, 80);
	const other = box(0, 200, 60, 80);
	const result = computeSnap(moving, [other], 5);

	it('adjusts y so moving top aligns with other top', () => {
		expect(result.y).toBe(200);
	});

	it('emits exactly one y guide', () => {
		expect(result.guides.filter((g: SnapGuide) => g.axis === 'y')).toHaveLength(1);
	});

	it('y guide is positioned at the matched top (200)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.pos).toBe(200);
	});
});

describe('y-axis: centre snap', () => {
	const moving = box(0, 100, 50, 60);
	const other = box(0, 120, 50, 20);
	const result = computeSnap(moving, [other], 5);

	it('y stays at 100 when centres already align', () => {
		expect(result.y).toBe(100);
	});

	it('emits a y guide at 130', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.pos).toBe(130);
	});
});

describe('y-axis: bottom-edge snap', () => {
	const moving = box(0, 50, 60, 70);
	const other = box(0, 10, 60, 113);
	const result = computeSnap(moving, [other], 5);

	it('adjusts y so moving bottom aligns with other bottom', () => {
		expect(result.y).toBe(53);
	});

	it('guide pos is the matched bottom (123)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.pos).toBe(123);
	});
});

describe('no snap when nothing is within threshold', () => {
	const moving = box(0, 0, 50, 50);
	const other = box(100, 100, 50, 50);
	const result = computeSnap(moving, [other], 5);

	it('x unchanged', () => {
		expect(result.x).toBe(moving.x);
	});

	it('y unchanged', () => {
		expect(result.y).toBe(moving.y);
	});

	it('guides is empty', () => {
		expect(result.guides).toHaveLength(0);
	});
});

describe('no snap when others list is empty', () => {
	const moving = box(10, 20, 80, 40);
	const result = computeSnap(moving, [], 10);

	it('returns box position unchanged', () => {
		expect(result.x).toBe(10);
		expect(result.y).toBe(20);
	});

	it('guides is empty', () => {
		expect(result.guides).toHaveLength(0);
	});
});

describe('closest candidate wins on x axis', () => {
	const moving = box(0, 0, 100, 50);
	const other1 = box(3, 0, 100, 50);
	const other2 = box(48, 0, 100, 50);
	const result = computeSnap(moving, [other1, other2], 5);

	it('snaps to the closer match (other2 left=48 via centreX)', () => {
		expect(result.x).toBe(-2);
	});

	it('guide pos is 48 (the winning line)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(48);
	});
});

describe('closest candidate wins on y axis', () => {
	const moving = box(0, 0, 50, 100);
	const other1 = box(0, 4, 50, 100);
	const other2 = box(0, 47, 50, 100);
	const result = computeSnap(moving, [other1, other2], 5);

	it('snaps to the closer match', () => {
		expect(result.y).toBe(-3);
	});
});

describe('guide span covers both boxes (x axis)', () => {
	const moving = box(103, 200, 80, 50);
	const other = box(100, 10, 80, 20);
	const result = computeSnap(moving, [other], 5);

	it('x guide start is min(200, 10) = 10', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.start).toBe(10);
	});

	it('x guide end is max(250, 30) = 250', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.end).toBe(250);
	});
});

describe('guide span covers both boxes (y axis)', () => {
	const moving = box(200, 102, 50, 40);
	const other = box(10, 100, 20, 40);
	const result = computeSnap(moving, [other], 5);

	it('y guide start covers the leftmost box (x=10)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.start).toBe(10);
	});

	it('y guide end covers the rightmost edge (max(250, 30) = 250)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.end).toBe(250);
	});
});

describe('both axes snap at once', () => {
	const moving = box(103, 202, 80, 60);
	const other = box(100, 200, 80, 60);
	const result = computeSnap(moving, [other], 5);

	it('x is snapped', () => {
		expect(result.x).toBe(100);
	});

	it('y is snapped', () => {
		expect(result.y).toBe(200);
	});

	it('emits one x guide and one y guide', () => {
		expect(result.guides.filter((g: SnapGuide) => g.axis === 'x')).toHaveLength(1);
		expect(result.guides.filter((g: SnapGuide) => g.axis === 'y')).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// snapToGridStep
// ---------------------------------------------------------------------------

describe('snapToGridStep', () => {
	it('snaps to nearest multiple below', () => {
		expect(snapToGridStep(3, 8)).toBe(0);
	});
	it('snaps to nearest multiple above', () => {
		expect(snapToGridStep(5, 8)).toBe(8);
	});
	it('already on grid → unchanged', () => {
		expect(snapToGridStep(16, 8)).toBe(16);
	});
	it('returns value unchanged when step is 0', () => {
		expect(snapToGridStep(12, 0)).toBe(12);
	});
	it('works with non-8 step', () => {
		expect(snapToGridStep(7, 5)).toBe(5);
		expect(snapToGridStep(8, 5)).toBe(10);
	});
	it('negative values snap correctly', () => {
		expect(snapToGridStep(-3, 8)).toBe(0);
		expect(snapToGridStep(-5, 8)).toBe(-8);
	});
});

// ---------------------------------------------------------------------------
// snapValue / snapBox (grid snapping, Vue model)
// ---------------------------------------------------------------------------

describe('snapValue', () => {
	it('rounds to the nearest grid multiple', () => {
		expect(snapValue(7, 8)).toBe(8);
		expect(snapValue(3, 8)).toBe(0);
	});
});

describe('snapBox', () => {
	it('snaps position and size to the grid', () => {
		const result = snapBox({ x: 7, y: 3, width: 31, height: 17 }, 8);
		expect(result).toStrictEqual({ x: 8, y: 0, width: 32, height: 16 });
	});

	it('clamps size to at least one grid cell', () => {
		const result = snapBox({ x: 0, y: 0, width: 2, height: 1 }, 8);
		expect(result.width).toBe(8);
		expect(result.height).toBe(8);
	});
});
