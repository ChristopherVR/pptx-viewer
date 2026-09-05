/**
 * Regression coverage for gap G1: `PresetShapeGeometryDefinition.rect` (the
 * `a:rect` text-inset guides) was wrong for 117/194 presets, several
 * catastrophically (negative edges, guides that reference undefined variables
 * and silently resolve to 0, mirror bugs that collapse the rect to a
 * quarter-box). See `packages/shared/src/render/text-body-rect.ts`'s
 * `VERIFIED_TEXT_RECT_PRESETS` doc comment for the full audit trail.
 *
 * Expected values are PowerPoint ground truth: a probe deck of one AutoShape
 * per preset (200x100pt, zero body insets, no autofit) opened through COM,
 * with `TextFrame.TextRange.BoundLeft/Top/Width/Height` read under
 * left/right-aligned and top/bottom-anchored single-line configurations to
 * recover all four edges, then bias-corrected against a plain `rect` shape's
 * own (non-zero) font-metric measurement. See
 * `preset-text-rect-measurements.md` in the wave scratchpad for the full
 * measured table. Tolerance matches `VERIFIED_TEXT_RECT_PRESETS`'s own
 * inclusion bar: within 0.02 of the shape's own width/height.
 */
import { describe, expect, it } from 'vitest';

import { evaluatePresetShape } from './preset-shape-evaluator';

const W = 200;
const H = 100;
const TOL = 0.02;

function expectRect(
	name: string,
	expected: { l: number; t: number; r: number; b: number },
	width = W,
	height = H,
) {
	const evaluated = evaluatePresetShape(name, width, height);
	const rect = evaluated?.textRect;
	expect(rect, `${name}: no textRect evaluated`).toBeDefined();
	if (!rect) {
		return;
	}
	expect(Math.abs(rect.l - expected.l) / width, `${name}.l`).toBeLessThanOrEqual(TOL);
	expect(Math.abs(rect.t - expected.t) / height, `${name}.t`).toBeLessThanOrEqual(TOL);
	expect(Math.abs(rect.r - expected.r) / width, `${name}.r`).toBeLessThanOrEqual(TOL);
	expect(Math.abs(rect.b - expected.b) / height, `${name}.b`).toBeLessThanOrEqual(TOL);
}

describe('preset text rect (gap G1): COM-measured ground truth at 200x100pt', () => {
	it('ellipse insets each edge by (1 - cos45deg)/2 (~14.64%), not the full box', () => {
		expectRect('ellipse', { l: 29.29, t: 14.64, r: 170.66, b: 85.36 });
	});

	it('roundRect insets each edge by the fillet 45deg touch point (~2.44%)', () => {
		expectRect('roundRect', { l: 4.88, t: 4.88, r: 195.01, b: 95.12 });
	});

	it('diamond mirrors the inset off the far edge instead of the center guide', () => {
		expectRect('diamond', { l: 50, t: 25, r: 150, b: 75 });
	});

	it('pentagon no longer returns a NEGATIVE bottom edge', () => {
		const evaluated = evaluatePresetShape('pentagon', W, H);
		expect(evaluated?.textRect?.b).toBeGreaterThan(0);
		expectRect('pentagon', { l: 38.2, t: 23.61, r: 161.7, b: 100 });
	});

	it('heart no longer collapses to a single point (undefined 3wd4/3hd4 guides)', () => {
		expectRect('heart', { l: 33.33, t: 25, r: 166.58, b: 66.67 });
	});

	it('moon no longer collapses its bottom edge to 0 (undefined 3hd4 guide)', () => {
		expectRect('moon', { l: 29.29, t: 23.95, r: 99.92, b: 76.05 });
	});

	it('plus uses the full width (the wide arm), not the narrow vertical-arm span', () => {
		expectRect('plus', { l: 0, t: 25, r: 200, b: 75 });
	});

	it('flowChartDecision mirrors the inset off the far edge (same bug as diamond)', () => {
		expectRect('flowChartDecision', { l: 50, t: 25, r: 150, b: 75 });
	});

	it('snipRoundRect insets differently per corner treatment (chamfer vs fillet)', () => {
		expectRect('snipRoundRect', { l: 4.88, t: 4.88, r: 191.63, b: 100 });
	});

	// mathMultiply: a previous pass tried re-deriving this rect from the
	// path's own guides and gave up as not matching within tolerance. The
	// ECMA-376 `<a:rect>` element for this preset is its OWN dedicated
	// formula (not reused from the path), transcribed verbatim in
	// `preset-text-rect-quads.ts` and consulted by `preset-shape-evaluator.ts`
	// ahead of this table's `def.rect`; it matches the measured ground truth
	// (l=42.78, t=13.5, r=157.15, b=86.5) within the usual 0.02 tolerance.
	it('mathMultiply: the ECMA rect formula matches the measured ground truth', () => {
		expectRect('mathMultiply', { l: 42.78, t: 13.5, r: 157.15, b: 86.5 });
	});
});

