/**
 * Unit tests for the real `group-shape-geometry` exports.
 *
 * This file replaces a previous `PptxHandlerRuntimeGroupParsing.test.ts` that
 * declared its own private copies of `extractGroupTransform` and
 * `transformElement` and tested those. A test that reimplements the function
 * under test proves nothing: the copies stayed green while the production
 * transform diverged. Everything below imports the production symbols.
 */
import { describe, it, expect } from 'vitest';

import type { GroupPptxElement, PptxElement, ShapePptxElement } from '../../types';
import {
	MAX_GROUP_DEPTH,
	parseEmuInt,
	readGroupTransform,
	scaleElementSubtree,
	transformGroupChild,
} from './group-shape-geometry';

const EMU_PER_PX = 9525;

/** `a:off`/`a:ext`-style node for a value expressed in whole pixels. */
const px = (x: number, y: number) => ({
	'@_x': String(x * EMU_PER_PX),
	'@_y': String(y * EMU_PER_PX),
});
const ext = (cx: number, cy: number) => ({
	'@_cx': String(cx * EMU_PER_PX),
	'@_cy': String(cy * EMU_PER_PX),
});

function shape(over: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return { type: 'shape', id: 's', x: 0, y: 0, width: 100, height: 100, ...over };
}

function group(children: PptxElement[], over: Partial<GroupPptxElement> = {}): GroupPptxElement {
	return { type: 'group', id: 'g', x: 0, y: 0, width: 100, height: 100, children, ...over };
}

describe('parseEmuInt', () => {
	it('parses a plain integer', () => {
		expect(parseEmuInt('914400')).toBe(914400);
	});

	it('returns 0 for missing / malformed input', () => {
		expect(parseEmuInt(undefined)).toBe(0);
		expect(parseEmuInt(null)).toBe(0);
		expect(parseEmuInt('not-a-number')).toBe(0);
	});

	it('clamps to the int32 range ECMA-376 §22.1.2.4 allows', () => {
		expect(parseEmuInt('99999999999')).toBe(2_147_483_647);
		expect(parseEmuInt('-99999999999')).toBe(-2_147_483_648);
	});
});

