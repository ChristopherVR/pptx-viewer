import { describe, expect, it } from 'vitest';

import { computeHierarchyAxisPitches } from './smartart-hierarchy-axis-pitch';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation';
import { computeAxisPitch, GENERATION_MARGIN_RATIO } from './smartart-hierarchy-pitch';
import { HANG_HEIGHT_RATIO } from './smartart-hierarchy-shared';

// horizontal-organization-chart--hier5.pptx's own shape (SESSION 25): a
// TRANSPOSED `tailed` hierarchy whose hang grows along the SAME axis the
// generic transpose maps to screen X, not the fixed vertical `HANG_HEIGHT_
// RATIO` gap plain (non-transposed) `organization-chart` uses. Real values
// from `resolveHierarchyOrientation(algorithmNode, index, 'tailed',
// 'rootText1')` against the genuine fixture; `boxH=255`/`boxW=77.77` are
// this fixture's own real (fixed) item box.
const orientation: HierarchyOrientation = {
	transposed: true,
	sibSpRatio: 0.125,
	aspectRatio: 3.278688524590164,
	generationGapRatio: 0.2,
	compositeGenerationGapRatio: 0.2,
	marginXRatio: 0,
	marginYRatio: 0,
	cardOffsetXRatio: 0,
};
const hangShape = { fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 1, allChildrenHang: true };

describe('computeHierarchyAxisPitches', () => {
	it('a transposed tailed hang shifts the fanned generation using generationGapRatio, not the fixed HANG_HEIGHT_RATIO=0.55 (horizontal-organization-chart--hier5.pptx shape)', () => {
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 533, height: 867 },
			orientation,
			77.77,
			255.0,
			2,
			2,
			hangShape,
			true,
		);
		// pitch = boxH + boxH*generationGapRatio = 255+51=306, independent of
		// `fanHeight` (a FIXED gap ratio, not solved-to-fill) - only `.shift`
		// carries the `fanHeight`/`hangHeightRatio` effect this test pins.
		expect(yPitch.pitch).toBeCloseTo(306, 0);
		// fanHeight=867-1*(1+0.2)*255=561; shift=(561-2*306+0)/2=-25.5 - the
		// value that landed "Node Two"/"Node Three" at the cached x=359
		// exactly (measured via the real fixture's own per-shape diagnostic).
		expect(yPitch.shift).toBeCloseTo(-25.5, 1);
	});

	it('a non-transposed tailed hang keeps the fixed HANG_HEIGHT_RATIO=0.55, unaffected by the SESSION 25 override (organization-chart--hier5.pptx shape)', () => {
		// `generationGapRatio` (0.42) deliberately differs from `HANG_HEIGHT_
		// RATIO` (0.55): if a regression reused it for `hangHeightRatio` the
		// way the transposed branch now deliberately does, `fanHeight` (and
		// so `.shift`) would move away from this independently-computed
		// reference, built the SAME way `computeHierarchyAxisPitches` itself
		// builds `.yPitch` but with the FIXED constant inlined explicitly.
		const nonTransposed: HierarchyOrientation = {
			...orientation,
			transposed: false,
			generationGapRatio: 0.42,
		};
		const boxW = 70;
		const boxH = 139;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			nonTransposed,
			boxW,
			boxH,
			2,
			2,
			hangShape,
			true,
		);
		const fanHeight = 533 - hangShape.maxHangRows * (1 + HANG_HEIGHT_RATIO) * boxH;
		const reference = computeAxisPitch(
			fanHeight,
			boxH * GENERATION_MARGIN_RATIO,
			boxH,
			2,
			nonTransposed.generationGapRatio,
		);
		expect(yPitch.shift).toBeCloseTo(reference.shift, 6);
	});
});
