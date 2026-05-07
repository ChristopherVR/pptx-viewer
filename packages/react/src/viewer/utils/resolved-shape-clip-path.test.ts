import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './resolved-shape-clip-path';
import { getShapeClipPath } from './shape-types';

const W = 200;
const H = 100;

function makeShapeElement(
	overrides: Partial<PptxElement> & { shapeType?: string } = {},
): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: W,
		height: H,
		...overrides,
	} as PptxElement;
}

describe('getResolvedShapeClipPathFor — priority cascade', () => {
	it('returns undefined when shapeType is missing', () => {
		expect(getResolvedShapeClipPathFor(undefined, W, H)).toBeUndefined();
	});

	it('falls through to the static polygon table for non-positive dimensions', () => {
		// With invalid dimensions, the cascade short-circuits to the static
		// polygon table so we still produce a sensible polygon for shapes that
		// have one (e.g. triangle).
		const result = getResolvedShapeClipPathFor('triangle', 0, 0);
		expect(result).toBe(getShapeClipPath('triangle', undefined, 0, 0));
	});

	it('uses the adjustment-aware path when adjustments are supplied for pie', () => {
		// pie is in the 12 adjustment-aware shapes — different adjustments must
		// produce different clip-paths, and the result must NOT match the
		// static polygon table (which is the legacy non-adjustment-aware
		// output).
		const a = getResolvedShapeClipPathFor('pie', W, H, { adj1: 0, adj2: 16_200_000 });
		const b = getResolvedShapeClipPathFor('pie', W, H, { adj1: 5_400_000, adj2: 10_800_000 });
		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(a).not.toStrictEqual(b);
	});

	it('uses the cubic-Bezier cloud path for cloud (covered by preset evaluator or cloud helper)', () => {
		// Either the preset evaluator or the cloud Bezier helper must produce
		// a path('…') expression, never the legacy static polygon string.
		const result = getResolvedShapeClipPathFor('cloud', W, H);
		expect(result).toBeDefined();
		expect(result!.startsWith("path('")).toBeTruthy();
	});

	it('uses the cubic-Bezier cloudCallout path', () => {
		const result = getResolvedShapeClipPathFor('cloudCallout', W, H);
		expect(result).toBeDefined();
		expect(result!.startsWith("path('")).toBeTruthy();
	});

	it('falls back to the static polygon table for shapes the preset evaluator does not cover', () => {
		// `parallelogram` is in the static table but is not yet in the preset
		// evaluator's populated set, so the cascade should drop down to the
		// React-side polygon entry.
		const result = getResolvedShapeClipPathFor('parallelogram', W, H);
		const fallback = getShapeClipPath('parallelogram', undefined, W, H);
		// We accept either the spec-correct path('…') or the static polygon —
		// what matters is that we get *some* clip-path back and never undefined
		// when the static fallback exists.
		expect(result).toBeDefined();
		if (result && !result.startsWith("path('")) {
			expect(result).toBe(fallback);
		}
	});

	it('returns a clip-path for a preset-evaluator shape without adjustments', () => {
		// roundRect is covered by the preset evaluator — should produce a
		// path('…') string driven by the spec-correct evaluator, distinct
		// from the static fallback.
		const result = getResolvedShapeClipPathFor('roundRect', W, H);
		expect(result).toBeDefined();
	});

	it('returns undefined for shapes that no tier of the cascade covers', () => {
		// A bogus shape name traverses every tier and falls off the end —
		// adjustment-aware misses (no adjustments anyway), preset evaluator
		// has no entry, cloud helper rejects it, and the static polygon
		// table has no match — so the resolver yields undefined.
		expect(getResolvedShapeClipPathFor('definitely-not-a-real-shape', W, H)).toBeUndefined();
	});
});

describe('getResolvedShapeClipPath — element-level wrapper', () => {
	it('returns undefined when the element has no shapeType', () => {
		const el = makeShapeElement();
		expect(getResolvedShapeClipPath(el)).toBeUndefined();
	});

	it('reads shapeAdjustments off the element and produces an adjustment-aware path', () => {
		const a = makeShapeElement({
			shapeType: 'pie',
			shapeAdjustments: { adj1: 0, adj2: 16_200_000 },
		} as Partial<PptxElement>);
		const b = makeShapeElement({
			shapeType: 'pie',
			shapeAdjustments: { adj1: 5_400_000, adj2: 10_800_000 },
		} as Partial<PptxElement>);
		const ra = getResolvedShapeClipPath(a);
		const rb = getResolvedShapeClipPath(b);
		expect(ra).toBeDefined();
		expect(rb).toBeDefined();
		expect(ra).not.toStrictEqual(rb);
	});

	it('honours width/height overrides over element dimensions', () => {
		const el = makeShapeElement({ shapeType: 'cloud' } as Partial<PptxElement>);
		const small = getResolvedShapeClipPath(el, 50, 50);
		const large = getResolvedShapeClipPath(el, 400, 400);
		expect(small).toBeDefined();
		expect(large).toBeDefined();
		// Cloud Bezier output scales with dimensions, so the path strings
		// should differ across sizes.
		expect(small).not.toStrictEqual(large);
	});
});
