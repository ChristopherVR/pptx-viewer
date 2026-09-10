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
		// inch). `resolveRotatedResizeOffset`'s "both axes resized in one
		// edit" fix (sequential, not simultaneous, per-axis composition -
		// see `rotated-resize-anchor.ts`'s module doc, closed by a fresh
		// 8-angle COM sweep) does NOT move this number at all: verified
		// identical before and after, since this residual survives a SECOND,
		// separate rotation composition (the tight-rewrap step itself) that
		// sequential decomposition does not reach. See
		// `group-tight-rewrap-own-box.ts`'s module doc for the fuller
		// writeup, including a ruled-out "unrounded pivot" alternative.
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

	// W7-E follow-up: fresh 8-angle x 3-edit-combo COM sweep (25, 37, -40, 61,
	// 113, 155, 200, 290 degrees; child move-only, resize-only, move+resize),
	// all in "group self-resize commits FIRST, child edit and its tight-rewrap
	// SECOND" order - see `group-tight-rewrap-own-box.ts`'s module doc for why
	// this is the only order this SDK's single-final-state architecture can
	// replay, and for the OTHER order's COM ground truth (which this fix
	// intentionally does not chase: differences there run into the tens of
	// thousands of EMU, not rounding noise).
	//
	// `rewrapGroupOwnBox`'s sequential self-resize (landed for the
	// plain-shape/group-child "both axes in one edit" gap) does NOT change
	// any of these 24 numbers: verified identical before/after. 9/24 are
	// byte-exact against COM; the rest are 1-2 EMU (<=2/914400 inch) off on
	// one or more of off.x/off.y/ext.cx/ext.cy, with no consistent sign or
	// axis - tried and rejected as the general fix: decomposing the
	// tight-rewrap step itself into two further sequential single-axis
	// corrections (order-independent, but only 6/24 exact - WORSE), an
	// unrounded self-resize pivot carried as a float into the tight-rewrap
	// (5/24 - also worse, and wrong on an already-exact unrotated case), and
	// float32 (single-precision) trig for every cos/sin in the pipeline (no
	// change at all: still 9/24). `expected` below pins this implementation's
	// CURRENT output (a regression test); `comDiff` documents the exact
	// COM ground truth so the residual is never approximated as "close
	// enough" - see the inline `// COM: (...)` on each row.
	it.each([
		{
			combo: 'move',
			angle: 25,
			tightBox: {
				chOffXEmu: 1364625,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3080375,
				chExtHeightEmu: 765232,
			},
			expected: { offXEmu: 1297897, offYEmu: 1628125, extWidthEmu: 4620563, extHeightEmu: 918278 },
			comDiff: [-1, 1, 0, 0],
		}, // COM: (1297898,1628124,4620563,918278)
		{
			combo: 'move',
			angle: 37,
			tightBox: {
				chOffXEmu: 1363095,
				chOffYEmu: 1248569,
				chExtWidthEmu: 3081905,
				chExtHeightEmu: 783431,
			},
			expected: { offXEmu: 1197630, offYEmu: 1751239, extWidthEmu: 4622858, extHeightEmu: 940117 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (1197631,1751239,4622858,940117)
		{
			combo: 'move',
			angle: -40,
			tightBox: {
				chOffXEmu: 1307647,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3137353,
				chExtHeightEmu: 870565,
			},
			expected: { offXEmu: 1225013, offYEmu: 708571, extWidthEmu: 4706030, extHeightEmu: 1044678 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (1225014,708571,4706030,1044678)
		{
			combo: 'move',
			angle: 61,
			tightBox: {
				chOffXEmu: 1348072,
				chOffYEmu: 1203091,
				chExtWidthEmu: 3096928,
				chExtHeightEmu: 828909,
			},
			expected: { offXEmu: 916475, offYEmu: 1916575, extWidthEmu: 4645392, extHeightEmu: 994691 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (916475,1916575,4645392,994691) EXACT
		{
			combo: 'move',
			angle: 113,
			tightBox: {
				chOffXEmu: 1275886,
				chOffYEmu: 1151903,
				chExtWidthEmu: 3169114,
				chExtHeightEmu: 880097,
			},
			expected: { offXEmu: 163880, offYEmu: 1855569, extWidthEmu: 4753671, extHeightEmu: 1056116 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (163880,1855569,4753671,1056116) EXACT
		{
			combo: 'move',
			angle: 155,
			tightBox: {
				chOffXEmu: 1211157,
				chOffYEmu: 1177314,
				chExtWidthEmu: 3233843,
				chExtHeightEmu: 854686,
			},
			expected: { offXEmu: -255969, offYEmu: 1436331, extWidthEmu: 4850765, extHeightEmu: 1025623 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (-255969,1436331,4850765,1025623) EXACT
		{
			combo: 'move',
			angle: 200,
			tightBox: {
				chOffXEmu: 1175960,
				chOffYEmu: 1256471,
				chExtWidthEmu: 3269040,
				chExtHeightEmu: 775529,
			},
			expected: { offXEmu: -250599, offYEmu: 874350, extWidthEmu: 4903560, extHeightEmu: 930635 },
			comDiff: [1, -2, -1, 1],
		}, // COM: (-250600,874352,4903561,930634)
		{
			combo: 'move',
			angle: 290,
			tightBox: {
				chOffXEmu: 1259178,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3185822,
				chExtHeightEmu: 879549,
			},
			expected: { offXEmu: 874717, offYEmu: 435201, extWidthEmu: 4778733, extHeightEmu: 1055459 },
			comDiff: [1, 0, 0, 0],
		}, // COM: (874716,435201,4778733,1055459)
		{
			combo: 'resize',
			angle: 25,
			tightBox: {
				chOffXEmu: 1270000,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: 1141959, offYEmu: 1593554, extWidthEmu: 4762500, extHeightEmu: 1016000 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (1141959,1593554,4762500,1016000) EXACT
		{
			combo: 'resize',
			angle: 37,
			tightBox: {
				chOffXEmu: 1270001,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3174999,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: 1033738, offYEmu: 1722118, extWidthEmu: 4762499, extHeightEmu: 1016000 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (1033738,1722118,4762499,1016000) EXACT
		{
			combo: 'resize',
			angle: -40,
			tightBox: {
				chOffXEmu: 1270000,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 846668,
			},
			expected: { offXEmu: 1165932, offYEmu: 730075, extWidthEmu: 4762500, extHeightEmu: 1016002 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (1165933,730075,4762500,1016002)
		{
			combo: 'resize',
			angle: 61,
			tightBox: {
				chOffXEmu: 1270000,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: 749991, offYEmu: 1898799, extWidthEmu: 4762500, extHeightEmu: 1016000 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (749992,1898799,4762500,1016000)
		{
			combo: 'resize',
			angle: 113,
			tightBox: {
				chOffXEmu: 1270000,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: 49203, offYEmu: 1824028, extWidthEmu: 4762500, extHeightEmu: 1016000 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (49204,1824028,4762500,1016000)
		{
			combo: 'resize',
			angle: 155,
			tightBox: {
				chOffXEmu: 1270000,
				chOffYEmu: 1269999,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: -296805, offYEmu: 1363353, extWidthEmu: 4762500, extHeightEmu: 1016000 },
			comDiff: [-1, 0, 0, 0],
		}, // COM: (-296804,1363353,4762500,1016000)
		{
			combo: 'resize',
			angle: 200,
			tightBox: {
				chOffXEmu: 1269999,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175001,
				chExtHeightEmu: 846668,
			},
			expected: { offXEmu: -226195, offYEmu: 752179, extWidthEmu: 4762502, extHeightEmu: 1016002 },
			comDiff: [0, -1, 0, 1],
		}, // COM: (-226195,752180,4762502,1016001)
		{
			combo: 'resize',
			angle: 290,
			tightBox: {
				chOffXEmu: 1269999,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175001,
				chExtHeightEmu: 846668,
			},
			expected: { offXEmu: 867069, offYEmu: 440555, extWidthEmu: 4762502, extHeightEmu: 1016002 },
			comDiff: [1, -1, 0, 1],
		}, // COM: (867068,440556,4762502,1016001)
		{
			combo: 'moveresize',
			angle: 25,
			tightBox: {
				chOffXEmu: 1364625,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3080375,
				chExtHeightEmu: 849899,
			},
			expected: { offXEmu: 1276428, offYEmu: 1623366, extWidthEmu: 4620563, extHeightEmu: 1019879 },
			comDiff: [-1, 2, 0, 1],
		}, // COM: (1276429,1623364,4620563,1019878)
		{
			combo: 'moveresize',
			angle: 37,
			tightBox: {
				chOffXEmu: 1363095,
				chOffYEmu: 1248569,
				chExtWidthEmu: 3081905,
				chExtHeightEmu: 846667,
			},
			expected: { offXEmu: 1174797, offYEmu: 1743599, extWidthEmu: 4622858, extHeightEmu: 1016000 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (1174797,1743599,4622858,1016000) EXACT
		{
			combo: 'moveresize',
			angle: -40,
			tightBox: {
				chOffXEmu: 1307647,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3137353,
				chExtHeightEmu: 955232,
			},
			expected: { offXEmu: 1257667, offYEmu: 696686, extWidthEmu: 4706030, extHeightEmu: 1146278 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (1257667,696686,4706030,1146278) EXACT
		{
			combo: 'moveresize',
			angle: 61,
			tightBox: {
				chOffXEmu: 1348072,
				chOffYEmu: 1203091,
				chExtWidthEmu: 3096928,
				chExtHeightEmu: 846666,
			},
			expected: { offXEmu: 907157, offYEmu: 1911086, extWidthEmu: 4645392, extHeightEmu: 1015999 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (907157,1911086,4645392,1015999) EXACT
		{
			combo: 'moveresize',
			angle: 113,
			tightBox: {
				chOffXEmu: 1275886,
				chOffYEmu: 1151902,
				chExtWidthEmu: 3169114,
				chExtHeightEmu: 880098,
			},
			expected: { offXEmu: 163880, offYEmu: 1855568, extWidthEmu: 4753671, extHeightEmu: 1056118 },
			comDiff: [-1, -1, 0, 1],
		}, // COM: (163881,1855569,4753671,1056117)
		{
			combo: 'moveresize',
			angle: 155,
			tightBox: {
				chOffXEmu: 1211157,
				chOffYEmu: 1177313,
				chExtWidthEmu: 3233843,
				chExtHeightEmu: 854687,
			},
			expected: { offXEmu: -255969, offYEmu: 1436331, extWidthEmu: 4850765, extHeightEmu: 1025624 },
			comDiff: [0, 0, 0, 0],
		}, // COM: (-255969,1436331,4850765,1025624) EXACT
		{
			combo: 'moveresize',
			angle: 200,
			tightBox: {
				chOffXEmu: 1175960,
				chOffYEmu: 1256472,
				chExtWidthEmu: 3269040,
				chExtHeightEmu: 846666,
			},
			expected: { offXEmu: -236000, offYEmu: 791559, extWidthEmu: 4903560, extHeightEmu: 1015999 },
			comDiff: [1, 0, -1, 0],
		}, // COM: (-236001,791559,4903561,1015999)
		{
			combo: 'moveresize',
			angle: 290,
			tightBox: {
				chOffXEmu: 1259178,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3185822,
				chExtHeightEmu: 964216,
			},
			expected: { offXEmu: 922453, offYEmu: 401776, extWidthEmu: 4778733, extHeightEmu: 1157059 },
			comDiff: [1, 1, 0, 0],
		}, // COM: (922452,401775,4778733,1157059)
	])(
		'rotated group self-resized (Width*=1.5, Height*=1.2) THEN child $combo at $angle degrees: matches this implementation and stays within the documented residual of COM',
		({ angle, tightBox, expected, comDiff }) => {
			const owner = {
				x: 0,
				y: 0,
				width: 4762500 / EMU_PER_PX,
				height: 914400 / EMU_PER_PX,
				xEmu: 1270000,
				yEmu: 1270000,
				widthEmu: 3175000,
				heightEmu: 762000,
				chOffXEmu: 1270000,
				chOffYEmu: 1270000,
				chExtWidthEmu: 3175000,
				chExtHeightEmu: 762000,
				rotation: angle,
			};
			const result = rewrapGroupOwnBox(owner, tightBox, EMU_PER_PX);
			expect(result).toStrictEqual(expected);
			// The residual against real COM ground truth never exceeds 2 EMU
			// (2/914400 inch) on any of the four values, in either direction.
			for (const diff of comDiff) {
				expect(Math.abs(diff)).toBeLessThanOrEqual(2);
			}
		},
	);

	// Follow-up COM experiment for the residual above: holds the FINAL child
	// position/size fixed and varies only the ORDER `GroupItems(1).Left` /
	// `Top` / `Width` / `Height` are assigned (same four target values, one
	// COM session, one `.Save()` - no separate "interactive steps", the
	// variable `group-tight-rewrap.ts`'s "order A vs order B" case already
	// covers). Fixture: a fresh two-rectangle group (children at 100,100,
	// 125,60pt and 225,100,125,60pt), rotated, then `Width *= 1.5` /
	// `Height *= 1.2`, then ONE child's `GroupItems(1)` moved+resized to
	// Left=130pt/Top=90pt/Width=140pt/Height=70pt via COM, in two orders.
	it('order sensitivity is real, not noise: PowerPoint live-refits per PROPERTY assignment, so "the same edit" has no single correct group a:ext (fresh COM ground truth)', () => {
		// 200 degrees, `Left,Top,Width,Height` order: COM a:ext cx="4333332" cy="948289".
		// 200 degrees, `Height,Width,Top,Left` order (same 4 final values, reversed
		// assignment order): COM a:ext cx="3743930" cy="1026821" - cx alone is
		// 589,402 EMU (0.64 inch) away from the first order's result.
		const angle200OrderLTWH = { cx: 4333332, cy: 948289 };
		const angle200OrderHWTL = { cx: 3743930, cy: 1026821 };
		expect(Math.abs(angle200OrderLTWH.cx - angle200OrderHWTL.cx)).toBeGreaterThan(500000);

		// 25 degrees, same two orders: COM a:ext cy="1029931" (LTWH) vs
		// cy="914400" (HWTL) - 115,531 EMU apart.
		const angle25OrderLTWH = { cy: 1029931 };
		const angle25OrderHWTL = { cy: 914400 };
		expect(Math.abs(angle25OrderLTWH.cy - angle25OrderHWTL.cy)).toBeGreaterThan(100000);

		// Re-running the SAME order at 200 degrees reproduces the SAME a:off/
		// a:ext to the byte (-236424,776303 / 4333332,948289 both times): this
		// is deterministic per-order, not COM jitter. The two orders are both
		// valid, both byte-exact expressions of PowerPoint's OWN model, and
		// disagree by hundreds of thousands of EMU - proving the <=2 EMU
		// residual in the `grp1st` sweep above (pinned against ONE such order's
		// ground truth) is not a latent rounding-order bug reachable by
		// refining this module's formula: there is no single-final-state
		// formula that reproduces PowerPoint here, because PowerPoint's own
		// result is not a pure function of the final state either. See
		// `group-tight-rewrap-own-box.ts`'s module doc for the full writeup.
	});
});
