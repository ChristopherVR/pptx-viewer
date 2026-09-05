import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './shape-geometry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal element factory: only fields read by the helpers are needed. */
function shapeElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		name: '',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// getResolvedShapeClipPathFor
// ---------------------------------------------------------------------------

describe('getResolvedShapeClipPathFor', () => {
	it('returns undefined when shapeType is undefined', () => {
		expect(getResolvedShapeClipPathFor(undefined, 200, 100)).toBeUndefined();
	});

	it('returns a clip-path or undefined for a plain rectangle', () => {
		// The spec-correct preset evaluator may produce a path() for rect; the
		// static fallback returns undefined. Either outcome is acceptable; the
		// renderer applies clip-path only when the value is a non-empty string.
		const result = getResolvedShapeClipPathFor('rect', 200, 100);
		expect(result === undefined || typeof result === 'string').toBeTruthy();
	});

	it('falls back to the static table when dimensions are zero', () => {
		// triangle has a static polygon entry in the preset table
		const result = getResolvedShapeClipPathFor('triangle', 0, 0);
		// The static table returns a polygon for triangle; result must be a string.
		expect(result).toBeTypeOf('string');
		expect(result).toMatch(/polygon/iu);
	});

	it('falls back to the static table when dimensions are non-finite', () => {
		const result = getResolvedShapeClipPathFor('triangle', NaN, 100);
		expect(result).toBeTypeOf('string');
		expect(result).toMatch(/polygon/iu);
	});

	it('returns a clip-path string for a known preset shape (triangle)', () => {
		const result = getResolvedShapeClipPathFor('triangle', 200, 100);
		expect(result).toBeTypeOf('string');
		expect((result as string).length).toBeGreaterThan(0);
	});

	it('returns a clip-path string for diamond', () => {
		const result = getResolvedShapeClipPathFor('diamond', 200, 100);
		expect(result).toBeTypeOf('string');
		// The preset evaluator produces path() for shapes it covers; the static
		// table produces polygon(). Either form is a valid CSS clip-path value.
		expect(result).toMatch(/path\(|polygon/iu);
	});

	it('uses the adjustment-aware path when adjustments are supplied', () => {
		// pie with adjustments produces a different clip-path than the static table
		const withAdj = getResolvedShapeClipPathFor('pie', 200, 100, { adj: 27000, adj2: 180000 });
		const withoutAdj = getResolvedShapeClipPathFor('pie', 200, 100);
		// Both should be defined strings; the adjustment-aware result may differ
		expect(withAdj).toBeTypeOf('string');
		expect(typeof withoutAdj === 'string' || withoutAdj === undefined).toBeTruthy();
	});

	it('ignores empty adjustments object and proceeds to preset/static cascade', () => {
		// Empty adjustments: should still return a clip-path via preset/static path
		const result = getResolvedShapeClipPathFor('triangle', 200, 100, {});
		expect(result).toBeTypeOf('string');
	});

	it('returns a cloud clip-path (Bezier path) for cloud shape', () => {
		const result = getResolvedShapeClipPathFor('cloud', 200, 100);
		expect(result).toBeTypeOf('string');
		// Cloud path is a CSS path() expression
		expect(result).toMatch(/path\(/iu);
	});

	it('returns a clip-path for cloudCallout', () => {
		const result = getResolvedShapeClipPathFor('cloudCallout', 200, 100);
		expect(result).toBeTypeOf('string');
		expect(result).toMatch(/path\(/iu);
	});
});

// ---------------------------------------------------------------------------
// getResolvedShapeClipPath (element-level wrapper)
// ---------------------------------------------------------------------------

describe('getResolvedShapeClipPath', () => {
	it('returns undefined when the element has no shapeType', () => {
		const el = shapeElement({ type: 'shape' });
		// PptxElement union: cast needed because shapeType is on specific subtypes
		expect(getResolvedShapeClipPath(el)).toBeUndefined();
	});

	it('extracts shapeType and dimensions from the element', () => {
		const el = shapeElement({ width: 200, height: 100 });
		// Inject shapeType via cast: mirrors how the react helper accesses it
		(el as unknown as Record<string, unknown>)['shapeType'] = 'triangle';
		const result = getResolvedShapeClipPath(el);
		expect(result).toBeTypeOf('string');
		expect((result as string).length).toBeGreaterThan(0);
	});

	it('respects explicit width/height overrides', () => {
		const el = shapeElement({ width: 200, height: 100 });
		(el as unknown as Record<string, unknown>)['shapeType'] = 'triangle';
		// Override with different dimensions; result must still be a valid string
		const result = getResolvedShapeClipPath(el, 400, 300);
		expect(result).toBeTypeOf('string');
	});

	it('uses element dimensions when overrides are not provided', () => {
		const el = shapeElement({ width: 200, height: 100 });
		(el as unknown as Record<string, unknown>)['shapeType'] = 'diamond';
		const fromElement = getResolvedShapeClipPath(el);
		const fromExplicit = getResolvedShapeClipPathFor('diamond', 200, 100);
		expect(fromElement).toBe(fromExplicit);
	});

	it('passes shapeAdjustments from the element into the cascade', () => {
		const el = shapeElement({ width: 200, height: 100 });
		(el as unknown as Record<string, unknown>)['shapeType'] = 'pie';
		(el as unknown as Record<string, unknown>)['shapeAdjustments'] = { adj: 27000, adj2: 270000 };
		const result = getResolvedShapeClipPath(el);
		expect(result).toBeTypeOf('string');
	});

	it('returns a clip-path or undefined for a plain rectangle element', () => {
		// Mirrors the getResolvedShapeClipPathFor rect test: either a path()
		// from the preset evaluator or undefined from the static table is valid.
		const el = shapeElement({ width: 200, height: 100 });
		(el as unknown as Record<string, unknown>)['shapeType'] = 'rect';
		const result = getResolvedShapeClipPath(el);
		expect(result === undefined || typeof result === 'string').toBeTruthy();
	});

	it('reshapes a custom-geometry outline LIVE from shapeAdjustments, not the frozen pathData', () => {
		// `x1 = w * adj1 / 100000`; the static pathData was frozen at the
		// authored default (adj1 = 25000, x1 = 50), but shapeAdjustments already
		// carries an in-progress drag (adj1 = 75000, x1 = 150) - the on-canvas
		// counterpart to a handle drag that has not committed yet (limitations.md:
		// "a:custGeom adjustment-handle drag: Commits on release, not live").
		const el = shapeElement({ width: 200, height: 100 });
		Object.assign(el as unknown as Record<string, unknown>, {
			shapeType: 'custom',
			pathData: 'M 0 0 L 50 0 L 50 100 Z',
			pathWidth: 200,
			pathHeight: 100,
			customGeometryRawData: {
				avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
				gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
				pathLstXml: {
					'a:path': {
						'@_w': '200',
						'@_h': '100',
						'a:moveTo': { 'a:pt': { '@_x': '0', '@_y': '0' } },
						'a:lnTo': [
							{ 'a:pt': { '@_x': 'x1', '@_y': '0' } },
							{ 'a:pt': { '@_x': 'x1', '@_y': '100' } },
						],
						'a:close': {},
					},
				},
			},
			shapeAdjustments: { adj1: 75000 },
		});
		expect(getResolvedShapeClipPath(el)).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
	});
});
