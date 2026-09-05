import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildCustomGeometryClipPath,
	getResolvedShapeClipPath,
	getResolvedShapeClipPathFor,
} from './shape-geometry';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getResolvedShapeClipPathFor', () => {
	it('returns undefined when no shape type is given', () => {
		expect(getResolvedShapeClipPathFor(undefined, 100, 100)).toBeUndefined();
	});

	it('produces a clip-path for a known preset geometry', () => {
		const clip = getResolvedShapeClipPathFor('triangle', 120, 80);
		expect(clip).toBeTypeOf('string');
		expect(clip).not.toBe('');
	});

	it('falls back to the static table when dimensions are non-positive', () => {
		// With width/height <= 0 the evaluator can't run; the static table still
		// resolves a triangle to a polygon clip-path.
		const clip = getResolvedShapeClipPathFor('triangle', 0, 0);
		expect(clip).toBeTypeOf('string');
	});

	it('returns a path() expression for cloud at a measured size', () => {
		const clip = getResolvedShapeClipPathFor('cloud', 200, 120);
		expect(clip).toBeTypeOf('string');
		expect(clip).toContain('path(');
	});

	it('honours adjustment values for adjustable shapes', () => {
		const clip = getResolvedShapeClipPathFor('pie', 100, 100, { adj1: 0, adj2: 90 });
		expect(clip).toBeTypeOf('string');
	});

	// ── issue #132 ────────────────────────────────────────────────────────
	// The cascade used to enter step 1 through core's
	// `getAdjustmentAwareShapeClipPath`, whose own fallback is the STATIC,
	// adjustment-blind polygon table. For any preset outside the 14-shape
	// dynamic set that fallback was returned before the spec evaluator ever
	// ran, so an authored `a:avLst` was replaced by the preset's default.
	describe('adjustment-bearing presets outside the dynamic table', () => {
		it('clips a parallelogram with its OWN adj, not the 25000 default', () => {
			const clip = getResolvedShapeClipPathFor('parallelogram', 521, 720, { adj: 84929 });
			// The default polygon (`20% 0%, 100% 0%, 80% 100%, 0% 100%`) covers most
			// of the box; the authored value makes a thin diagonal band.
			expect(clip).not.toContain('polygon(');
			expect(clip).toContain('path(');
			const topEdgeX = Number(/L ([\d.]+) 0 /u.exec(String(clip))?.[1]);
			expect(topEdgeX / 521).toBeCloseTo(0.84929, 4);
		});

		it('moves with the adjustment rather than staying fixed', () => {
			const shallow = getResolvedShapeClipPathFor('parallelogram', 400, 200, { adj: 10000 });
			const steep = getResolvedShapeClipPathFor('parallelogram', 400, 200, { adj: 90000 });
			expect(shallow).not.toBe(steep);
		});

		it('applies an authored adj to trapezoid / teardrop / notchedRightArrow too', () => {
			for (const shapeType of ['trapezoid', 'teardrop', 'notchedRightArrow'] as const) {
				const authored = getResolvedShapeClipPathFor(shapeType, 200, 120, {
					adj: 60000,
					adj1: 60000,
					adj2: 60000,
				});
				const preset = getResolvedShapeClipPathFor(shapeType, 200, 120);
				expect({ shapeType, isPath: String(authored).startsWith('path(') }).toStrictEqual({
					shapeType,
					isPath: true,
				});
				expect({ shapeType, matchesDefault: authored === preset }).toStrictEqual({
					shapeType,
					matchesDefault: false,
				});
			}
		});

		it('still routes the dynamic-table shapes through their own builders', () => {
			// `blockArc` IS modelled dynamically; its polygon must keep winning, or
			// it degenerates to a two-point path from the preset evaluator.
			const clip = getResolvedShapeClipPathFor('blockArc', 284, 285, {
				adj1: 10800000,
				adj2: 10571,
				adj3: 14880,
			});
			expect(clip).toContain('polygon(');
		});
	});
});

describe('getResolvedShapeClipPath', () => {
	it('reads shapeType / dimensions off the element', () => {
		const clip = getResolvedShapeClipPath(shape({ shapeType: 'hexagon' }));
		expect(clip).toBeTypeOf('string');
	});

	it('returns undefined for an element without a shape type', () => {
		expect(getResolvedShapeClipPath(shape())).toBeUndefined();
	});

	it('accepts width / height overrides', () => {
		const el = shape({ shapeType: 'triangle' });
		const clip = getResolvedShapeClipPath(el, 300, 150);
		expect(clip).toBeTypeOf('string');
	});

	it('derives a rescaled clip-path from custom geometry (freeform)', () => {
		// A 596x666 path space rendered into a 149x166.5 px box scales by 0.25.
		const el = shape({
			shapeType: 'custom',
			width: 149,
			height: 166.5,
			pathData: 'M 0 0 L 596 0 L 596 666 Z',
			pathWidth: 596,
			pathHeight: 666,
		} as Partial<PptxElement>);
		const clip = getResolvedShapeClipPath(el);
		// Not the bounding rectangle: the freeform outline is clipped to its path.
		expect(clip).toBe("path('M 0 0 L 149 0 L 149 166.5 Z')");
	});

	it('prefers custom geometry over the preset table when both are present', () => {
		const el = shape({
			shapeType: 'rect',
			width: 100,
			height: 100,
			pathData: 'M 0 0 L 50 0 L 50 50 Z',
			pathWidth: 50,
			pathHeight: 50,
		} as Partial<PptxElement>);
		expect(getResolvedShapeClipPath(el)).toBe("path('M 0 0 L 100 0 L 100 100 Z')");
	});

	it('reshapes a custom-geometry freeform LIVE from an in-progress shapeAdjustments override (not just the static pathData)', () => {
		// `x1 = w * adj1 / 100000`; the static pathData was frozen at the
		// authored default adj1 = 25000 (x1 = 50), but a drag has already
		// pushed shapeAdjustments to adj1 = 75000 (x1 = 150) without saving.
		const rawData = {
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
		};
		const el = shape({
			shapeType: 'custom',
			width: 200,
			height: 100,
			pathData: 'M 0 0 L 50 0 L 50 100 Z',
			pathWidth: 200,
			pathHeight: 100,
			customGeometryRawData: rawData,
			shapeAdjustments: { adj1: 75000 },
		} as Partial<PptxElement>);
		expect(getResolvedShapeClipPath(el)).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
	});
});

describe('buildCustomGeometryClipPath', () => {
	it('rescales M/L/C/Q coordinates into the element pixel box', () => {
		const clip = buildCustomGeometryClipPath(
			'M 0 0 C 10 20 30 40 50 60 Q 5 5 10 10 Z',
			100,
			100,
			200,
			50,
		);
		// x scaled by 2 (200/100), y scaled by 0.5 (50/100).
		expect(clip).toBe("path('M 0 0 C 20 10 60 20 100 30 Q 10 2.5 20 5 Z')");
	});

	it('returns undefined for degenerate dimensions', () => {
		expect(buildCustomGeometryClipPath('M 0 0 L 1 1 Z', 0, 100, 10, 10)).toBeUndefined();
		expect(buildCustomGeometryClipPath('M 0 0 L 1 1 Z', 100, 100, 0, 10)).toBeUndefined();
		expect(buildCustomGeometryClipPath('', 100, 100, 10, 10)).toBeUndefined();
	});
});