describe('preset text rect: additional G1 fixes (triangle family, hexagon, round/snip family, math family)', () => {
	it('triangle rect sits on the base at half-height regardless of apex position', () => {
		expectRect('triangle', { l: 50, t: 50, r: 150, b: 100 });
	});

	it('rtTriangle rect uses twelfths of each dimension (right-angle breaks symmetry)', () => {
		expectRect('rtTriangle', { l: 16.67, t: 58.33, r: 116.67, b: 91.67 });
	});

	it('hexagon insets top/bottom by hd8, not the vertex y-coordinates', () => {
		expectRect('hexagon', { l: 25, t: 12.5, r: 175, b: 87.5 });
	});

	it('round1Rect insets only the affected (top-right) edge', () => {
		expectRect('round1Rect', { l: 0, t: 0, r: 195, b: 100 });
	});

	it('round2SameRect insets the shared top edge and both sides, not the bottom', () => {
		expectRect('round2SameRect', { l: 4.88, t: 4.88, r: 195.01, b: 100 });
	});

	it('round2DiagRect insets all four edges by the larger diagonal corner', () => {
		expectRect('round2DiagRect', { l: 4.88, t: 4.88, r: 195.01, b: 95.12 });
	});

	it('snip1Rect insets by exactly half the chamfer leg (the tight value)', () => {
		expectRect('snip1Rect', { l: 0, t: 8.33, r: 191.62, b: 100 });
	});

	it('snip2SameRect insets the shared top edge and both sides, not the bottom', () => {
		expectRect('snip2SameRect', { l: 8.33, t: 8.33, r: 191.58, b: 100 });
	});

	it('snip2DiagRect insets all four edges by the larger diagonal chamfer', () => {
		expectRect('snip2DiagRect', { l: 8.33, t: 8.33, r: 191.58, b: 91.67 });
	});

	it('mathPlus/mathMinus/mathDivide share a fixed max-adj1 horizontal inset', () => {
		expectRect('mathPlus', { l: 26.51, t: 38.24, r: 173.38, b: 61.76 });
		expectRect('mathMinus', { l: 26.51, t: 38.24, r: 173.38, b: 61.76 });
		expectRect('mathDivide', { l: 26.51, t: 38.24, r: 173.38, b: 61.76 });
	});

	it('mathEqual/mathNotEqual share the same horizontal inset plus a 2.5x-gap vertical inset', () => {
		expectRect('mathEqual', { l: 26.51, t: 20.6, r: 173.38, b: 79.4 });
		expectRect('mathNotEqual', { l: 26.51, t: 20.6, r: 173.38, b: 79.4 });
	});

	// parallelogram/trapezoid: a previous pass measured these (see
	// `preset-text-rect-measurements.md` in the wave-2 scratchpad) but could
	// not reproduce them from a "largest inscribed rectangle" re-derivation
	// off the path's own skew guide (`x3`/`x1`). The ECMA `<a:rect>` element
	// for both is its own dedicated q1/q2 scale-factor formula (not reused
	// from the path), transcribed verbatim in `preset-text-rect-quads.ts`; it
	// matches the measured ground truth within the usual 0.02 tolerance,
	// including the "uniform inset on all 4 sides" fact the prior pass could
	// not otherwise explain.
	it('parallelogram: the ECMA rect formula matches the measured ground truth (uniform 4-side inset)', () => {
		expectRect('parallelogram', { l: 27.08, t: 13.54, r: 172.83, b: 86.46 });
	});

	it('trapezoid: the ECMA rect formula matches the measured ground truth (bottom edge stays full-width)', () => {
		expectRect('trapezoid', { l: 16.67, t: 8.33, r: 183.29, b: 100 });
	});
});

// Wave 2 follow-up (2026-09): every remaining ECMA-transcribed preset in
// preset-text-rect-table.ts (93 total, incl. the three above) was COM-measured
// and matched within tolerance; see preset-text-rect-w2-measured.json in the
// wave scratchpad for the full set. This block pins a representative sample
// spanning every family the table covers, so a mistranscription in any of
// them regresses here.
describe('preset text rect: wave 2 ECMA-transcribed presets, COM-verified', () => {
	it('leftRightArrow rect sits between the two arrowhead bases', () => {
		expectRect('leftRightArrow', { l: 25, t: 25, r: 175, b: 75 });
	});

	it('bracePair insets uniformly by the fillet touch point on all four sides', () => {
		expectRect('bracePair', { l: 10.77, t: 10.77, r: 189.15, b: 97.56 });
	});

	it('wedgeRoundRectCallout insets like a roundRect, ignoring the callout tail', () => {
		expectRect('wedgeRoundRectCallout', { l: 4.88, t: 4.88, r: 195.01, b: 95.12 });
	});

	it('circularArrow insets to the ring, not the tail/head extensions', () => {
		expectRect('circularArrow', { l: 33.71, t: 19.06, r: 166.21, b: 80.94 });
	});

	it('flowChartMagneticDisk insets top/bottom to the drum band, full width', () => {
		expectRect('flowChartMagneticDisk', { l: 0, t: 33.33, r: 200, b: 83.33 });
	});

	it('cloud insets by its fixed 21600-unit puff fractions', () => {
		expectRect('cloud', { l: 27.56, t: 15.1, r: 158.19, b: 80.26 });
	});

	it("pie uses the corrected (non-verbatim) idx/idy inset, not the spec's broken t/r swap", () => {
		expectRect('pie', { l: 29.29, t: 14.64, r: 170.66, b: 85.36 });
	});

	it('heptagon insets by its hf/vf-corrected vertex projection', () => {
		expectRect('heptagon', { l: 19.81, t: 19.81, r: 180.18, b: 80.19 });
	});

	it('ellipseRibbon insets to the band under its scalloped fold', () => {
		expectRect('ellipseRibbon', { l: 50, t: 25, r: 150, b: 96.88 });
	});

	it('star8 insets to its inner vertex span', () => {
		expectRect('star8', { l: 30.71, t: 15.35, r: 169.21, b: 84.65 });
	});

	it('cornerTabs insets by its mod-based corner fraction', () => {
		expectRect('cornerTabs', { l: 11.18, t: 11.18, r: 188.81, b: 88.82 });
	});

	it('nonIsoscelesTrapezoid insets each side independently off adj1/adj2', () => {
		expectRect('nonIsoscelesTrapezoid', { l: 16.67, t: 8.33, r: 183.29, b: 100 });
	});
});
