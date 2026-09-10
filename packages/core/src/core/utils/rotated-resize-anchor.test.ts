import { describe, expect, it } from 'vitest';

import { resolveRotatedResizeOffset } from './rotated-resize-anchor';

/**
 * Every EMU number here is COM ground truth: a group (two rectangles) or a
 * plain rectangle, rotated then resized in real PowerPoint via
 * `Shape.Width`/`Shape.Height`/`ScaleWidth`, unzipped and read back verbatim.
 * `naiveOffXEmu`/`naiveOffYEmu` is what the pre-existing rotation-unaware
 * `resolveXfrmEmu` per-axis resolve would have produced (the OLD `a:off` on
 * the untouched axis, `Math.round(px * EMU_PER_PX)` on the resized one).
 */
describe('resolveRotatedResizeOffset', () => {
	it('returns undefined when there is no rotation', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: undefined,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toBeUndefined();
	});

	it('returns undefined when the old box was never captured (SDK-created element)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: undefined,
			oldOffYEmu: undefined,
			oldExtWidthEmu: undefined,
			oldExtHeightEmu: undefined,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toBeUndefined();
	});

	it('returns undefined for a pure move (neither axis resized)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 3175000,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 4000000,
			naiveOffYEmu: 1400000,
		});
		expect(result).toBeUndefined();
	});

	// ── Group, 25 degrees: Width *= 1.5 (grp-a25-w) ─────────────────────────
	it('matches COM: 25deg group, Width only (grp-a25-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000, // Width-only naive resolve leaves x untouched
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3735632, offYEmu: 1605453 });
	});

	// ── Group, 25 degrees: Height *= 1.2 (grp-a25-h) ────────────────────────
	it('matches COM: 25deg group, Height only (grp-a25-h)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 3175000,
			newExtHeightEmu: 914400,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000, // Height-only naive resolve leaves y untouched
		});
		expect(result).toStrictEqual({ offXEmu: 3777796, offYEmu: 1262861 });
	});

	// ── Group, 25 degrees: both Width and Height (grp-a25-both) ─────────────
	it('matches COM: 25deg group, Width and Height together (grp-a25-both)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 914400,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3703428, offYEmu: 1598314 });
	});

	// ── Group, 90 degrees: Width only (grp-a90-w) ───────────────────────────
	it('matches COM: 90deg group, Width only (grp-a90-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 90,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3016250, offYEmu: 2063750 });
	});

	// ── Group, 180 degrees: Width only (grp-a180-w) ─────────────────────────
	it('matches COM: 180deg group, Width only (grp-a180-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 180,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 2222500, offYEmu: 1270000 });
	});

	// ── Group, -40 degrees (stored a:rot="-2400000"): Width only ────────────
	it('matches COM: -40deg group, Width only (grp-aneg40-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: -40,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3624298, offYEmu: 759787 });
	});

	// ── Plain (non-group) shape, 25/90/180/-40 degrees: Width only ──────────
	it('matches COM: 25deg plain shape, Width only (plain-a25-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 2540000,
			oldExtHeightEmu: 1016000,
			newExtWidthEmu: 3810000,
			newExtHeightEmu: 1016000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3750505, offYEmu: 1538363 });
	});

	it('matches COM: 90deg plain shape, Width only (plain-a90-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 90,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 2540000,
			oldExtHeightEmu: 1016000,
			newExtWidthEmu: 3810000,
			newExtHeightEmu: 1016000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3175000, offYEmu: 1905000 });
	});

	it('matches COM: 180deg plain shape, Width only (plain-a180-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: 180,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 2540000,
			oldExtHeightEmu: 1016000,
			newExtWidthEmu: 3810000,
			newExtHeightEmu: 1016000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 2540000, offYEmu: 1270000 });
	});

	it('matches COM: -40deg plain shape, Width only (plain-aneg40-w)', () => {
		const result = resolveRotatedResizeOffset({
			rotationDeg: -40,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 2540000,
			oldExtHeightEmu: 1016000,
			newExtWidthEmu: 3810000,
			newExtHeightEmu: 1016000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		expect(result).toStrictEqual({ offXEmu: 3661438, offYEmu: 861830 });
	});

	// ── ScaleFromMiddle: center exactly preserved, independent of rotation ──
	it('keeps the center exactly fixed for a center-anchored (ScaleFromMiddle) resize', () => {
		// naiveOffX moved by exactly -deltaWidth/2 (center-anchored naive resolve).
		const oldOff = 3810000;
		const oldExt = 3175000;
		const newExt = 4762500;
		const deltaWidth = newExt - oldExt;
		const naiveOffX = oldOff - deltaWidth / 2;
		for (const rotationDeg of [25, 90, 180, -40]) {
			const result = resolveRotatedResizeOffset({
				rotationDeg,
				oldOffXEmu: oldOff,
				oldOffYEmu: 1270000,
				oldExtWidthEmu: oldExt,
				oldExtHeightEmu: 762000,
				newExtWidthEmu: newExt,
				newExtHeightEmu: 762000,
				naiveOffXEmu: naiveOffX,
				naiveOffYEmu: 1270000,
			});
			// Same expected offX regardless of rotation: the center never moves.
			expect(result?.offXEmu).toBe(Math.round(oldOff + oldExt / 2 - newExt / 2));
			expect(result?.offYEmu).toBe(1270000 + 762000 / 2 - 762000 / 2);
		}
	});

	// ── Fresh 8-angle COM sweep: plain rotated shape, Width AND Height ──────
	// together in one edit (COM: `Shape.Width *= 1.5` then `Shape.Height *=
	// 1.2` as two separate property sets, one `SaveAs`). Base shape
	// off/ext=(1270000,1270000)/(1270000,762000); new ext=(1905000,914400)
	// on every angle. This is exactly the scenario `resolveRotatedResizeOffset`'s
	// sequential (width-then-height) decomposition targets - see the module
	// doc - and it is byte-exact in all 8 cases, settling the sequential
	// composition as the general rule rather than a per-angle fix.
	it.each([
		{ angle: 25, offXEmu: 1208049, offYEmu: 1397042 },
		{ angle: 37, offXEmu: 1160209, offYEmu: 1445732 },
		{ angle: -40, offXEmu: 1244699, offYEmu: 1048088 },
		{ angle: 61, offXEmu: 1039781, offYEmu: 1508434 },
		{ angle: 113, offXEmu: 758301, offYEmu: 1456286 },
		{ angle: 155, offXEmu: 632543, offYEmu: 1258920 },
		{ angle: 200, offXEmu: 680210, offYEmu: 1013604 },
		{ angle: 290, offXEmu: 1132696, offYEmu: 921510 },
	])(
		'matches COM exactly at $angle degrees, plain shape, Width and Height together (fresh 8-angle sweep)',
		({ angle, offXEmu, offYEmu }) => {
			const result = resolveRotatedResizeOffset({
				rotationDeg: angle,
				oldOffXEmu: 1270000,
				oldOffYEmu: 1270000,
				oldExtWidthEmu: 1270000,
				oldExtHeightEmu: 762000,
				newExtWidthEmu: 1905000,
				newExtHeightEmu: 914400,
				naiveOffXEmu: 1270000,
				naiveOffYEmu: 1270000,
			});
			expect(result).toStrictEqual({ offXEmu, offYEmu });
		},
	);

	it('reduces to the naive per-axis result at rotation 0 (no regression for unrotated resize)', () => {
		// At rot=0 the correction must be a no-op vs. whatever naive resolve produced.
		const result = resolveRotatedResizeOffset({
			rotationDeg: 0,
			oldOffXEmu: 3810000,
			oldOffYEmu: 1270000,
			oldExtWidthEmu: 3175000,
			oldExtHeightEmu: 762000,
			newExtWidthEmu: 4762500,
			newExtHeightEmu: 762000,
			naiveOffXEmu: 3810000,
			naiveOffYEmu: 1270000,
		});
		// rotationDeg 0 is falsy -> resolveRotatedResizeOffset returns undefined,
		// meaning callers keep the naive value verbatim (byte-identical to the
		// pre-existing unrotated behaviour).
		expect(result).toBeUndefined();
	});
});
