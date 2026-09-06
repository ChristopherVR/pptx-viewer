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

	it('is within 1 EMU of COM when Width and Height are set as two SEPARATE sequential properties at a non-right angle (s2-childresize-25.pptx)', () => {
		// COM: rotate Rectangle 1 25deg (no move), then Width += 20pt THEN
		// Height += 12pt as two separate `GroupItems` property sets.
		// PowerPoint writes off=(590897,681534) ext=(1524000,914400) - each
		// axis re-anchored against the ALREADY-WIDTH-RESIZED intermediate box
		// (COM's own live bounding-box refresh between the two calls, the
		// same "order A vs order B" distinction `group-tight-rewrap.ts`
		// documents for a group's own combined resize). This SDK's editor
		// applies one resize as ONE final state (never two live COM
		// snapshots), so the single-shot formula this module implements
		// lands 1 EMU off on EACH axis here - see the module doc for why
		// that residual is accepted, and the width-only/90-degree tests
		// above for where it is exact (no sequential-step ambiguity, or a
		// right angle with no irrational trig term).
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
		expect(result).toBeDefined();
		expect(Math.abs(result!.xEmu - 590897)).toBeLessThanOrEqual(1);
		expect(Math.abs(result!.yEmu - 681534)).toBeLessThanOrEqual(1);
	});
});
