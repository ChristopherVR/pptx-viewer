import { describe, expect, it } from 'vitest';

import { computeSnap, snapToGridStep } from './snap-guides';
import type { SnapBox, SnapGuide, SnapResult } from './snap-guides';

// Shorthand factory so tests stay compact.
function box(x: number, y: number, w: number, h: number): SnapBox {
	return { x, y, width: w, height: h };
}

// ---------------------------------------------------------------------------
// X-axis snapping (vertical guide lines)
// ---------------------------------------------------------------------------

describe('x-axis: left-edge snap', () => {
	// moving box left edge at 103; other box left edge at 100 → dist=3 ≤ threshold 5
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
		const xGuides = result.guides.filter((g: SnapGuide) => g.axis === 'x');
		expect(xGuides).toHaveLength(1);
	});

	it('x guide is positioned at the matched line (100)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(100);
	});

	it('guide span covers both boxes on the Y axis', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		// other box: y=10..50, moving box: y=50..110 → union y=10..110
		expect(g?.start).toBe(10);
		expect(g?.end).toBe(110);
	});
});

describe('x-axis: centre snap', () => {
	// moving centreX = 200 + 80/2 = 240; other centreX = 100 + 280/2 = 240 → exact match
	const moving = box(200, 0, 80, 50);
	const other = box(100, 0, 280, 50);
	const result = computeSnap(moving, [other], 5);

	it('x stays at 200 when centres already align', () => {
		// delta = 240 - 240 = 0
		expect(result.x).toBe(200);
	});

	it('emits an x guide at position 240 (the shared centre)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(240);
	});
});

describe('x-axis: right-edge snap', () => {
	// moving right edge = 50 + 100 = 150; other right edge = 10 + 143 = 153 → dist=3 ≤ 5
	const moving = box(50, 20, 100, 60);
	const other = box(10, 30, 143, 40);
	const result = computeSnap(moving, [other], 5);

	it('adjusts x so moving right aligns with other right', () => {
		// matchedLine = 153, candidate was trailing (offset=100) → delta=3 → x=53
		expect(result.x).toBe(53);
	});

	it('guide pos is the matched right edge (153)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(153);
	});
});

// ---------------------------------------------------------------------------
// Y-axis snapping (horizontal guide lines)
// ---------------------------------------------------------------------------

describe('y-axis: top-edge snap', () => {
	// moving top = 204; other top = 200 → dist=4 ≤ 5
	const moving = box(0, 204, 60, 80);
	const other = box(0, 200, 60, 80);
	const result = computeSnap(moving, [other], 5);

	it('adjusts y so moving top aligns with other top', () => {
		expect(result.y).toBe(200);
	});

	it('emits exactly one y guide', () => {
		const yGuides = result.guides.filter((g: SnapGuide) => g.axis === 'y');
		expect(yGuides).toHaveLength(1);
	});

	it('y guide is positioned at the matched top (200)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.pos).toBe(200);
	});
});

describe('y-axis: centre snap', () => {
	// moving centreY = 100 + 60/2 = 130; other centreY = 120 + 20/2 = 130 → exact
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
	// moving bottom = 50 + 70 = 120; other bottom = 10 + 113 = 123 → dist=3 ≤ 5
	const moving = box(0, 50, 60, 70);
	const other = box(0, 10, 60, 113);
	const result = computeSnap(moving, [other], 5);

	it('adjusts y so moving bottom aligns with other bottom', () => {
		// matchedLine=123, candidate was trailing (offset=70) → delta=3 → y=53
		expect(result.y).toBe(53);
	});

	it('guide pos is the matched bottom (123)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.pos).toBe(123);
	});
});

// ---------------------------------------------------------------------------
// Nothing within threshold → no change, no guides
// ---------------------------------------------------------------------------

describe('no snap when nothing is within threshold', () => {
	const moving = box(0, 0, 50, 50);
	// nearest other-box feature: left edge at 100 → dist=100 far beyond threshold=5
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

// ---------------------------------------------------------------------------
// Empty others → no change, no guides
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Closest candidate wins among competing candidates
// ---------------------------------------------------------------------------

describe('closest candidate wins on X axis', () => {
	// moving box: x=0, w=100 → left=0, centreX=50, right=100
	// other1 left=3 (dist from moving.left=3), other2 left=48 (dist from moving.centreX=2)
	// threshold=5: both hit, but other2/centre is closer
	const moving = box(0, 0, 100, 50);
	const other1 = box(3, 0, 100, 50); // dist(left→left) = 3
	const other2 = box(48, 0, 100, 50); // dist(centreX→left) = |50-48| = 2  ← closer
	const result = computeSnap(moving, [other1, other2], 5);

	it('snaps to the closer match (other2 left=48 via centreX)', () => {
		// centreX of moving was 50, matched to 48 → delta=-2 → x = 0 + (-2) = -2
		expect(result.x).toBe(-2);
	});

	it('guide pos is 48 (the winning line)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'x');
		expect(g?.pos).toBe(48);
	});
});

describe('closest candidate wins on Y axis', () => {
	// moving: y=0, h=100 → top=0, centreY=50, bottom=100
	// other1 top=4 → dist(top→top)=4; other2 top=47 → dist(centreY→top)=|50-47|=3 ← closer
	const moving = box(0, 0, 50, 100);
	const other1 = box(0, 4, 50, 100);
	const other2 = box(0, 47, 50, 100);
	const result = computeSnap(moving, [other1, other2], 5);

	it('snaps to the closer match', () => {
		// centreY was 50, matched to 47 → delta=-3 → y = 0 + (-3) = -3
		expect(result.y).toBe(-3);
	});
});

// ---------------------------------------------------------------------------
// Guide span covers both boxes
// ---------------------------------------------------------------------------

describe('guide span covers both boxes (X axis)', () => {
	// moving: y=200, h=50 → 200..250; other: y=10, h=20 → 10..30; union=10..250
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

describe('guide span covers both boxes (Y axis)', () => {
	// moving: x=200, w=50 → 200..250; other: x=10, w=20 → 10..30; union=10..250
	// y snap: moving top=102, other top=100, dist=2 ≤ 5
	const moving = box(200, 102, 50, 40);
	const other = box(10, 100, 20, 40);
	const result = computeSnap(moving, [other], 5);

	it('y guide start covers the leftmost box (x=10)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		// snappedX = 200 (no x snap), movedBoxLeft=200, otherBox.x=10 → start=10
		expect(g?.start).toBe(10);
	});

	it('y guide end covers the rightmost edge (max(250, 30) = 250)', () => {
		const g = result.guides.find((item: SnapGuide) => item.axis === 'y');
		expect(g?.end).toBe(250);
	});
});

// ---------------------------------------------------------------------------
// Both axes snap simultaneously
// ---------------------------------------------------------------------------

describe('both axes snap at once', () => {
	// x: moving left=103, other left=100 → dist=3 ≤ 5
	// y: moving top=202, other top=200 → dist=2 ≤ 5
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
