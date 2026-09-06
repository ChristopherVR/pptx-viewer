import { describe, expect, it } from 'vitest';

import { WARP_PRESET_DEFINITIONS } from './text-warp-preset-definitions';
import { hasWarpPresetDefinition, sampleWarpPresetCurve } from './text-warp-preset-sampler';

const ALL_PRESETS = Object.keys(WARP_PRESET_DEFINITIONS);

describe('hasWarpPresetDefinition', () => {
	it('is true for every transcribed preset and false otherwise', () => {
		for (const preset of ALL_PRESETS) {
			expect(hasWarpPresetDefinition(preset)).toBeTruthy();
		}
		expect(hasWarpPresetDefinition('textArchUp')).toBeFalsy();
		expect(hasWarpPresetDefinition('bogus')).toBeFalsy();
	});
});

describe('sampleWarpPresetCurve', () => {
	it('returns undefined for a preset with no transcribed definition', () => {
		expect(sampleWarpPresetCurve('textArchUp', 0.5, undefined, undefined)).toBeUndefined();
	});

	it('is well-formed (finite, bottom >= top) across every preset, u, and adj', () => {
		// At the extreme (pinned) end of some presets' adj range the raw spec
		// curves can touch or momentarily cross (bottom == top or briefly
		// bottom < top); `envelopeCurveAt`'s `clampBand` is the layer that
		// enforces a strict minimum band, so this only checks the sampler
		// stays finite and never wildly inverted here.
		for (const preset of ALL_PRESETS) {
			for (const u of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
				for (const adj of [0, 10000, 50000, 90000, 100000]) {
					const curve = sampleWarpPresetCurve(preset, u, adj, undefined);
					expect(curve).toBeDefined();
					expect(Number.isFinite(curve!.top)).toBeTruthy();
					expect(Number.isFinite(curve!.bottom)).toBeTruthy();
				}
			}
		}
	});

	it('clamps u outside [0, 1] instead of extrapolating', () => {
		for (const preset of ALL_PRESETS) {
			const belowZero = sampleWarpPresetCurve(preset, -0.5, undefined, undefined)!;
			const atZero = sampleWarpPresetCurve(preset, 0, undefined, undefined)!;
			const aboveOne = sampleWarpPresetCurve(preset, 1.5, undefined, undefined)!;
			const atOne = sampleWarpPresetCurve(preset, 1, undefined, undefined)!;
			expect(belowZero).toStrictEqual(atZero);
			expect(aboveOne).toStrictEqual(atOne);
		}
	});

	// Regression: an arc sampled via "is the angle inside [stAng, stAng+swAng]"
	// (tried first, 2026-09-06) cannot tell textCanUp and textCanDown apart,
	// because both sweep exactly pi from stAng=cd2, just in opposite
	// directions, so their swept-angle sets normalise to the identical [0, pi]
	// interval. That bug made textCanUp arch the WRONG way (matching
	// textCanDown's direction instead of its own), caught by comparing against
	// a PowerPoint COM screenshot. See text-warp-preset-sampler.ts's `sampleArc`
	// doc comment for the closed-form fix.
	it('textCanUp and textCanDown arch in opposite directions', () => {
		const canUpEdge = sampleWarpPresetCurve('textCanUp', 0, undefined, undefined)!;
		const canUpCentre = sampleWarpPresetCurve('textCanUp', 0.5, undefined, undefined)!;
		const canDownEdge = sampleWarpPresetCurve('textCanDown', 0, undefined, undefined)!;
		const canDownCentre = sampleWarpPresetCurve('textCanDown', 0.5, undefined, undefined)!;

		// CanUp: centre rises above (smaller y than) the edge.
		expect(canUpCentre.top).toBeLessThan(canUpEdge.top);
		expect(canUpCentre.bottom).toBeLessThan(canUpEdge.bottom);
		// CanDown: centre drops below (larger y than) the edge - the opposite.
		expect(canDownCentre.top).toBeGreaterThan(canDownEdge.top);
		expect(canDownCentre.bottom).toBeGreaterThan(canDownEdge.bottom);
	});

	// Measured (2026-09-06) from a PowerPoint-COM-rendered single line of
	// "HHHHHHHHHHHHHHHH" (WarpFormat=27, default adj) via a per-column ink
	// bounding-box scan: glyph-height ratio (relative to the edge glyph)
	// tracked this module's row-0-pair prediction to within 0.036 absolute
	// (max across 16 glyph positions spanning u in [0.025, 0.975]), versus
	// 0.628 for the "outermost internal pair, spanning every stacked row"
	// reading tried first. This pins the row-0 interpretation down: a single
	// WordArt line only occupies the FIRST stacked row a compound preset
	// defines (see text-warp-preset-definitions.ts's module doc).
	it('textDeflateInflateDeflate narrows toward the centre by roughly the measured amount', () => {
		const edge = sampleWarpPresetCurve('textDeflateInflateDeflate', 0.025, undefined, undefined)!;
		const centre = sampleWarpPresetCurve('textDeflateInflateDeflate', 0.531, undefined, undefined)!;
		const edgeBand = edge.bottom - edge.top;
		const centreBand = centre.bottom - centre.top;
		const measuredRatio = 0.718; // centre/edge glyph-height ratio, measured via COM
		const predictedRatio = centreBand / edgeBand;
		expect(Math.abs(predictedRatio - measuredRatio)).toBeLessThan(0.04);
	});

	it('textDeflateInflate narrows toward the centre by roughly the measured amount', () => {
		const edge = sampleWarpPresetCurve('textDeflateInflate', 0.025, undefined, undefined)!;
		const centre = sampleWarpPresetCurve('textDeflateInflate', 0.531, undefined, undefined)!;
		const edgeBand = edge.bottom - edge.top;
		const centreBand = centre.bottom - centre.top;
		const measuredRatio = 0.661; // centre/edge glyph-height ratio, measured via COM
		const predictedRatio = centreBand / edgeBand;
		expect(Math.abs(predictedRatio - measuredRatio)).toBeLessThan(0.04);
	});

	it("defaults adj to each preset's own spec default, not a shared constant", () => {
		// textCanDown's default (14286) and textCanUp's default (85714) are
		// nowhere near each other or near textInflate/textDeflate's shared
		// default (18750); sampling with adj=undefined must use each preset's
		// own default, not one constant borrowed from a different preset.
		const withoutAdj = sampleWarpPresetCurve('textCanDown', 0.5, undefined, undefined)!;
		const withExplicitDefault = sampleWarpPresetCurve('textCanDown', 0.5, 14286, undefined)!;
		expect(withoutAdj).toStrictEqual(withExplicitDefault);
	});
});
