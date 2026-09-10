/**
 * Unit tests for `group-child-rotated-resize.ts`, using exact numbers
 * measured against real PowerPoint via COM automation (see the module doc).
 * Every deck here is an unrotated group (`TestGroup`, two 100x60pt
 * rectangles, base off/ext=(3810000,1270000)/(3175000,762000), chOff/chExt=
 * (635000,635000)/(3175000,762000) - so the group's own render scale is 1,
 * making child-space EMU numerically identical to render-relative EMU here)
 * whose FIRST child (`Rectangle 1`, at chOff exactly, so its render-relative
 * `x`/`y` is 0) is rotated then resized via `GroupItems(1).Width`/`Height`.
 *
 * `child.x`/`y` below are the NAIVE (pre-correction) render-relative-to-group
 * pixel position a Width/Height-only edit leaves in the model - UNCHANGED
 * from the child's old position (0,0), exactly like COM's own `Width`/
 * `Height` setters never moving `Left`/`Top`. The whole point of
 * {@link resolveRotatedChildResizeOffset} is to correct AWAY from that naive
 * value; feeding it the already-corrected position would be circular.
 */
import { describe, expect, it } from 'vitest';

import { resolveRotatedChildResizeOffset } from './group-child-rotated-resize';
import type { GroupChildSpaceOwner } from './group-xfrm-preservation';

const EMU_PER_PX = 9525;

const owner: GroupChildSpaceOwner = {
	chOffXEmu: 635000,
	chOffYEmu: 635000,
	chExtWidthEmu: 3175000,
	chExtHeightEmu: 762000,
	widthEmu: 3175000,
	heightEmu: 762000,
};