describe('readGroupTransform', () => {
	it('returns zeros and unit scale for a missing xfrm', () => {
		expect(readGroupTransform(undefined, EMU_PER_PX)).toStrictEqual({
			parentX: 0,
			parentY: 0,
			parentW: 0,
			parentH: 0,
			parentXEmu: 0,
			parentYEmu: 0,
			parentWEmu: 0,
			parentHEmu: 0,
			chX: 0,
			chY: 0,
			chW: 0,
			chH: 0,
			chOffXEmu: 0,
			chOffYEmu: 0,
			chExtWEmu: 0,
			chExtHEmu: 0,
			scaleX: 1,
			scaleY: 1,
			rotation: undefined,
			flipHorizontal: false,
			flipVertical: false,
		});
	});

	it('reads the parent offset and extent', () => {
		const t = readGroupTransform({ 'a:off': px(100, 200), 'a:ext': ext(500, 300) }, EMU_PER_PX);
		expect(t.parentX).toBe(100);
		expect(t.parentY).toBe(200);
		expect(t.parentW).toBe(500);
		expect(t.parentH).toBe(300);
	});

	it('captures the exact EMU offset/extent alongside the pixel values', () => {
		// Sub-pixel EMU values (not exact multiples of 9525) must survive
		// unrounded for `resolveXfrmEmu` to re-emit on save.
		const t = readGroupTransform(
			{
				'a:off': { '@_x': '1524123', '@_y': '2397004' },
				'a:ext': { '@_cx': '6096050', '@_cy': '3429091' },
			},
			EMU_PER_PX,
		);
		expect(t.parentXEmu).toBe(1524123);
		expect(t.parentYEmu).toBe(2397004);
		expect(t.parentWEmu).toBe(6096050);
		expect(t.parentHEmu).toBe(3429091);
	});

	it('reads the child offset and extent', () => {
		const t = readGroupTransform({ 'a:chOff': px(10, 20), 'a:chExt': ext(250, 150) }, EMU_PER_PX);
		expect(t.chX).toBe(10);
		expect(t.chY).toBe(20);
		expect(t.chW).toBe(250);
		expect(t.chH).toBe(150);
	});

	it('computes ext / chExt as the child scale', () => {
		const t = readGroupTransform({ 'a:ext': ext(1000, 500), 'a:chExt': ext(500, 250) }, EMU_PER_PX);
		expect(t.scaleX).toBeCloseTo(2);
		expect(t.scaleY).toBeCloseTo(2);
	});

	it('falls back to unit scale when chExt is zero', () => {
		const t = readGroupTransform(
			{ 'a:ext': ext(100, 100), 'a:chExt': { '@_cx': '0', '@_cy': '0' } },
			EMU_PER_PX,
		);
		expect(t.scaleX).toBe(1);
		expect(t.scaleY).toBe(1);
	});

	it('handles fractional scaling', () => {
		const t = readGroupTransform({ 'a:ext': ext(300, 200), 'a:chExt': ext(600, 400) }, EMU_PER_PX);
		expect(t.scaleX).toBeCloseTo(0.5);
		expect(t.scaleY).toBeCloseTo(0.5);
	});

	it('keeps a compact child space UNROUNDED so the ratio survives', () => {
		// A themed background group: a full-slide `ext` over a `chExt` of a few
		// thousand EMU. Rounding chExt to whole pixels collapses it to 0 and
		// silently drops the scale back to 1.
		const t = readGroupTransform(
			{
				'a:ext': { '@_cx': '9144000', '@_cy': '6858000' },
				'a:chExt': { '@_cx': '3600', '@_cy': '2700' },
			},
			EMU_PER_PX,
		);
		expect(t.chW).toBeGreaterThan(0);
		expect(t.scaleX).toBeCloseTo(9144000 / 3600);
		expect(t.scaleY).toBeCloseTo(6858000 / 2700);
	});

	it('reads @_rot as 60000ths of a degree and collapses zero to undefined', () => {
		expect(readGroupTransform({ '@_rot': '2700000' }, EMU_PER_PX).rotation).toBeCloseTo(45);
		expect(readGroupTransform({ '@_rot': '0' }, EMU_PER_PX).rotation).toBeUndefined();
		expect(readGroupTransform({ '@_rot': 'oops' }, EMU_PER_PX).rotation).toBeUndefined();
	});

	it('reads both boolean forms of @_flipH / @_flipV', () => {
		const one = readGroupTransform({ '@_flipH': '1' }, EMU_PER_PX);
		expect(one.flipHorizontal).toBeTruthy();
		expect(one.flipVertical).toBeFalsy();
		const word = readGroupTransform({ '@_flipH': 'true', '@_flipV': 'true' }, EMU_PER_PX);
		expect(word.flipHorizontal).toBeTruthy();
		expect(word.flipVertical).toBeTruthy();
	});

	it('reads rotation and flip together', () => {
		const t = readGroupTransform({ '@_rot': '5400000', '@_flipH': '1' }, EMU_PER_PX);
		expect(t.rotation).toBeCloseTo(90);
		expect(t.flipHorizontal).toBeTruthy();
	});
});

