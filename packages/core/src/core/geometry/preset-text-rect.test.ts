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

	// mathMultiply: investigated but NOT fixed. The measured rect (l=42.78,
	// t=13.5, r=157.15, b=86.5) is asymmetric between axes in a way this
	// evaluator's `at2 w h`-rotated approximation doesn't reproduce, and no
	// simple reformulation tried matched within tolerance. It intentionally
	// stays OFF `VERIFIED_TEXT_RECT_PRESETS`; this test documents the current
	// (still-wrong) output so a future fix has a clear "was" baseline.
	it('mathMultiply remains unverified (documents current output, not correctness)', () => {
		const evaluated = evaluatePresetShape('mathMultiply', W, H);
		expect(evaluated?.textRect).toBeDefined();
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
});
