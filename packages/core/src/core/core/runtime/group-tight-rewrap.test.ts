/**
 * Unit tests for `group-tight-rewrap.ts`'s pure decision helpers, using
 * exact numbers measured against real PowerPoint via COM automation (see the
 * module doc). Four ground-truth decks are encoded here:
 *
 *  - A two-shape group, one child moved 40pt right (identity scale).
 *  - The same group, but rotated 25 degrees (tests the rotation-pivot term).
 *  - A nested group (2 levels), one grandchild moved, propagating a
 *    re-wrap through both its own level and its parent's.
 *  - A single child rotated (NOT moved): must have NO effect at all.
 */
import { describe, expect, it } from 'vitest';

import type { GroupPptxElement, ShapePptxElement } from '../../types';
import { resolveGroupTightRewrap, rewrapGroupOwnBox } from './group-tight-rewrap';

const EMU_PER_PX = 9525;

function shape(over: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return { type: 'shape', id: 's', x: 0, y: 0, width: 100, height: 100, ...over };
}

function group(over: Partial<GroupPptxElement> = {}): GroupPptxElement {
	return { type: 'group', id: 'g', x: 0, y: 0, width: 100, height: 100, children: [], ...over };
}

describe('rewrapGroupOwnBox', () => {
	it('reduces to translation-only at rotation 0 (plain child move, identity scale)', () => {
		// group-move.pptx COM ground truth: TestGroup off/ext=(3810000,1270000)/
		// (3175000,762000), chOff/chExt=(635000,635000)/(3175000,762000);
		// after Shape.GroupItems(1).Left += 40pt, PowerPoint writes
		// chOff/chExt=(1143000,635000)/(2667000,762000) and off/ext=
		// (4318000,1270000)/(2667000,762000).
		const owner = group({
			x: 400, // unused: xEmu/widthEmu take priority
			y: 133,
			width: 333,
			height: 80,
			xEmu: 3810000,
			yEmu: 1270000,
			widthEmu: 3175000,
			heightEmu: 762000,
			chOffXEmu: 635000,
			chOffYEmu: 635000,
			chExtWidthEmu: 3175000,
			chExtHeightEmu: 762000,
		});
		const result = rewrapGroupOwnBox(
			owner,
			{ chOffXEmu: 1143000, chOffYEmu: 635000, chExtWidthEmu: 2667000, chExtHeightEmu: 762000 },
			EMU_PER_PX,
		);
		expect(result).toStrictEqual({
			offXEmu: 4318000,
			offYEmu: 1270000,
			extWidthEmu: 2667000,
			extHeightEmu: 762000,
		});
	});

	it('rotates the naive new center around the OLD center when the group itself is rotated', () => {
		// group-rotgrp-base.pptx COM ground truth: same TestGroup as above but
		// with rot="1500000" (25 degrees). After the SAME child move, PowerPoint
		// writes chOff/chExt=(1095404,420310)/(2714596,976690) and
		// off/ext=(4294202,1162655)/(2714596,976690) - NOT the naive
		// translation the identity-rotation formula above would give.
		const owner = group({
			width: 3175000 / EMU_PER_PX, // unresized: matches widthEmu, so resolveXfrmEmu keeps the immutable ext
			height: 762000 / EMU_PER_PX,
			xEmu: 3810000,
			yEmu: 1270000,
			widthEmu: 3175000,
			heightEmu: 762000,
			chOffXEmu: 635000,
			chOffYEmu: 635000,
			chExtWidthEmu: 3175000,
			chExtHeightEmu: 762000,
			rotation: 25,
		});
		const result = rewrapGroupOwnBox(
			owner,
			{ chOffXEmu: 1095404, chOffYEmu: 420310, chExtWidthEmu: 2714596, chExtHeightEmu: 976690 },
			EMU_PER_PX,
		);
		expect(result.offXEmu).toBe(4294202);
		expect(result.offYEmu).toBe(1162655);
		expect(result.extWidthEmu).toBe(2714596);
		expect(result.extHeightEmu).toBe(976690);
	});

	it('keys scale/anchor off the CURRENT extent (not the immutable one) and anchors translation on the corner when the group is ALSO resized directly in the same save (matches combined-order-a.pptx COM ground truth exactly)', () => {
		// combined-order-a.pptx: TestGroup (same base as above) had
		// Shape.Width *= 1.5 and Shape.Height *= 1.2 applied FIRST (own
		// off/ext=(3810000,1270000)/(4762500,914400) at that point, chOff/chExt
		// untouched), THEN GroupItems(1) moved+resized, all in ONE session
		// before SaveAs. PowerPoint writes chOff/chExt=(973667,635000)/
		// (2836333,973667) and off/ext=(4318001,1270000)/(4254500,1168400) -
		// off.x is 4318001, NOT the 4318000 a center-round-tripped derivation
		// would give (see rewrapGroupOwnBox's corner-anchored translation).
		const owner = group({
			x: 400, // unused: xEmu takes priority for position
			y: 133,
			width: 4762500 / EMU_PER_PX, // CURRENT (post-resize) extent, diverges from widthEmu
			height: 914400 / EMU_PER_PX,
			xEmu: 3810000,
			yEmu: 1270000,
			widthEmu: 3175000, // IMMUTABLE original extent (unchanged by the resize)
			heightEmu: 762000,
			chOffXEmu: 635000,
			chOffYEmu: 635000,
			chExtWidthEmu: 3175000,
			chExtHeightEmu: 762000,
		});
		const result = rewrapGroupOwnBox(
			owner,
			{ chOffXEmu: 973667, chOffYEmu: 635000, chExtWidthEmu: 2836333, chExtHeightEmu: 973667 },
			EMU_PER_PX,
		);
		expect(result).toStrictEqual({
			offXEmu: 4318001,
			offYEmu: 1270000,
			extWidthEmu: 4254500,
			extHeightEmu: 1168400,
		});
	});

	it('uses the raw captured EMU as its anchor, never resolveXfrmEmu, so a NESTED group (whose .x/.y are parent-relative render pixels, not comparable to its own absolute .xEmu/.yEmu) still anchors correctly', () => {
		// A nested group sitting exactly at its parent's origin: .x/.y (parent-
		// relative pixels) read 0, but .xEmu/.yEmu (its own absolute original
		// a:off) are 400000/2100000 - the two frames disagree by construction.
		// Anchoring on resolveXfrmEmu(0, 400000, ...) would treat the group as
		// "moved to x=0" and silently discard the correct pivot.
		const owner = group({
			x: 0,
			y: 0,
			width: 441, // 4200000 / 9525, matches widthEmu so resolveXfrmEmu WOULD wrongly pass here on width
			height: 63,
			xEmu: 400000,
			yEmu: 2100000,
			widthEmu: 4200000,
			heightEmu: 600000,
			chOffXEmu: 400000,
			chOffYEmu: 2100000,
			chExtWidthEmu: 4200000,
			chExtHeightEmu: 600000,
		});
		const result = rewrapGroupOwnBox(
			owner,
			{ chOffXEmu: 781000, chOffYEmu: 2100000, chExtWidthEmu: 3819000, chExtHeightEmu: 600000 },
			EMU_PER_PX,
		);
		// Matches the integration test's GroupC-inner ground truth exactly.
		expect(result).toStrictEqual({
			offXEmu: 781000,
			offYEmu: 2100000,
			extWidthEmu: 3819000,
			extHeightEmu: 600000,
		});
	});
});

