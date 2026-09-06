/**
 * Unit tests for `group-xfrm-preservation.ts`'s pure decision helpers.
 *
 * `isGroupChildUnchanged`/`invertChildIntoGroupSpace` deliberately use the
 * owner's IMMUTABLE `widthEmu`/`heightEmu` (its OWN source `a:ext`, captured
 * once at parse time) as the scale denominator, never a "current" resolved
 * extent - verified against real PowerPoint COM ground truth: resizing a
 * group directly (no child touched) keeps every child's `a:off`/`a:ext`
 * byte-for-byte verbatim, only rewriting the GROUP's own `a:off`/`a:ext`.
 * Using the group's post-resize pixel extent instead of its immutable
 * source EMU would make every untouched child look "changed" (the scale
 * shifted) and needlessly re-quantize it, contradicting that ground truth.
 * See the module doc for the full write-up, including the "one child
 * moved" ground truth and what this module deliberately does not replicate
 * (PowerPoint's own bounding-box auto-fit).
 */
import { describe, expect, it } from 'vitest';

import type { ShapePptxElement } from '../../types';
import {
	hasCapturedChildSpace,
	invertChildIntoGroupSpace,
	isGroupChildUnchanged,
} from './group-xfrm-preservation';
import type { GroupChildSpaceOwner } from './group-xfrm-preservation';

const EMU_PER_PX = 9525;

function shape(over: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return { type: 'shape', id: 's', x: 0, y: 0, width: 100, height: 100, ...over };
}

describe('hasCapturedChildSpace', () => {
	it('is false when any chOff/chExt EMU is missing (an editor-created group)', () => {
		expect(hasCapturedChildSpace({})).toBeFalsy();
		expect(hasCapturedChildSpace({ chOffXEmu: 0, chOffYEmu: 0, chExtWidthEmu: 100 })).toBeFalsy();
	});

	it('is false for a degenerate (zero) chExt on either axis', () => {
		expect(
			hasCapturedChildSpace({
				chOffXEmu: 0,
				chOffYEmu: 0,
				chExtWidthEmu: 0,
				chExtHeightEmu: 100,
			}),
		).toBeFalsy();
	});

	it('is true once all four EMU are captured and non-degenerate', () => {
		expect(
			hasCapturedChildSpace({
				chOffXEmu: 400000,
				chOffYEmu: 2100000,
				chExtWidthEmu: 4200000,
				chExtHeightEmu: 600000,
			}),
		).toBeTruthy();
	});
});

