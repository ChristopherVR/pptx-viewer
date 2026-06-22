import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { clipPathToPolygon, resolveElementOutline, OUTLINE_SAMPLE_COUNT } from './morph-geometry';
import { interpolateOutline, normalizeOutlinePair, resamplePolygon } from './morph-geometry-interp';
import {
	generateGeometryMorphAnimation,
	shouldGeometryMorph,
	GEOMETRY_MORPH_STEPS,
} from './morph-geometry-keyframes';
import type { MorphPair } from './morph-types';

function makeElement(
	overrides: Partial<PptxElement> & { id: string; type: PptxElement['type'] },
): PptxElement {
	return { x: 0, y: 0, width: 100, height: 100, ...overrides } as PptxElement;
}

// ==========================================================================
// clipPathToPolygon
// ==========================================================================

describe('clipPathToPolygon', () => {
	it('parses a percent polygon against the box', () => {
		const poly = clipPathToPolygon('polygon(50% 0%, 0% 100%, 100% 100%)', 100, 200);
		expect(poly).toHaveLength(3);
		expect(poly[0]).toStrictEqual({ x: 50, y: 0 });
		expect(poly[1]).toStrictEqual({ x: 0, y: 200 });
		expect(poly[2]).toStrictEqual({ x: 100, y: 200 });
	});

	it('parses a pixel polygon', () => {
		const poly = clipPathToPolygon('polygon(0px 0px, 80px 0px, 80px 40px, 0px 40px)', 80, 40);
		expect(poly).toHaveLength(4);
		expect(poly[2]).toStrictEqual({ x: 80, y: 40 });
	});

	it('expands an inset into a rectangle', () => {
		const poly = clipPathToPolygon('inset(10% 20%)', 100, 100);
		expect(poly).toHaveLength(4);
		expect(poly[0]).toStrictEqual({ x: 20, y: 10 });
		expect(poly[2]).toStrictEqual({ x: 80, y: 90 });
	});

	it('samples an ellipse into many points', () => {
		const poly = clipPathToPolygon('ellipse(50% 50% at 50% 50%)', 100, 100);
		expect(poly.length).toBeGreaterThan(8);
		// All points should lie roughly on the circle of radius 50 centred at 50,50.
		for (const p of poly) {
			const r = Math.hypot(p.x - 50, p.y - 50);
			expect(r).toBeCloseTo(50, 0);
		}
	});

	it('parses a path() clip-path via core', () => {
		const poly = clipPathToPolygon("path('M0 0 L100 0 L100 100 L0 100 Z')", 100, 100);
		expect(poly.length).toBeGreaterThanOrEqual(3);
	});

	it('returns empty for unrecognised values', () => {
		expect(clipPathToPolygon('none', 100, 100)).toStrictEqual([]);
	});
});

// ==========================================================================
// resolveElementOutline
// ==========================================================================

describe('resolveElementOutline', () => {
	it('resolves a triangle preset to a 3-point outline', () => {
		const el = makeElement({
			id: 'a',
			type: 'shape',
			shapeType: 'triangle',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const outline = resolveElementOutline(el);
		expect(outline).toHaveLength(3);
	});

	it('falls back to a rectangle for unknown / unclipped shapes', () => {
		const el = makeElement({ id: 'a', type: 'image', width: 120, height: 60 });
		const outline = resolveElementOutline(el);
		expect(outline).toHaveLength(4);
		expect(outline[2]).toStrictEqual({ x: 120, y: 60 });
	});
});

// ==========================================================================
// resamplePolygon
// ==========================================================================

describe('resamplePolygon', () => {
	it('resamples to the requested point count', () => {
		const square = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
			{ x: 0, y: 10 },
		];
		const out = resamplePolygon(square, 16);
		expect(out).toHaveLength(16);
	});

	it('keeps points on the perimeter', () => {
		const square = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
			{ x: 0, y: 10 },
		];
		const out = resamplePolygon(square, 8);
		for (const p of out) {
			const onEdge =
				((p.x === 0 || p.x === 10) && p.y >= 0 && p.y <= 10) ||
				((p.y === 0 || p.y === 10) && p.x >= 0 && p.x <= 10);
			expect(onEdge).toBeTruthy();
		}
	});
});

// ==========================================================================
// normalizeOutlinePair + interpolateOutline
// ==========================================================================