describe('resolveGroupTightRewrap', () => {
	const baseGroup = (): GroupPptxElement =>
		group({
			width: 3175000 / EMU_PER_PX, // matches widthEmu: resolveXfrmEmu sees no direct resize
			height: 762000 / EMU_PER_PX,
			xEmu: 3810000,
			yEmu: 1270000,
			widthEmu: 3175000,
			heightEmu: 762000,
			chOffXEmu: 635000,
			chOffYEmu: 635000,
			chExtWidthEmu: 3175000,
			chExtHeightEmu: 762000,
			children: [
				shape({
					id: 'c1',
					x: 0,
					y: 0,
					width: 1270000 / EMU_PER_PX,
					height: 762000 / EMU_PER_PX,
					xEmu: 635000,
					yEmu: 635000,
					widthEmu: 1270000,
					heightEmu: 762000,
				}),
				shape({
					id: 'c2',
					// Relative to the group's chOff (635000): (2540000-635000)/9525 = 200.
					x: (2540000 - 635000) / EMU_PER_PX,
					y: 0,
					width: 1270000 / EMU_PER_PX,
					height: 762000 / EMU_PER_PX,
					xEmu: 2540000,
					yEmu: 635000,
					widthEmu: 1270000,
					heightEmu: 762000,
				}),
			],
		});

	it('returns undefined when no direct child changed (falls back to the preserved-verbatim path)', () => {
		expect(resolveGroupTightRewrap(baseGroup(), EMU_PER_PX)).toBeUndefined();
	});

	it('returns undefined when the group has no captured child space at all', () => {
		const g = baseGroup();
		expect(resolveGroupTightRewrap({ ...g, chExtWidthEmu: undefined }, EMU_PER_PX)).toBeUndefined();
	});

	it('has NO effect when a child is only rotated (never moved/resized): matches group-child-rotated.pptx COM ground truth', () => {
		const g = baseGroup();
		g.children[0] = { ...(g.children[0] as ShapePptxElement), rotation: 30 };
		expect(resolveGroupTightRewrap(g, EMU_PER_PX)).toBeUndefined();
	});

	it('tightly re-wraps chOff/chExt/off/ext after one child moves (matches group-move.pptx COM ground truth exactly)', () => {
		const g = baseGroup();
		// Shape.GroupItems(1).Left += 40pt (POWERPOINT POINTS, 12700 EMU each -
		// NOT CSS px): c1 moves from x=0 to x = 40*12700/9525 CSS px.
		g.children[0] = { ...(g.children[0] as ShapePptxElement), x: (40 * 12700) / EMU_PER_PX };
		const result = resolveGroupTightRewrap(g, EMU_PER_PX);
		expect(result).toStrictEqual({
			chOffXEmu: 1143000,
			chOffYEmu: 635000,
			chExtWidthEmu: 2667000,
			chExtHeightEmu: 762000,
			offXEmu: 4318000,
			offYEmu: 1270000,
			extWidthEmu: 2667000,
			extHeightEmu: 762000,
		});
	});

	it('propagates the re-wrap through a nested group to its parent (matches the nested-crafted COM ground truth)', () => {
		// InnerGroup(RectA, RectB) inside OuterGroup(InnerGroup, RectC), all at
		// scale 1. Moving RectA UP by 32 CSS px (304800 EMU) re-wraps
		// InnerGroup on the y axis, which changes ITS OWN box, which re-wraps
		// OuterGroup in turn (the x axis is untouched throughout).
		const inner: GroupPptxElement = group({
			id: 'inner',
			width: 1700000 / EMU_PER_PX, // matches widthEmu: no direct resize
			height: 500000 / EMU_PER_PX,
			xEmu: 0,
			yEmu: 0,
			widthEmu: 1700000,
			heightEmu: 500000,
			chOffXEmu: 0,
			chOffYEmu: 0,
			chExtWidthEmu: 1700000,
			chExtHeightEmu: 500000,
			children: [
				shape({
					id: 'rectA',
					x: 0,
					y: -32,
					width: 800000 / EMU_PER_PX,
					height: 500000 / EMU_PER_PX,
					xEmu: 0,
					yEmu: 0,
					widthEmu: 800000,
					heightEmu: 500000,
				}),
				shape({
					id: 'rectB',
					x: 900000 / EMU_PER_PX,
					y: 0,
					width: 800000 / EMU_PER_PX,
					height: 500000 / EMU_PER_PX,
					xEmu: 900000,
					yEmu: 0,
					widthEmu: 800000,
					heightEmu: 500000,
				}),
			],
		});
		const outer: GroupPptxElement = group({
			id: 'outer',
			width: 1700000 / EMU_PER_PX, // matches widthEmu: no direct resize
			height: 1100000 / EMU_PER_PX,
			xEmu: 3000000,
			yEmu: 1000000,
			widthEmu: 1700000,
			heightEmu: 1100000,
			chOffXEmu: 0,
			chOffYEmu: 0,
			chExtWidthEmu: 1700000,
			chExtHeightEmu: 1100000,
			children: [
				// The nested group's `x`/`y`/`width`/`height` are its ORIGINAL
				// (unmoved) parent-relative render values; only its DESCENDANTS
				// changed, which is exactly what this test exercises.
				{ ...inner, x: 0, y: 0, width: 1700000 / EMU_PER_PX, height: 500000 / EMU_PER_PX },
				shape({
					id: 'rectC',
					x: 0,
					y: 600000 / EMU_PER_PX,
					width: 800000 / EMU_PER_PX,
					height: 500000 / EMU_PER_PX,
					xEmu: 0,
					yEmu: 600000,
					widthEmu: 800000,
					heightEmu: 500000,
				}),
			],
		});

		// The INNER group's own re-wrap (matches nested-crafted2-moved.pptx's
		// InnerGroup box exactly).
		const innerMoved = outer.children[0] as GroupPptxElement;
		const innerRewrap = resolveGroupTightRewrap(innerMoved, EMU_PER_PX);
		expect(innerRewrap).toStrictEqual({
			chOffXEmu: 0,
			chOffYEmu: -304800,
			chExtWidthEmu: 1700000,
			chExtHeightEmu: 804800,
			offXEmu: 0,
			offYEmu: -304800,
			extWidthEmu: 1700000,
			extHeightEmu: 804800,
		});

		// The OUTER group sees its ONLY group child's box change and
		// propagates the SAME re-wrap up one level (matches
		// nested-crafted2-moved.pptx's OuterGroup box exactly).
		const outerRewrap = resolveGroupTightRewrap(outer, EMU_PER_PX);
		expect(outerRewrap).toStrictEqual({
			chOffXEmu: 0,
			chOffYEmu: -304800,
			chExtWidthEmu: 1700000,
			chExtHeightEmu: 1404800,
			offXEmu: 3000000,
			offYEmu: 695200,
			extWidthEmu: 1700000,
			extHeightEmu: 1404800,
		});
	});

	it('re-wraps a group that is BOTH resized directly AND has a child moved+resized in the same save (matches combined-order-a.pptx COM ground truth exactly, closing the "untested combination" gap)', () => {
		// combined-order-a.pptx: the base group (Width=250pt/Height=60pt at
		// scale 1) had Shape.Width *= 1.5, Shape.Height *= 1.2 applied FIRST
		// (own ext becomes 375pt/72pt, chOff/chExt/children untouched), THEN
		// GroupItems(1) (c1) was moved +40pt/+15pt and resized +10pt/+5pt in
		// absolute page points, all before ONE SaveAs. c1's resulting
		// relative-to-group px is the inverse of that absolute move through
		// the group's CURRENT (already-resized, 1.5x/1.2y) scale: e.g.
		// x = (40pt / 1.5) converted to EMU then px. c2 (untouched) keeps its
		// original relative-to-group px unchanged.
		const g = baseGroup();
		g.width = 4762500 / EMU_PER_PX; // group Width *= 1.5 (own ext, immutable widthEmu untouched)
		g.height = 914400 / EMU_PER_PX; // group Height *= 1.2
		g.children[0] = {
			...(g.children[0] as ShapePptxElement),
			x: (40 * 12700) / (1.5 * EMU_PER_PX),
			y: (15 * 12700) / (1.2 * EMU_PER_PX),
			width: (160 * 12700) / (1.5 * EMU_PER_PX),
			height: (77 * 12700) / (1.2 * EMU_PER_PX),
		};
		const result = resolveGroupTightRewrap(g, EMU_PER_PX);
		expect(result).toStrictEqual({
			chOffXEmu: 973667,
			chOffYEmu: 635000,
			chExtWidthEmu: 2836333,
			chExtHeightEmu: 973667,
			offXEmu: 4318001,
			offYEmu: 1270000,
			extWidthEmu: 4254500,
			extHeightEmu: 1168400,
		});
	});

	it('re-wraps a ROTATED group that is ALSO resized directly in the same save as a child move+resize (matches s1-combined-90.pptx COM ground truth exactly, closing the other "untested combination" gap)', () => {
		// s1-combined-90.pptx: a 90-degree-rotated TestGroup (two 100x60pt
		// rectangles side by side, base off/ext=(3810000,1270000)/
		// (3175000,762000), chOff/chExt=(635000,635000)/(3175000,762000)) had
		// `Shape.Width *= 1.5`/`Height *= 1.2` applied FIRST (own ext becomes
		// 4762500/914400, chOff/chExt/children untouched), THEN
		// GroupItems(1) (c1) moved +40pt/+15pt, all in ONE session before
		// SaveAs. PowerPoint writes chOff/chExt=(762000,211667)/
		// (3048000,1185333) and off/ext=(3289300,1828800)/(4572000,1422400) -
		// byte-exact at this right angle (see `group-tight-rewrap-own-box.ts`'s
		// module doc for why 25/other non-right angles land within 1 EMU of
		// COM instead).
		// c1's relative-to-group px is back-derived from its known resulting
		// child-space EMU (995609/599967 -> 762000/211667 for the 25 -> 90
		// degree decks; a ROTATED group's absolute-page Left/Top delta does
		// not map to a simple unscaled/unrotated-frame px delta the way an
		// UNROTATED group's does, so this inverts the KNOWN result instead of
		// re-deriving COM's own rotation-aware placement).
		const g = baseGroup();
		g.rotation = 90;
		g.width = 4762500 / EMU_PER_PX;
		g.height = 914400 / EMU_PER_PX;
		g.children[0] = {
			...(g.children[0] as ShapePptxElement),
			x: (762000 - 635000) / EMU_PER_PX,
			y: (211667 - 635000) / EMU_PER_PX,
			width: 1354667 / EMU_PER_PX,
			height: 814916 / EMU_PER_PX,
		};
		const result = resolveGroupTightRewrap(g, EMU_PER_PX);
		expect(result).toStrictEqual({
			chOffXEmu: 762000,
			chOffYEmu: 211667,
			chExtWidthEmu: 3048000,
			chExtHeightEmu: 1185333,
			offXEmu: 3289300,
			offYEmu: 1828800,
			extWidthEmu: 4572000,
			extHeightEmu: 1422400,
		});
	});

	it('re-wraps a ROTATED group that is ALSO resized directly in the same save as a child move+resize, within 1 EMU of s1-combined-25.pptx COM ground truth (an angle with irrational trig terms)', () => {
		// Same scenario as the 90-degree test above, but rotated 25 degrees
		// and with the child ALSO resized (+10pt/+5pt), matching
		// s1-combined-25.pptx exactly. COM: chOff/chExt=(995609,599967)/
		// (2814391,814916), off/ext=(4223350,1671539)/(4221587,977900). This
		// implementation lands on (4223351,1671539)/(4221587,977899): every
		// value byte-exact except off.x and ext.cy, each 1 EMU off (1/914400
		// inch) - see `group-tight-rewrap-own-box.ts`'s module doc for why
		// that residual is accepted (almost certainly PowerPoint's own trig
		// rounding at an irrational angle, not a formula error: the SAME
		// two-stage composition is byte-exact at the 90-degree right angle
		// above, where no irrational trig term is involved).
		// c1's relative-to-group px is back-derived from its known resulting
		// child-space EMU (995609/599967/1354667/814916) - see the 90-degree
		// test above for why this inverts the KNOWN result rather than
		// re-deriving COM's own rotation-aware absolute-page placement.
		const g = baseGroup();
		g.rotation = 25;
		g.width = 4762500 / EMU_PER_PX;
		g.height = 914400 / EMU_PER_PX;
		g.children[0] = {
			...(g.children[0] as ShapePptxElement),
			x: (995609 - 635000) / EMU_PER_PX,
			y: (599967 - 635000) / EMU_PER_PX,
			width: 1354667 / EMU_PER_PX,
			height: 814916 / EMU_PER_PX,
		};
		const result = resolveGroupTightRewrap(g, EMU_PER_PX);
		expect(result).toStrictEqual({
			chOffXEmu: 995609,
			chOffYEmu: 599967,
			chExtWidthEmu: 2814391,
			chExtHeightEmu: 814916,
			offXEmu: 4223351, // COM: 4223350 (1 EMU)
			offYEmu: 1671539, // COM: 1671539 (exact)
			extWidthEmu: 4221587, // COM: 4221587 (exact)
			extHeightEmu: 977899, // COM: 977900 (1 EMU)
		});
	});
});