describe('transformGroupChild', () => {
	const t = (over: Partial<ReturnType<typeof readGroupTransform>> = {}) => ({
		parentX: 0,
		parentY: 0,
		parentW: 0,
		parentH: 0,
		parentXEmu: 0,
		parentYEmu: 0,
		parentWEmu: 0,
		parentHEmu: 0,
		chX: 0,
		chY: 0,
		chW: 0,
		chH: 0,
		scaleX: 1,
		scaleY: 1,
		rotation: undefined,
		flipHorizontal: false,
		flipVertical: false,
		...over,
	});

	it('is a no-op under an identity transform', () => {
		const el = shape({ x: 50, y: 50 });
		transformGroupChild(el, t());
		expect([el.x, el.y, el.width, el.height]).toStrictEqual([50, 50, 100, 100]);
	});

	it('applies the parent offset', () => {
		const el = shape();
		transformGroupChild(el, t({ parentX: 200, parentY: 150 }));
		expect(el.x).toBe(200);
		expect(el.y).toBe(150);
	});

	it('subtracts the child offset before scaling', () => {
		const el = shape({ x: 100, y: 100, width: 50, height: 50 });
		transformGroupChild(el, t({ chX: 100, chY: 100 }));
		expect(el.x).toBe(0);
		expect(el.y).toBe(0);
	});

	it('applies the full offset + scale + parent position', () => {
		const el = shape({ x: 50, y: 30, width: 100, height: 80 });
		transformGroupChild(
			el,
			t({ parentX: 200, parentY: 100, chX: 10, chY: 10, scaleX: 2, scaleY: 2 }),
		);
		// relative = (40, 20); x = 200 + 40*2, y = 100 + 20*2
		expect(el.x).toBe(280);
		expect(el.y).toBe(140);
		expect(el.width).toBe(200);
		expect(el.height).toBe(160);
	});

	it('scales non-uniformly', () => {
		const el = shape();
		transformGroupChild(el, t({ scaleX: 2, scaleY: 0.5 }));
		expect(el.width).toBe(200);
		expect(el.height).toBe(50);
	});

	it('keeps absolute stroke widths out of the child-coordinate scale', () => {
		const el = shape({ shapeStyle: { strokeWidth: 4 } });
		transformGroupChild(el, t({ scaleX: 635, scaleY: 635 }));
		expect(el.shapeStyle?.strokeWidth).toBe(4);
	});

	it('does NOT scale font size (PowerPoint keeps the authored point size)', () => {
		const el = shape({ fontSize: 12 });
		transformGroupChild(el, t({ scaleX: 0.5, scaleY: 0.5 }));
		expect(el.fontSize).toBe(12);
	});

	it('places a NESTED group and scales its subtree without re-offsetting it', () => {
		// The wrapper sits at (10, 10) in the outer group's child space and holds
		// one shape 5px in from its own origin. The outer group doubles.
		const inner = shape({ x: 5, y: 5, width: 20, height: 20 });
		const nested = group([inner], { x: 10, y: 10, width: 40, height: 40 });
		transformGroupChild(nested, t({ parentX: 100, parentY: 100, scaleX: 2, scaleY: 2 }));

		expect(nested.x).toBe(120);
		expect(nested.y).toBe(120);
		expect(nested.width).toBe(80);
		// The child keeps its RELATIVE position but takes the scale, so its
		// absolute position is 120 + 10 = 130, matching a flattened parse.
		expect(inner.x).toBe(10);
		expect(inner.y).toBe(10);
		expect(inner.width).toBe(40);
	});

	it('reaches a grandchild through two nested wrappers', () => {
		const leaf = shape({ x: 2, y: 2, width: 4, height: 4 });
		const mid = group([leaf], { x: 1, y: 1, width: 10, height: 10 });
		const outer = group([mid], { x: 0, y: 0, width: 20, height: 20 });
		transformGroupChild(outer, t({ scaleX: 3, scaleY: 3 }));
		expect(mid.x).toBe(3);
		expect(leaf.x).toBe(6);
		expect(leaf.width).toBe(12);
	});
});

describe('scaleElementSubtree', () => {
	it('scales geometry without moving the origin', () => {
		const el = shape({ x: 10, y: 20, width: 30, height: 40 });
		scaleElementSubtree(el, 2, 3);
		expect([el.x, el.y, el.width, el.height]).toStrictEqual([20, 60, 60, 120]);
	});

	it('recurses into nested group children', () => {
		const leaf = shape({
			x: 4,
			y: 4,
			width: 8,
			height: 8,
			shapeStyle: { strokeWidth: 2 },
		});
		const nested = group([leaf], { x: 2, y: 2, width: 16, height: 16 });
		scaleElementSubtree(nested, 0.5, 0.5);
		expect(nested.x).toBe(1);
		expect(leaf.x).toBe(2);
		expect(leaf.width).toBe(4);
		expect(leaf.shapeStyle?.strokeWidth).toBe(2);
	});
});

describe('the MAX_GROUP_DEPTH cap', () => {
	it('does not exceed the downstream element-walk cap', async () => {
		// The enrichment passes (chart / SmartArt / OLE / media timing) all walk
		// through `flattenElementsDeep`. Parsing deeper than they descend would
		// build a subtree nothing can ever enrich.
		const flatten = await import('../../utils/flatten-elements');
		let deepest: PptxElement = shape({ id: 'leaf' });
		for (let i = 0; i < MAX_GROUP_DEPTH; i++) {
			deepest = group([deepest], { id: `g${i}` });
		}
		const flat = flatten.flattenElementsDeep([deepest]);
		expect(flat.some((el) => el.id === 'leaf')).toBeTruthy();
	});
});
