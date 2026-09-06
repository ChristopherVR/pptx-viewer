import type { PptxAttributeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveGeometryFormula, resolveGeometryStops } from './animation-attribute-geometry';
import type { AnimationElementBox } from './animation-render-context';

/** A shape's real rendered box (slide-fraction units): 30%/20% top-left, 20%x10% size. */
const TEST_BOX: AnimationElementBox = { height: 0.1, width: 0.2, x: 0.3, y: 0.2 };

describe('resolveGeometryFormula', () => {
	it('resolves a pure self-offset position formula to its constant delta', () => {
		expect(resolveGeometryFormula('translateX', '#ppt_x', 0)).toBe(0);
		expect(resolveGeometryFormula('translateX', '#ppt_x+.4', 0)).toBeCloseTo(0.4);
		expect(resolveGeometryFormula('translateY', '#ppt_y-0.25', 0)).toBeCloseTo(-0.25);
	});

	it('resolves a pure self-multiple scale formula to its ratio', () => {
		expect(resolveGeometryFormula('scaleX', '#ppt_w', 0)).toBe(1);
		expect(resolveGeometryFormula('scaleX', '#ppt_w*.05', 0)).toBeCloseTo(0.05);
		expect(resolveGeometryFormula('scaleY', '0', 0)).toBe(0);
	});

	it('resolves a fmla-driven position formula using the supplied $', () => {
		// Bounce ground truth: #ppt_y-sin(pi*$)/3, $=0.5 at the fmla stop.
		expect(resolveGeometryFormula('translateY', '#ppt_y-sin(pi*$)/3', 0.5)).toBeCloseTo(-1 / 3);
	});

	it('rejects a formula that depends on a DIFFERENT geometry variable (Grow And Turn from=)', () => {
		expect(resolveGeometryFormula('translateX', '-#ppt_w/2', 0)).toBeUndefined();
		expect(resolveGeometryFormula('translateX', '(-#ppt_w/2)', 0)).toBeUndefined();
	});

	it('rejects a scale formula with a non-zero constant term', () => {
		// Would need the real width to turn into a ratio (e.g. ppt_w + 10px).
		expect(resolveGeometryFormula('scaleX', '#ppt_w+0.1', 0)).toBeUndefined();
	});

	it('rejects a position formula whose own-axis slope is not 1', () => {
		expect(resolveGeometryFormula('translateX', '#ppt_x*2', 0)).toBeUndefined();
	});

	it('rejects a non-affine formula in its own axis', () => {
		expect(resolveGeometryFormula('translateX', 'sin(#ppt_x)', 0)).toBeUndefined();
	});

	describe('with the shape real box (Grow And Turn cross-axis formulas)', () => {
		// centre = (0.3 + 0.2/2, 0.2 + 0.1/2) = (0.4, 0.25).
		it('resolves a formula that depends on a DIFFERENT geometry variable', () => {
			// Grow And Turn's own `from="(-#ppt_w/2)"` on a `ppt_x` node: the
			// centre starts at -width/2 (half the shape's own width, negated),
			// which is a translateX delta of (-width/2) - centreX.
			expect(resolveGeometryFormula('translateX', '-#ppt_w/2', 0, TEST_BOX)).toBeCloseTo(-0.5);
			expect(resolveGeometryFormula('translateX', '(-#ppt_w/2)', 0, TEST_BOX)).toBeCloseTo(-0.5);
		});

		it('resolves a self-referencing "to" formula to a zero delta (lands on its own position)', () => {
			expect(resolveGeometryFormula('translateX', '(#ppt_x)', 1, TEST_BOX)).toBeCloseTo(0);
			expect(resolveGeometryFormula('translateY', '(#ppt_y)', 1, TEST_BOX)).toBeCloseTo(0);
		});

		it('agrees with the self-only (no-box) path for a self-only formula', () => {
			expect(resolveGeometryFormula('scaleX', '#ppt_w*.05', 0, TEST_BOX)).toBeCloseTo(0.05);
			expect(resolveGeometryFormula('translateY', '#ppt_y-0.25', 0, TEST_BOX)).toBeCloseTo(-0.25);
		});

		it('rejects when the box has zero size on the scaled axis (division by zero)', () => {
			expect(
				resolveGeometryFormula('scaleX', '#ppt_w*.05', 0, { ...TEST_BOX, width: 0 }),
			).toBeUndefined();
		});
	});
});

