import type { CustomGeometrySubpathSvg, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { colorWithOpacity } from './color';
import {
	adjustFillForMode,
	buildCustomSubpathPaints,
	getStrokeOnlyPresetPaths,
} from './vector-subpath-paint';

function makeShapeElement(
	overrides: Partial<PptxElement> & { shapeType?: string } = {},
): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function subpath(overrides: Partial<CustomGeometrySubpathSvg> = {}): CustomGeometrySubpathSvg {
	return { d: 'M 0 0 L 10 10', ...overrides };
}

describe('adjustFillForMode', () => {
	it('returns the colour unchanged for norm/none/undefined', () => {
		expect(adjustFillForMode('#3366cc', undefined)).toBe('#3366cc');
		expect(adjustFillForMode('#3366cc', 'norm')).toBe('#3366cc');
		expect(adjustFillForMode('#3366cc', 'none')).toBe('#3366cc');
	});

	it('lightens towards white and lightenLess less strongly', () => {
		const base = '#336699';
		const lighten = adjustFillForMode(base, 'lighten');
		const lightenLess = adjustFillForMode(base, 'lightenLess');
		// Both are lighter than the base and lighten is lighter than lightenLess.
		const redOf = (hex: string): number => Number.parseInt(hex.slice(1, 3), 16);
		expect(redOf(lighten)).toBeGreaterThan(redOf(lightenLess));
		expect(redOf(lightenLess)).toBeGreaterThan(redOf(base));
	});

	it('darkens towards black and darkenLess less strongly', () => {
		const base = '#336699';
		const darken = adjustFillForMode(base, 'darken');
		const darkenLess = adjustFillForMode(base, 'darkenLess');
		const blueOf = (hex: string): number => Number.parseInt(hex.slice(5, 7), 16);
		expect(blueOf(darken)).toBeLessThan(blueOf(darkenLess));
		expect(blueOf(darkenLess)).toBeLessThan(blueOf(base));
	});

	it('leaves malformed colours untouched', () => {
		expect(adjustFillForMode('rgba(0,0,0,0.5)', 'lighten')).toBe('rgba(0,0,0,0.5)');
	});
});

describe('buildCustomSubpathPaints', () => {
	it('fills a norm sub-path with the element fill when the shape has a fill', () => {
		const [paint] = buildCustomSubpathPaints([subpath({ fillMode: 'norm' })], true, '#112233', 1);
		expect(paint.fill).toBe(colorWithOpacity('#112233', 1));
		expect(paint.stroked).toBeTruthy();
	});

	it('emits no fill for a fill="none" sub-path', () => {
		const [paint] = buildCustomSubpathPaints(
			[subpath({ fillMode: 'none', stroke: true })],
			true,
			'#112233',
			1,
		);
		expect(paint.fill).toBe('none');
		expect(paint.stroked).toBeTruthy();
	});

	it('emits no fill when the shape itself has no fill', () => {
		const [paint] = buildCustomSubpathPaints([subpath({ fillMode: 'norm' })], false, '#112233', 1);
		expect(paint.fill).toBe('none');
	});

	it('marks a stroke="0" sub-path as not stroked', () => {
		const [paint] = buildCustomSubpathPaints(
			[subpath({ fillMode: 'norm', stroke: false })],
			true,
			'#112233',
			1,
		);
		expect(paint.stroked).toBeFalsy();
	});

	it('adjusts the fill colour for a lighten sub-path', () => {
		const [norm] = buildCustomSubpathPaints([subpath({ fillMode: 'norm' })], true, '#336699', 1);
		const [lighter] = buildCustomSubpathPaints(
			[subpath({ fillMode: 'lighten' })],
			true,
			'#336699',
			1,
		);
		expect(lighter.fill).not.toBe(norm.fill);
	});

	it('preserves the sub-path d string', () => {
		const paints = buildCustomSubpathPaints([subpath({ d: 'M 1 2 L 3 4' })], true, '#000000', 1);
		expect(paints[0].d).toBe('M 1 2 L 3 4');
	});
});

describe('getStrokeOnlyPresetPaths', () => {
	it('returns stroke-only paths for an open preset (arc)', () => {
		const result = getStrokeOnlyPresetPaths(makeShapeElement({ shapeType: 'arc' }));
		expect(result).toBeDefined();
		expect(result?.length).toBeGreaterThan(0);
		expect(result?.every((p) => p.d !== '')).toBeTruthy();
	});

	it('returns undefined for a normal filled preset (rect)', () => {
		expect(getStrokeOnlyPresetPaths(makeShapeElement({ shapeType: 'rect' }))).toBeUndefined();
	});

	it('returns undefined when the shape already renders custom pathData', () => {
		expect(
			getStrokeOnlyPresetPaths(makeShapeElement({ shapeType: 'arc', pathData: 'M 0 0 L 5 5' })),
		).toBeUndefined();
	});

	it('returns undefined for custom geometry shapeType', () => {
		expect(getStrokeOnlyPresetPaths(makeShapeElement({ shapeType: 'custom' }))).toBeUndefined();
	});

	it('returns undefined for non-shape elements', () => {
		const image = { id: 'i1', type: 'image', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(getStrokeOnlyPresetPaths(image)).toBeUndefined();
	});
});
