import { describe, expect, it } from 'vitest';

import {
	envelopeCurveAt,
	GLYPH_ENVELOPE_PRESETS,
	hasGlyphEnvelope,
} from './text-warp-envelope-curves';

function bandWidth(preset: string, u: number, adj?: number): number {
	const curve = envelopeCurveAt(preset, u, adj);
	if (!curve) {
		throw new Error(`expected an envelope curve for ${preset}`);
	}
	return curve.bottom - curve.top;
}

describe('hasGlyphEnvelope', () => {
	it('is true for every classified envelope preset', () => {
		for (const preset of GLYPH_ENVELOPE_PRESETS) {
			expect(hasGlyphEnvelope(preset)).toBeTruthy();
		}
	});

	it('is false for a path-family preset, an unknown preset, and undefined', () => {
		expect(hasGlyphEnvelope('textArchUp')).toBeFalsy();
		expect(hasGlyphEnvelope('bogus')).toBeFalsy();
		expect(hasGlyphEnvelope(undefined)).toBeFalsy();
	});
});

// The expected numbers below come from evaluating presetTextWarpDefinitions.xml's
// own gdLst formulas by hand at each preset's default `adj` (see
// text-warp-preset-definitions.ts), not from the pre-2026-09-06 sine-lobe
// reconstruction; they are cross-checked against real PowerPoint COM
// screenshots in text-warp-preset-sampler.test.ts.
describe('envelopeCurveAt (spec-transcribed presets)', () => {
	it('returns undefined for a non-envelope preset', () => {
		expect(envelopeCurveAt('textArchUp', 0.5)).toBeUndefined();
	});

	it('textInflate: the band is widest at the horizontal centre', () => {
		const centre = bandWidth('textInflate', 0.5);
		const edge = bandWidth('textInflate', 0);
		expect(centre).toBeGreaterThan(edge);
		// a = pin(0, 18750, 20000) = 18750; edge band = 1 - 2*a/100000 = 0.625;
		// the cubic's symmetric control points make the centre band exactly 1
		// (it touches both box edges) regardless of adj.
		expect(edge).toBeCloseTo(0.625, 5);
		expect(centre).toBeCloseTo(1, 5);
	});

	it('textDeflate: the band is narrowest at the horizontal centre (mirrors textInflate)', () => {
		const centre = bandWidth('textDeflate', 0.5);
		const edge = bandWidth('textDeflate', 0);
		expect(centre).toBeLessThan(edge);
		expect(edge).toBeCloseTo(1, 5);
		expect(centre).toBeCloseTo(0.625, 5);
	});

	it('textInflateTop bulges only the top curve; the bottom stays flat at the box edge', () => {
		const curve = envelopeCurveAt('textInflateTop', 0.5)!;
		const edge = envelopeCurveAt('textInflateTop', 0)!;
		expect(curve.top).toBeLessThan(edge.top);
		expect(curve.bottom).toBeCloseTo(1, 10);
		expect(edge.bottom).toBeCloseTo(1, 10);
	});

	it('textInflateBottom bulges only the bottom curve; the top stays flat at the box edge', () => {
		const curve = envelopeCurveAt('textInflateBottom', 0.5)!;
		const edge = envelopeCurveAt('textInflateBottom', 0)!;
		expect(curve.bottom).toBeGreaterThan(edge.bottom);
		expect(curve.top).toBeCloseTo(0, 10);
		expect(edge.top).toBeCloseTo(0, 10);
	});

	it('textDeflateInflateDeflate narrows toward the centre, matching row 0 (a single WordArt line only occupies row 0 of the 3 stacked rows the preset defines)', () => {
		const edge = bandWidth('textDeflateInflateDeflate', 0);
		const centre = bandWidth('textDeflateInflateDeflate', 0.5);
		expect(centre).toBeLessThan(edge);
	});

	it('textDeflateInflate narrows toward the centre (row 0 of its 2 stacked rows)', () => {
		const edge = bandWidth('textDeflateInflate', 0);
		const centre = bandWidth('textDeflateInflate', 0.5);
		expect(centre).toBeLessThan(edge);
	});

	it('textCanUp arches both curves upward together, band width constant', () => {
		const centreCurve = envelopeCurveAt('textCanUp', 0.5)!;
		const edgeCurve = envelopeCurveAt('textCanUp', 0)!;
		expect(centreCurve.top).toBeLessThan(edgeCurve.top);
		expect(centreCurve.bottom).toBeLessThan(edgeCurve.bottom);
		expect(centreCurve.bottom - centreCurve.top).toBeCloseTo(edgeCurve.bottom - edgeCurve.top, 5);
	});

	it('textCanDown arches both curves downward together, band width constant', () => {
		const centreCurve = envelopeCurveAt('textCanDown', 0.5)!;
		const edgeCurve = envelopeCurveAt('textCanDown', 0)!;
		expect(centreCurve.top).toBeGreaterThan(edgeCurve.top);
		expect(centreCurve.bottom).toBeGreaterThan(edgeCurve.bottom);
		expect(centreCurve.bottom - centreCurve.top).toBeCloseTo(edgeCurve.bottom - edgeCurve.top, 5);
	});

	it('adj=0 is a true no-op for textInflate (flat, full-height band at every u)', () => {
		// a = pin(0, adj, 20000): adj=0 -> a=0 -> both curves sit exactly on the
		// box edges (t/b) for every u, so the band is uniformly 1 - flat, but
		// at FULL box height, not the arbitrary "nominal" band (0.7) the old
		// sine-lobe reconstruction assumed.
		expect(bandWidth('textInflate', 0, 0)).toBeCloseTo(1, 5);
		expect(bandWidth('textInflate', 0.5, 0)).toBeCloseTo(1, 5);
	});

	it('higher adj (toward its pin ceiling) makes textInflate bulge more, not less', () => {
		// The centre band is always 1 (the cubic's symmetric control points
		// make it touch both box edges regardless of adj); a higher `a`
		// narrows the EDGE band, which is what makes the edge-to-centre bulge
		// more pronounced as adj rises toward its pin ceiling (20000).
		const edgeAtDefault = bandWidth('textInflate', 0); // adj=18750 (default)
		const edgeAtCeiling = bandWidth('textInflate', 0, 20000);
		const edgeAtZero = bandWidth('textInflate', 0, 0);
		expect(edgeAtCeiling).toBeLessThan(edgeAtDefault);
		expect(edgeAtDefault).toBeLessThan(edgeAtZero);
	});

	it('never collapses (or inverts) the band, even at extreme adjust values', () => {
		for (const preset of GLYPH_ENVELOPE_PRESETS) {
			for (const u of [0, 0.25, 0.5, 0.75, 1]) {
				const curve = envelopeCurveAt(preset, u, 4 * 18750)!;
				expect(curve.bottom).toBeGreaterThan(curve.top);
				expect(curve.top).toBeGreaterThanOrEqual(0);
				expect(curve.bottom).toBeLessThanOrEqual(1);
			}
		}
	});

	it('is continuous and well-formed across the full adj domain for every preset', () => {
		for (const preset of GLYPH_ENVELOPE_PRESETS) {
			for (const adj of [0, 5000, 25000, 50000, 75000, 100000]) {
				for (const u of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
					const curve = envelopeCurveAt(preset, u, adj)!;
					expect(Number.isFinite(curve.top)).toBeTruthy();
					expect(Number.isFinite(curve.bottom)).toBeTruthy();
					expect(curve.bottom).toBeGreaterThan(curve.top);
				}
			}
		}
	});
});