describe('resolveGeometryStops', () => {
	function tavComponent(
		attrName: string,
		stops: PptxAttributeAnimation['keyframes'],
	): PptxAttributeAnimation {
		return { attrName, keyframes: stops };
	}

	it('resolves a two-stop p:tavLst (Boomerang ground truth)', () => {
		const stops = resolveGeometryStops(
			'scaleX',
			tavComponent('ppt_w', [
				{ tm: 0, value: '#ppt_w', valueType: 'str' },
				{ tm: 100000, value: '#ppt_w*.05', valueType: 'str' },
			]),
		);
		expect(stops).toStrictEqual([
			{ progress: 0, value: 1 },
			{ progress: 1, value: 0.05 },
		]);
	});

	it('resolves a from/to component with no p:tavLst (Grow And Turn, self-only side)', () => {
		const stops = resolveGeometryStops('translateX', {
			attrName: 'ppt_x',
			from: '#ppt_x+.1',
			keyframes: [],
			to: '(#ppt_x)',
		});
		expect(stops).toStrictEqual([
			{ progress: 0, value: 0.1 },
			{ progress: 1, value: 0 },
		]);
	});

	it('rejects a from/to component whose from mixes axes (Grow And Turn ground truth)', () => {
		const stops = resolveGeometryStops('translateX', {
			attrName: 'ppt_x',
			from: '(-#ppt_w/2)',
			keyframes: [],
			to: '(#ppt_x)',
		});
		expect(stops).toBeUndefined();
	});

	it('rejects a by-only component that depends on real geometry (Grow And Turn wobble)', () => {
		const stops = resolveGeometryStops('translateX', {
			attrName: 'ppt_x',
			by: '(#ppt_h/3+#ppt_w*0.1)',
			keyframes: [],
		});
		expect(stops).toBeUndefined();
	});

	it('returns undefined when a component has no keyframes and no from/to/by', () => {
		expect(
			resolveGeometryStops('translateX', { attrName: 'ppt_x', keyframes: [] }),
		).toBeUndefined();
	});

	describe('with the shape real box (Grow And Turn cross-axis formulas)', () => {
		it('resolves a from/to component whose from mixes axes', () => {
			const stops = resolveGeometryStops(
				'translateX',
				{ attrName: 'ppt_x', from: '(-#ppt_w/2)', keyframes: [], to: '(#ppt_x)' },
				TEST_BOX,
			);
			expect(stops).toHaveLength(2);
			expect(stops?.[0]).toMatchObject({ progress: 0 });
			expect(stops?.[0]?.value).toBeCloseTo(-0.5);
			expect(stops?.[1]).toMatchObject({ progress: 1 });
			expect(stops?.[1]?.value).toBeCloseTo(0);
		});

		it('resolves a by-only component that depends on real geometry (Grow And Turn wobble)', () => {
			const stops = resolveGeometryStops(
				'translateX',
				{ attrName: 'ppt_x', by: '(#ppt_h/3+#ppt_w*0.1)', keyframes: [] },
				TEST_BOX,
			);
			// (0.1/3) + (0.2*0.1) = 0.0533...
			expect(stops).toHaveLength(2);
			expect(stops?.[0]).toStrictEqual({ progress: 0, value: 0 });
			expect(stops?.[1]?.progress).toBe(1);
			expect(stops?.[1]?.value).toBeCloseTo(0.1 / 3 + 0.02);
		});
	});
});
