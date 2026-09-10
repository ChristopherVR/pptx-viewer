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
	// SESSION 32: `resolveHierarchyOrientation` sets this to `generationGapRatio`
	// for every transposed hierarchy (SESSION 25's own substitution) - see this
	// field's own doc comment on `HierarchyOrientation`.
	hangHeightRatio: 0.2,
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

	it('session 32: when `orientation.hangHeightRatio` is `undefined` (the compound-text-role shape, `name-and-title-organization-chart--hier5.pptx`), falls back to the fixed HANG_HEIGHT_RATIO=0.55 - `generationGapRatio` alone is NOT used as a stand-in', () => {
		// `generationGapRatio` (0.42) deliberately differs from `HANG_HEIGHT_
		// RATIO` (0.55): if a regression fell back to `generationGapRatio`
		// instead of the fixed constant whenever `hangHeightRatio` is
		// `undefined`, `fanHeight` (and so `.shift`) would move away from this
		// independently-computed reference, built the SAME way
		// `computeHierarchyAxisPitches` itself builds `.yPitch` but with the
		// FIXED constant inlined explicitly.
		const nonTransposed: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
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

	it("session 28: `compositeHeightFactor` (half-circle-organization-chart--hier5.pptx's own declared shape) substitutes the composite cell's own (larger) height for the pitch's `itemSize`, not the smaller rendered item's `boxH` - reproduces the fixture's own cached ~197px row-to-row step (boxH=89, compositeHeightFactor=0.64 -> compositeH=139.0625, gap=139.0625*0.42=58.4, pitch=197.46)", () => {
		const cascadeOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			generationGapRatio: 0.42,
			compositeWidthFactor: 1,
			compositeHeightFactor: 0.64,
		};
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			cascadeOrientation,
			278,
			89,
			2,
			3,
			{ fannedGenerations: 2, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: true },
			true,
		);
		expect(yPitch.pitch).toBeCloseTo(197.46, 1);
	});

	it('session 28: `compositeHeightFactor` is NOT applied for `std` mode (`tailedPitch=false`) - `std` mode has its OWN, different composite correction on `compositeGenerationGapRatio` already; substituting `itemSize` too double-corrects (measured regression: circle-picture-hierarchy--hier5.pptx 3.38% -> 18.57%)', () => {
		const stdCascadeOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			generationGapRatio: 0.42,
			compositeGenerationGapRatio: 0.42,
			compositeWidthFactor: 1,
			compositeHeightFactor: 0.64,
		};
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			stdCascadeOrientation,
			278,
			89,
			2,
			3,
			{ fannedGenerations: 2, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: true },
			false,
		);
		// itemSize stays `boxH` (89): pitch = 89 + 89*0.42 = 126.38, NOT the
		// composite-height-based 197.46 the `tailedPitch=true` test above pins.
		expect(yPitch.pitch).toBeCloseTo(126.38, 1);
	});

	it("session 30: `cascadeReserveOffsetPx` (the declared cascade's own `alignOff` pixel nudge - see `smartart-hierarchy-cascade.ts`) replaces the hanging-tail INDENT reservation (`maxHangDepth*HIER_TAIL_OFFSET_RATIO*boxW`) in the fan-axis `fanWidth`, not add to it - real values from `half-circle-organization-chart--hier5.pptx` (`boxW=278.0004489049925`, `sibSpRatio=0.21`, `compositeWidthFactor=1`, `cascadeOffsetX.offsetPx=180.70029178824512`): fixes a ~56px (6.5% of the 867-wide diagram) uniform rightward `xPitch.shift` error that shifted EVERY generation (root included, since `.shift` feeds `translateResult`'s whole-result offset) - full corpus regen: half-circle 0.0646 -> 0.0019, zero regressions", () => {
		const cascadeOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.21,
			generationGapRatio: 0.42,
			compositeWidthFactor: 1,
			compositeHeightFactor: 0.64,
		};
		const { xPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			cascadeOrientation,
			278.0004489049925,
			88.9601436495976,
			2,
			3,
			{ fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 0, allChildrenHang: true },
			true,
			180.70029178824512,
		);
		expect(xPitch.shift).toBeCloseTo(6.77, 1);
	});

	it("session 30: `std` mode with NO declared `composite` wrapper (`compositeWidthFactor===undefined`, `labeled-hierarchy--hier5.pptx`'s own \"level1Shape direct\" shape) drops the fixed `GENERATION_MARGIN_RATIO` leading-margin bias to 0 - the fixture's own cached root sits FLUSH against the generation axis's leading edge (local y=0), not biased down by it; real values from the fixture (`boxH=130.75251428571428`, `compositeGenerationGapRatio=0.4`, `depth=3`) - before this fix `yPitch.shift` was `2.870243071428556` (root local y=29.02, a 5.44%-of-533 residual, matching the pre-session baseline exactly); after, `-8.08` (root local y=18.07, 3.4%)", () => {
		const noWrapperOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.3,
			generationGapRatio: 0.25,
			compositeGenerationGapRatio: 0.4,
		};
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			noWrapperOrientation,
			196.03075605054613,
			130.75251428571428,
			2,
			3,
			{ fannedGenerations: 3, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: false },
			false,
		);
		expect(yPitch.shift).toBeCloseTo(-8.08, 1);
	});

	it('session 30: `std` mode WITH a declared `composite` wrapper (`compositeWidthFactor` defined - `hierarchy--flat3/hier5/hier8.pptx`\'s own "3D card" shape) keeps the fixed `GENERATION_MARGIN_RATIO` margin unchanged - the session 30 guard is scoped to the NO-wrapper case only', () => {
		const withWrapperOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.1,
			generationGapRatio: 0.25,
			compositeGenerationGapRatio: 0.458,
			compositeWidthFactor: 0.9,
		};
		const boxH = 131;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			withWrapperOrientation,
			196,
			boxH,
			2,
			3,
			{ fannedGenerations: 3, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: false },
			false,
		);
		const reference = computeAxisPitch(
			533,
			boxH * GENERATION_MARGIN_RATIO,
			boxH,
			3,
			withWrapperOrientation.compositeGenerationGapRatio,
		);
		expect(yPitch.shift).toBeCloseTo(reference.shift, 6);
	});

	it('session 30: `tailedPitch` (org-chart family) with NO declared `composite` wrapper (plain `organization-chart--hier5.pptx`, `compositeWidthFactor` also undefined for a DIFFERENT structural reason) keeps the fixed `GENERATION_MARGIN_RATIO` margin unchanged too - the session 30 guard checks `!tailedPitch`, so it never fires for this family', () => {
		const tailedNoWrapperOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.21,
			generationGapRatio: 0.25,
			compositeGenerationGapRatio: 0.25,
			marginXRatio: 0,
			marginYRatio: 0,
		};
		const boxH = 139;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			tailedNoWrapperOrientation,
			278,
			boxH,
			2,
			2,
			{ fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 1, allChildrenHang: true },
			true,
		);
		const fanHeight = 533 - hangShape.maxHangRows * (1 + HANG_HEIGHT_RATIO) * boxH;
		const reference = computeAxisPitch(
			fanHeight,
			boxH * GENERATION_MARGIN_RATIO,
			boxH,
			2,
			tailedNoWrapperOrientation.compositeGenerationGapRatio,
		);
		expect(yPitch.shift).toBeCloseTo(reference.shift, 6);
	});

	it('session 30: `cascadeReserveOffsetPx` omitted (every non-cascade tailed fixture) leaves `fanWidth`/`xPitch` byte-identical to the pre-session hanging-tail-indent formula', () => {
		const cascadeOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.21,
			generationGapRatio: 0.42,
			compositeWidthFactor: 1,
			compositeHeightFactor: 0.64,
		};
		const { xPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			cascadeOrientation,
			278.0004489049925,
			88.9601436495976,
			2,
			3,
			{ fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 0, allChildrenHang: true },
			true,
		);
		expect(xPitch.shift).toBeCloseTo(62.37, 1);
	});

	it("session 31: `tailedPitch` with NO hanging tail at all (`hangShape.maxHangDepth===0`, `organization-chart--flat3.pptx`'s own 1-root-+-2-fanned-children shape - a purely-fanned tailed tree that never reaches `placeHangingForest`) drops the fixed `GENERATION_MARGIN_RATIO` leading-margin bias to 0, mirroring the session 30 `std`-mode no-wrapper guard: the fixture's own cached root/children row centres (local y=128/406, pitch=278.5) solve to `margin~=0`, not the ~33px `boxH*GENERATION_MARGIN_RATIO` the un-scoped condition applied (root landed 16px/3.0%-of-533 too far down before this fix; full corpus regen: 0.03 -> 0.0019, zero regressions)", () => {
		const noHangTailedOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.21,
			generationGapRatio: 0.42,
			compositeGenerationGapRatio: 0.42,
			marginXRatio: 0,
			marginYRatio: 0,
		};
		const boxH = 196.15384615384616;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			noHangTailedOrientation,
			392.3076923076923,
			boxH,
			2,
			2,
			{ fannedGenerations: 2, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: false },
			true,
		);
		const reference = computeAxisPitch(
			533,
			0,
			boxH,
			2,
			noHangTailedOrientation.compositeGenerationGapRatio,
		);
		expect(yPitch.shift).toBeCloseTo(reference.shift, 6);
		expect(yPitch.shift).toBeCloseTo(-12.04, 1);
	});

	it('session 31: `tailedPitch` WITH a hanging tail (`hangShape.maxHangDepth>=1`, plain `organization-chart--hier5.pptx`) keeps the fixed `GENERATION_MARGIN_RATIO` margin unchanged - the session 31 guard is scoped to `maxHangDepth===0` only', () => {
		const tailedWithHangOrientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			hangHeightRatio: undefined,
			sibSpRatio: 0.21,
			generationGapRatio: 0.42,
			compositeGenerationGapRatio: 0.42,
			marginXRatio: 0,
			marginYRatio: 0,
		};
		const boxH = 134.25692695214107;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			tailedWithHangOrientation,
			268.51385390428214,
			boxH,
			2,
			2,
			{ fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 1, allChildrenHang: true },
			true,
		);
		const fanHeight = 533 - (1 + HANG_HEIGHT_RATIO) * boxH;
		const reference = computeAxisPitch(
			fanHeight,
			boxH * GENERATION_MARGIN_RATIO,
			boxH,
			2,
			tailedWithHangOrientation.compositeGenerationGapRatio,
		);
		expect(yPitch.shift).toBeCloseTo(reference.shift, 6);
	});

	it("session 32: `orientation.hangHeightRatio` set (plain `organization-chart--hier5.pptx`, `hangHeightRatio=generationGapRatio=0.42` - what `resolveHierarchyOrientation` now actually produces for this fixture) reserves LESS `fanHeight` than the old fixed 0.55 did, landing the fixture EXACTLY: `boxH=138.80` (up from the pre-SESSION-32 `134.26`, matching cached `139` within rounding); `.shift` is `maxShift`-clamped (the un-gapped items alone plus the `n-0.5` gap already exceed the reduced `fanHeight`), not the smaller `centeredShift` - full gate regen confirms this reproduces the fixture's cached geometry to `maxDeltaFraction=0` exactly (was `0.0127`)", () => {
		const orgChartHier5Orientation: HierarchyOrientation = {
			...orientation,
			transposed: false,
			sibSpRatio: 0.21,
			generationGapRatio: 0.42,
			compositeGenerationGapRatio: 0.42,
			marginXRatio: 0,
			marginYRatio: 0,
			hangHeightRatio: 0.42,
		};
		const boxH = 138.80208333333334;
		const { yPitch } = computeHierarchyAxisPitches(
			{ width: 867, height: 533 },
			orgChartHier5Orientation,
			277.6041666666667,
			boxH,
			2,
			2,
			{ fannedGenerations: 2, maxHangDepth: 1, maxHangRows: 1, allChildrenHang: true },
			true,
		);
		expect(yPitch.pitch).toBeCloseTo(197.1, 1);
		expect(yPitch.shift).toBeCloseTo(-29.15, 1);
	});
});
