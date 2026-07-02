/**
 * viewer-extra-dialogs-helpers.test.ts: Unit tests for the pure helpers backing
 * the secondary dialog suite (equation insert, font collection, annotation ->
 * ink conversion, and accepted-diff application).
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { SlideDiff } from '../internal/shared';
import type { AnnotationStroke, SlideAnnotationMap } from './presentation-annotations-helpers';
import {
	annotationMapToInkInserts,
	applyAcceptedDiff,
	buildEquationElement,
	buildEquationSegment,
	collectUsedFontFamilies,
	countAnnotationStrokes,
} from './viewer-extra-dialogs-helpers';

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 's', elements } as unknown as PptxSlide;
}

function stroke(overrides: Partial<AnnotationStroke> = {}): AnnotationStroke {
	return {
		id: 'k',
		points: [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
		],
		color: '#ff0000',
		width: 3,
		opacity: 1,
		...overrides,
	};
}

describe('buildEquationSegment', () => {
	it('carries the OMML payload and the equation fallback text/style', () => {
		const omml = { foo: 'bar' };
		const segment = buildEquationSegment(omml);
		expect(segment.text).toBe('[Equation]');
		expect(segment.equationXml).toBe(omml);
		expect(segment.style).toStrictEqual({ fontSize: 18, fontFamily: 'Cambria Math' });
	});
});

describe('buildEquationElement', () => {
	it('builds a shape element with an equation segment at the default position', () => {
		const el = buildEquationElement({ a: 1 });
		expect(el.type).toBe('shape');
		expect(el.x).toBe(120);
		expect(el.y).toBe(200);
		expect(el.width).toBe(400);
		expect(el.height).toBe(80);
		const shape = el as Extract<PptxElement, { textSegments?: unknown }>;
		expect(shape.textSegments?.[0]?.equationXml).toStrictEqual({ a: 1 });
	});

	it('honours an explicit position', () => {
		const el = buildEquationElement({}, 50, 75);
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
	});
});

describe('collectUsedFontFamilies', () => {
	it('gathers distinct families from element textStyle and segments, sorted', () => {
		const slides = [
			slideWith([
				{ textStyle: { fontFamily: 'Verdana' } } as unknown as PptxElement,
				{
					textSegments: [{ style: { fontFamily: 'Arial' } }, { style: { fontFamily: 'Verdana' } }],
				} as unknown as PptxElement,
			]),
			slideWith([{ textStyle: { fontFamily: 'Calibri' } } as unknown as PptxElement]),
		];
		expect(collectUsedFontFamilies(slides)).toStrictEqual(['Arial', 'Calibri', 'Verdana']);
	});

	it('returns an empty array when no families are present', () => {
		expect(collectUsedFontFamilies([slideWith([{} as PptxElement])])).toStrictEqual([]);
	});
});

describe('countAnnotationStrokes', () => {
	it('sums stroke counts across every slide in the map', () => {
		const map: SlideAnnotationMap = new Map([
			[0, [stroke(), stroke()]],
			[2, [stroke()]],
		]);
		expect(countAnnotationStrokes(map)).toBe(3);
	});

	it('returns 0 for an empty map', () => {
		expect(countAnnotationStrokes(new Map())).toBe(0);
	});
});

describe('annotationMapToInkInserts', () => {
	it('converts strokes to ink inserts, tagging highlighter by opacity', () => {
		const map: SlideAnnotationMap = new Map([
			[1, [stroke({ opacity: 1 }), stroke({ opacity: 0.4 })]],
		]);
		const inserts = annotationMapToInkInserts(map);
		expect(inserts).toHaveLength(2);
		expect(inserts[0].slideIndex).toBe(1);
		expect(inserts[0].ink.inkTool).toBe('pen');
		expect(inserts[1].ink.inkTool).toBe('highlighter');
	});

	it('skips strokes that cannot form an ink element (fewer than 2 points)', () => {
		const map: SlideAnnotationMap = new Map([[0, [stroke({ points: [{ x: 1, y: 1 }] })]]]);
		expect(annotationMapToInkInserts(map)).toStrictEqual([]);
	});
});

describe('applyAcceptedDiff', () => {
	const incoming = slideWith([{ id: 'in' } as unknown as PptxElement]);

	it('appends the compare slide for an added diff', () => {
		const base = [slideWith([])];
		const diff = {
			status: 'added',
			baseIndex: -1,
			compareIndex: 0,
			compareSlide: incoming,
			changes: [],
		} as unknown as SlideDiff;
		const result = applyAcceptedDiff(base, diff);
		expect(result).toHaveLength(2);
		expect(result[1]).toBe(incoming);
	});

	it('replaces the base-index slide for a changed diff', () => {
		const original = slideWith([]);
		const base = [original];
		const diff = {
			status: 'changed',
			baseIndex: 0,
			compareIndex: 0,
			compareSlide: incoming,
			changes: [],
		} as unknown as SlideDiff;
		const result = applyAcceptedDiff(base, diff);
		expect(result[0]).toBe(incoming);
	});

	it('returns an unchanged copy when there is no compare slide', () => {
		const base = [slideWith([])];
		const diff = {
			status: 'removed',
			baseIndex: 0,
			compareIndex: -1,
			changes: [],
		} as unknown as SlideDiff;
		const result = applyAcceptedDiff(base, diff);
		expect(result).toStrictEqual(base);
		expect(result).not.toBe(base);
	});
});