describe('isGroupChildUnchanged', () => {
	const owner: GroupChildSpaceOwner = {
		chOffXEmu: 400000,
		chOffYEmu: 2100000,
		chExtWidthEmu: 4200000,
		chExtHeightEmu: 600000,
		widthEmu: 4200000,
		heightEmu: 600000,
	};

	it('is true when the child current geometry round-trips through owner chOff/chExt/extent', () => {
		const child = shape({
			x: 0,
			y: 0,
			width: 210,
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		expect(isGroupChildUnchanged(child, owner, EMU_PER_PX)).toBeTruthy();
	});

	it('is false once the child has moved', () => {
		const moved = shape({
			x: 40,
			y: 0,
			width: 210,
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		expect(isGroupChildUnchanged(moved, owner, EMU_PER_PX)).toBeFalsy();
	});

	it('is STILL true after the owner (group) has been resized: widthEmu is the IMMUTABLE source extent, unaffected by a resize (COM-verified)', () => {
		const child = shape({
			x: 0,
			y: 0,
			width: 210,
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		// `owner.widthEmu` here is the SAME immutable value regardless of how
		// big the group currently renders - a resize never touches it, so an
		// unmoved child correctly stays "unchanged".
		expect(isGroupChildUnchanged(child, owner, EMU_PER_PX)).toBeTruthy();
	});

	it('is false when owner has no captured child space', () => {
		const child = shape({ xEmu: 1, yEmu: 1, widthEmu: 1, heightEmu: 1 });
		expect(isGroupChildUnchanged(child, { widthEmu: 100, heightEmu: 100 }, EMU_PER_PX)).toBeFalsy();
	});
});

describe('invertChildIntoGroupSpace', () => {
	const owner: GroupChildSpaceOwner = {
		chOffXEmu: 400000,
		chOffYEmu: 2100000,
		chExtWidthEmu: 4200000,
		chExtHeightEmu: 600000,
		widthEmu: 4200000,
		heightEmu: 600000,
	};

	it('returns undefined when the owner has no captured child space', () => {
		const child = shape({ xEmu: 1, yEmu: 1, widthEmu: 1, heightEmu: 1 });
		expect(
			invertChildIntoGroupSpace(child, { widthEmu: 100, heightEmu: 100 }, EMU_PER_PX),
		).toBeUndefined();
	});

	it('re-emits the child exact original EMU verbatim when unchanged (identity scale)', () => {
		const child = shape({
			x: 0,
			y: 0,
			width: 210,
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		expect(invertChildIntoGroupSpace(child, owner, EMU_PER_PX)).toStrictEqual({
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
	});

	it('re-emits an UNMOVED child verbatim even after the group itself was resized (COM-verified ground truth)', () => {
		// Ground truth: PowerPoint COM `Shape.Width *= 1.5` on the GROUP itself
		// (no child touched) keeps every child's own a:off/a:ext byte-for-byte
		// and only rewrites the group's OWN a:off/a:ext; the render-time scale
		// (ext/chExt) shifts as a side effect, which is what makes the
		// children visually scale with the box on next open.
		const unmoved = shape({
			x: 0,
			y: 0,
			width: 210,
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		// `owner.widthEmu` stays the group's IMMUTABLE 4200000 regardless of a
		// resize - only the group's OWN a:off/a:ext (computed elsewhere, via
		// `resolveXfrmEmu` on the CURRENT pixel value) reflects it.
		expect(invertChildIntoGroupSpace(unmoved, owner, EMU_PER_PX)).toStrictEqual({
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
	});

	it('inverts the CURRENT relative pixel position once the child has moved (matches the COM ground truth direction: Shape.GroupItems(i).Left += 40px, identity scale)', () => {
		// Width/height are the EXACT (unrounded) relative-to-group pixel value
		// `transformGroupChild` would have produced at parse time for this
		// child's raw 2000000x600000 EMU through an identity (scale 1) child
		// space, so the recompute round-trips back to the same EMU on the
		// UNCHANGED axes - only x changed here.
		const moved = shape({
			x: 40,
			y: 0,
			width: 2000000 / EMU_PER_PX,
			height: 600000 / EMU_PER_PX,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		// scale = 4200000/4200000 = 1, so the 40px move is exactly 40*9525 EMU.
		expect(invertChildIntoGroupSpace(moved, owner, EMU_PER_PX)).toStrictEqual({
			xEmu: 400000 + 40 * EMU_PER_PX,
			yEmu: 2100000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
	});

	it('inverts through a non-trivial (0.5) scale when the child moves inside a scaled group', () => {
		// GroupD-shaped owner: chExt is DOUBLE its own current extent (a 0.5
		// scale), so a child spanning the WHOLE child space renders at HALF
		// its child-space size in the group's own pixel space.
		const scaledOwner: GroupChildSpaceOwner = {
			chOffXEmu: 400000,
			chOffYEmu: 3000000,
			chExtWidthEmu: 2000000,
			chExtHeightEmu: 600000,
			widthEmu: 1000000,
			heightEmu: 300000,
		};
		const moved = shape({
			x: 40,
			y: 0,
			width: 1000000 / EMU_PER_PX,
			height: 300000 / EMU_PER_PX,
			xEmu: 400000,
			yEmu: 3000000,
			widthEmu: 2000000,
			heightEmu: 600000,
		});
		const result = invertChildIntoGroupSpace(moved, scaledOwner, EMU_PER_PX);
		// scale = chExt/ownExt = 2, so a 40px move inverts to 2x its EMU distance.
		expect(result?.xEmu).toBe(400000 + Math.round(40 * EMU_PER_PX * 2));
		expect(result?.widthEmu).toBe(2000000);
		expect(result?.heightEmu).toBe(600000);
	});
});
