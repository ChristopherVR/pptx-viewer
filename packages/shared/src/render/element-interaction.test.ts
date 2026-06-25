import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyDragDelta,
	applyResize,
	boxCenter,
	computeMarqueeHitIds,
	computeRotation,
	mergeAdditiveSelection,
	rotateDelta,
	snapAngle,
	snapBoxToGrid,
} from './element-interaction';
import type { InteractionBox, MarqueeElementRect, MarqueeRect } from './element-interaction';

function box(overrides: Partial<InteractionBox> = {}): InteractionBox {
	return { x: 100, y: 100, width: 200, height: 100, rotation: 0, ...overrides };
}

describe('applyDragDelta', () => {
	it('translates by screen delta divided by zoom', () => {
		const r = applyDragDelta(box(), 40, 20, 2);
		expect(r.x).toBe(120);
		expect(r.y).toBe(110);
		expect(r.width).toBe(200);
		expect(r.height).toBe(100);
	});

	it('treats zoom of 0 as 1 (no divide-by-zero)', () => {
		const r = applyDragDelta(box(), 10, 10, 0);
		expect(r.x).toBe(110);
		expect(r.y).toBe(110);
	});

	it('ignores rotation for a plain move', () => {
		const r = applyDragDelta(box({ rotation: 90 }), 10, 0, 1);
		expect(r.x).toBe(110);
		expect(r.y).toBe(100);
		expect(r.rotation).toBe(90);
	});
});

describe('rotateDelta', () => {
	it('is identity at 0 degrees', () => {
		expect(rotateDelta(10, 5, 0)).toStrictEqual({ x: 10, y: 5 });
	});

	it('maps a screen +x delta onto the local -y axis at 90deg', () => {
		const r = rotateDelta(10, 0, 90);
		expect(r.x).toBeCloseTo(0, 6);
		expect(r.y).toBeCloseTo(-10, 6);
	});
});

describe('applyResize', () => {
	it('grows from the SE handle keeping the top-left fixed', () => {
		const r = applyResize(box(), 'se', 50, 30, 1);
		expect(r.x).toBe(100);
		expect(r.y).toBe(100);
		expect(r.width).toBe(250);
		expect(r.height).toBe(130);
	});

	it('grows from the NW handle moving the top-left', () => {
		const r = applyResize(box(), 'nw', -50, -30, 1);
		expect(r.width).toBe(250);
		expect(r.height).toBe(130);
		expect(r.x).toBe(50);
		expect(r.y).toBe(70);
	});

	it('resizes a single axis for an edge handle', () => {
		const r = applyResize(box(), 'e', 40, 999, 1);
		expect(r.width).toBe(240);
		expect(r.height).toBe(100);
		expect(r.x).toBe(100);
		expect(r.y).toBe(100);
	});

	it('honours min size and pins the moving edge', () => {
		const r = applyResize(box(), 'w', 1000, 0, 1, { minSize: 20 });
		expect(r.width).toBe(20);
		// Left edge cannot pass the right edge: x = right - minSize = 300 - 20.
		expect(r.x).toBe(280);
	});

	it('defaults the min size to MIN_ELEMENT_SIZE', () => {
		const r = applyResize(box({ width: 20, height: 20 }), 'se', -1000, -1000, 1);
		expect(r.width).toBe(MIN_ELEMENT_SIZE);
		expect(r.height).toBe(MIN_ELEMENT_SIZE);
	});

	it('scales the screen delta by zoom', () => {
		const r = applyResize(box(), 'e', 100, 0, 2);
		expect(r.width).toBe(250); // 100px screen / zoom 2 = 50 element px
	});

	it('rotates the delta into local space for a rotated element', () => {
		// At 90deg, a screen +x drag on the E handle becomes a local -y drag,
		// which the E handle ignores (single x-axis), so width is unchanged.
		const r = applyResize(box({ rotation: 90 }), 'e', 40, 0, 1);
		expect(r.width).toBeCloseTo(200, 6);
		// A screen +y drag becomes a local +x drag -> width grows.
		const r2 = applyResize(box({ rotation: 90 }), 'e', 0, 40, 1);
		expect(r2.width).toBeCloseTo(240, 6);
	});
});