describe('normalizeOutlinePair', () => {
	it('produces two equal-length rings', () => {
		const tri = [
			{ x: 50, y: 0 },
			{ x: 0, y: 100 },
			{ x: 100, y: 100 },
		];
		const rect = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 },
			{ x: 0, y: 100 },
		];
		const [from, to] = normalizeOutlinePair(tri, rect);
		expect(from).toHaveLength(OUTLINE_SAMPLE_COUNT);
		expect(to).toHaveLength(OUTLINE_SAMPLE_COUNT);
	});
});

describe('interpolateOutline', () => {
	const tri = [
		{ x: 50, y: 0 },
		{ x: 0, y: 100 },
		{ x: 100, y: 100 },
	];
	const rect = [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	];

	it('returns a closed path at endpoints', () => {
		const [from, to] = normalizeOutlinePair(tri, rect);
		const d0 = interpolateOutline(from, to, 0);
		const d1 = interpolateOutline(from, to, 1);
		expect(d0.startsWith('M')).toBeTruthy();
		expect(d0.endsWith('Z')).toBeTruthy();
		expect(d1.endsWith('Z')).toBeTruthy();
	});

	it('midpoint differs from both endpoints', () => {
		const [from, to] = normalizeOutlinePair(tri, rect);
		const d0 = interpolateOutline(from, to, 0);
		const dMid = interpolateOutline(from, to, 0.5);
		const d1 = interpolateOutline(from, to, 1);
		expect(dMid).not.toBe(d0);
		expect(dMid).not.toBe(d1);
	});

	it('clamps t outside [0,1]', () => {
		const [from, to] = normalizeOutlinePair(tri, rect);
		expect(interpolateOutline(from, to, -1)).toBe(interpolateOutline(from, to, 0));
		expect(interpolateOutline(from, to, 2)).toBe(interpolateOutline(from, to, 1));
	});

	it('returns empty for empty input', () => {
		expect(interpolateOutline([], [], 0.5)).toBe('');
	});
});

// ==========================================================================
// shouldGeometryMorph + generateGeometryMorphAnimation
// ==========================================================================

describe('shouldGeometryMorph', () => {
	function pair(fromType?: string, toType?: string, fromAdj?: object, toAdj?: object): MorphPair {
		return {
			fromElement: makeElement({
				id: 'a',
				type: 'shape',
				shapeType: fromType,
				shapeAdjustments: fromAdj,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'shape',
				shapeType: toType,
				shapeAdjustments: toAdj,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
	}

	it('is true when shape types differ', () => {
		expect(shouldGeometryMorph(pair('triangle', 'hexagon'))).toBeTruthy();
	});

	it('is false when shape types are equal and no adjustments', () => {
		expect(shouldGeometryMorph(pair('triangle', 'triangle'))).toBeFalsy();
	});

	it('is true when adjustments differ on same type', () => {
		expect(shouldGeometryMorph(pair('pie', 'pie', { adj1: 0 }, { adj1: 90 }))).toBeTruthy();
	});

	it('is false when either side lacks a shape type', () => {
		expect(shouldGeometryMorph(pair(undefined, 'triangle'))).toBeFalsy();
		expect(shouldGeometryMorph(pair('triangle', undefined))).toBeFalsy();
	});
});

describe('generateGeometryMorphAnimation', () => {
	it('returns null when no geometry morph is needed', () => {
		const p: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'shape',
				shapeType: 'triangle',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'shape',
				shapeType: 'triangle',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		expect(generateGeometryMorphAnimation(p, 500, 0)).toBeNull();
	});

	it('bakes clip-path keyframes for a shape-type change', () => {
		const p: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'shape',
				shapeType: 'triangle',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'shape',
				shapeType: 'hexagon',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anim = generateGeometryMorphAnimation(p, 800, 2);
		expect(anim).not.toBeNull();
		expect(anim!.elementId).toBe('b');
		expect(anim!.animation).toContain('800ms');
		expect(anim!.keyframes).toContain('clip-path: path(');
		// Should contain 0% and 100% stops plus intermediates.
		expect(anim!.keyframes).toContain('0% {');
		expect(anim!.keyframes).toContain('100% {');
	});

	it('emits GEOMETRY_MORPH_STEPS + 1 stops', () => {
		const p: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'shape',
				shapeType: 'triangle',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'shape',
				shapeType: 'diamond',
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anim = generateGeometryMorphAnimation(p, 500, 0);
		const stopCount = (anim!.keyframes.match(/clip-path: path\(/gu) ?? []).length;
		expect(stopCount).toBe(GEOMETRY_MORPH_STEPS + 1);
	});
});