describe('resolveRotatedChildResizeOffset', () => {
	it('returns undefined when the child is not rotated', () => {
		const result = resolveRotatedChildResizeOffset(
			{
				x: 0,
				y: 0,
				width: 1524000 / EMU_PER_PX,
				height: 762000 / EMU_PER_PX,
				xEmu: 635000,
				yEmu: 635000,
				widthEmu: 1270000,
				heightEmu: 762000,
			},
			owner,
			EMU_PER_PX,
		);
		expect(result).toBeUndefined();
	});

	it('returns undefined when the old child-space EMU was never captured (SDK-created child)', () => {
		const result = resolveRotatedChildResizeOffset(
			{ x: 0, y: 0, width: 20, height: 20, rotation: 25 },
			owner,
			EMU_PER_PX,
		);
		expect(result).toBeUndefined();
	});

	it('returns undefined for a pure move (neither axis resized)', () => {
		const result = resolveRotatedChildResizeOffset(
			{
				x: 5,
				y: 5,
				width: 1270000 / EMU_PER_PX,
				height: 762000 / EMU_PER_PX,
				xEmu: 635000,
				yEmu: 635000,
				widthEmu: 1270000,
				heightEmu: 762000,
				rotation: 25,
			},
			owner,
			EMU_PER_PX,
		);
		expect(result).toBeUndefined();
	});

	it('matches COM exactly: 25deg child, Width only (s2b-widthonly-25.pptx)', () => {
		// COM: rotate Rectangle 1 25deg (no move), then Width += 20pt (no
		// sequential-step ambiguity: a single property change). PowerPoint
		// writes off=(623101,688673) ext=(1524000,762000).
		const result = resolveRotatedChildResizeOffset(
			{
				x: 0,
				y: 0,
				width: 1524000 / EMU_PER_PX,
				height: 762000 / EMU_PER_PX,
				xEmu: 635000,
				yEmu: 635000,
				widthEmu: 1270000,
				heightEmu: 762000,
				rotation: 25,
			},
			owner,
			EMU_PER_PX,
		);
		expect(result).toStrictEqual({ xEmu: 623101, yEmu: 688673 });
	});

	it('matches COM exactly: 90deg child, Width and Height together in one edit (s2-childresize-90.pptx)', () => {
		// COM: rotate Rectangle 1 90deg (no move), then Width += 20pt AND
		// Height += 12pt as two separate `GroupItems` property sets in the
		// SAME session. At this right angle the single-shot formula (both
		// axes resolved together, matching how this SDK's own editor applies
		// one resize as one final state) is byte-exact regardless: PowerPoint
		// writes off=(431800,685800) ext=(1524000,914400).
		const result = resolveRotatedChildResizeOffset(
			{
				x: 0,
				y: 0,
				width: 1524000 / EMU_PER_PX,
				height: 914400 / EMU_PER_PX,
				xEmu: 635000,
				yEmu: 635000,
				widthEmu: 1270000,
				heightEmu: 762000,
				rotation: 90,
			},
			owner,
			EMU_PER_PX,
		);
		expect(result).toStrictEqual({ xEmu: 431800, yEmu: 685800 });
	});

	it('matches COM exactly when Width and Height are set as two SEPARATE sequential properties at a non-right angle (s2-childresize-25.pptx)', () => {
		// COM: rotate Rectangle 1 25deg (no move), then Width += 20pt THEN
		// Height += 12pt as two separate `GroupItems` property sets.
		// PowerPoint writes off=(590897,681534) ext=(1524000,914400) - each
		// axis re-anchored against the ALREADY-WIDTH-RESIZED intermediate box
		// (COM's own live bounding-box refresh between the two calls, the
		// same "order A vs order B" distinction `group-tight-rewrap.ts`
		// documents for a group's own combined resize).
		// `resolveRotatedResizeOffset` (`rotated-resize-anchor.ts`) now
		// decomposes a both-axes resize into that SAME sequential
		// width-then-height composition internally, so this is byte-exact:
		// see the width-only/90-degree tests above for where a single-axis
		// resize was already exact, and this module's/`rotated-resize-anchor.ts`'s
		// doc for the 8-angle COM sweep that settled the general rule.
		const result = resolveRotatedChildResizeOffset(
			{
				x: 0,
				y: 0,
				width: 1524000 / EMU_PER_PX,
				height: 914400 / EMU_PER_PX,
				xEmu: 635000,
				yEmu: 635000,
				widthEmu: 1270000,
				heightEmu: 762000,
				rotation: 25,
			},
			owner,
			EMU_PER_PX,
		);
		expect(result).toStrictEqual({ xEmu: 590897, yEmu: 681534 });
	});

	// Fresh COM ground truth (8-angle sweep, unrotated group / owner scale 1,
	// TestGroup base as above but a fresh single-shape base group: child C1
	// off/ext=(1270000,1270000)/(1270000,762000), owner chOff/chExt=off/ext=
	// (1270000,1270000)/(3175000,762000)), rotate C1 by each angle then
	// `Width += 20pt` and `Height += 12pt` as two separate property sets, one
	// `SaveAs`. Settles {@link resolveRotatedResizeOffset}'s sequential
	// (width-then-height) decomposition as the GENERAL rule, not a
	// per-angle fix: byte-exact in all 8 cases.
	const sweepOwner: GroupChildSpaceOwner = {
		chOffXEmu: 1270000,
		chOffYEmu: 1270000,
		chExtWidthEmu: 3175000,
		chExtHeightEmu: 762000,
		widthEmu: 3175000,
		heightEmu: 762000,
	};

	it.each([
		{ angle: 25, xEmu: 1225897, yEmu: 1316534 },
		{ angle: 37, xEmu: 1198569, yEmu: 1331087 },
		{ angle: -40, xEmu: 1289268, yEmu: 1170539 },
		{ angle: 61, xEmu: 1137925, yEmu: 1341819 },
		{ angle: 113, xEmu: 1023235, yEmu: 1280930 },
		{ angle: 155, xEmu: 995695, yEmu: 1178412 },
		{ angle: 200, xEmu: 1049721, yEmu: 1078758 },
		{ angle: 290, xEmu: 1258042, yEmu: 1100521 },
	])(
		'matches COM exactly at $angle degrees, both axes resized in one edit (fresh 8-angle sweep)',
		({ angle, xEmu, yEmu }) => {
			const result = resolveRotatedChildResizeOffset(
				{
					x: 0,
					y: 0,
					width: 1524000 / EMU_PER_PX,
					height: 914400 / EMU_PER_PX,
					xEmu: 1270000,
					yEmu: 1270000,
					widthEmu: 1270000,
					heightEmu: 762000,
					rotation: angle,
				},
				sweepOwner,
				EMU_PER_PX,
			);
			expect(result).toStrictEqual({ xEmu, yEmu });
		},
	);
});