describe('computeRotation', () => {
	const center = { x: 0, y: 0 };

	it('returns 0 when the pointer is directly above the center', () => {
		expect(computeRotation(center, { x: 0, y: -10 })).toBeCloseTo(0, 6);
	});

	it('returns 90 to the right', () => {
		expect(computeRotation(center, { x: 10, y: 0 })).toBeCloseTo(90, 6);
	});

	it('returns 180 below', () => {
		expect(computeRotation(center, { x: 0, y: 10 })).toBeCloseTo(180, 6);
	});

	it('returns 270 to the left', () => {
		expect(computeRotation(center, { x: -10, y: 0 })).toBeCloseTo(270, 6);
	});

	it('normalises to [0, 360)', () => {
		const angle = computeRotation(center, { x: -1, y: -10 });
		expect(angle).toBeGreaterThanOrEqual(0);
		expect(angle).toBeLessThan(360);
	});
});

describe('boxCenter', () => {
	it('returns the geometric center', () => {
		expect(boxCenter(box())).toStrictEqual({ x: 200, y: 150 });
	});
});

describe('snapAngle', () => {
	it('snaps to the nearest step within tolerance', () => {
		expect(snapAngle(13, 15)).toBe(15);
		expect(snapAngle(2, 15)).toBe(0);
	});

	it('leaves angles outside tolerance unchanged', () => {
		expect(snapAngle(8, 15, 3)).toBe(8);
	});

	it('normalises snapped result to [0, 360)', () => {
		expect(snapAngle(359, 15)).toBe(0);
	});
});

describe('snapBoxToGrid', () => {
	const start = { x: 100, y: 100, width: 200, height: 150 };

	it('snaps the SE right/bottom edges keeping the origin fixed', () => {
		// Right edge 100+253 -> nearest 10 = 350 -> width 250; bottom 100+197 ->
		// nearest 10 = 300 -> height 200.
		const r = snapBoxToGrid({ ...start, width: 253, height: 197 }, 'se', 10);
		expect(r.x).toBe(100);
		expect(r.y).toBe(100);
		expect(r.width).toBe(250);
		expect(r.height).toBe(200);
	});

	it('snaps the NW origin growing the dimension to compensate', () => {
		// origin 87/83 -> nearest 10 = 90/80.
		const r = snapBoxToGrid({ x: 87, y: 83, width: 213, height: 217 }, 'nw', 10);
		expect(r.x).toBe(90);
		expect(r.y).toBe(80);
	});

	it('returns the box unchanged for a null handle or non-positive grid', () => {
		expect(snapBoxToGrid(start, null, 10)).toBe(start);
		expect(snapBoxToGrid(start, 'se', 0)).toBe(start);
	});

	it('clamps a snapped dimension to the min size', () => {
		const r = snapBoxToGrid({ x: 0, y: 0, width: 1, height: 1 }, 'se', 10, 8);
		expect(r.width).toBeGreaterThanOrEqual(8);
		expect(r.height).toBeGreaterThanOrEqual(8);
	});
});

describe('computeMarqueeHitIds', () => {
	const elements: MarqueeElementRect[] = [
		{ id: 'a', x: 10, y: 10, width: 50, height: 50 },
		{ id: 'b', x: 100, y: 100, width: 50, height: 50 },
		{ id: 'c', x: 200, y: 200, width: 50, height: 50 },
	];

	it('returns empty for a tiny marquee (both dims <= 3)', () => {
		const m: MarqueeRect = { startX: 10, startY: 10, currentX: 12, currentY: 12 };
		expect(computeMarqueeHitIds(m, elements)).toStrictEqual([]);
	});

	it('selects elements inside the rectangle', () => {
		const m: MarqueeRect = { startX: 0, startY: 0, currentX: 70, currentY: 70 };
		expect(computeMarqueeHitIds(m, elements)).toStrictEqual(['a']);
	});

	it('normalises reversed corners', () => {
		const m: MarqueeRect = { startX: 70, startY: 70, currentX: 0, currentY: 0 };
		expect(computeMarqueeHitIds(m, elements)).toStrictEqual(['a']);
	});

	it('clamps small elements to the min size so they stay selectable', () => {
		const tiny: MarqueeElementRect = { id: 'tiny', x: 50, y: 50, width: 2, height: 2 };
		const m: MarqueeRect = { startX: 45, startY: 45, currentX: 63, currentY: 63 };
		expect(computeMarqueeHitIds(m, [tiny], 12)).toStrictEqual(['tiny']);
	});
});

describe('mergeAdditiveSelection', () => {
	it('merges and de-duplicates, base ids first', () => {
		expect(mergeAdditiveSelection(['a', 'b'], ['b', 'c'])).toStrictEqual(['a', 'b', 'c']);
	});

	it('handles an undefined base', () => {
		expect(mergeAdditiveSelection(undefined, ['a', 'b'])).toStrictEqual(['a', 'b']);
	});
});
