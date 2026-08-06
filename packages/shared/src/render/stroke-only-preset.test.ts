import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getStrokeOnlyPresetPaths,
	isStrokeOnlyPresetElement,
	strokeOnlyPresetPathData,
} from './stroke-only-preset';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 200,
		height: 120,
		shapeType: 'rect',
		...overrides,
	} as PptxElement;
}

describe('getStrokeOnlyPresetPaths', () => {
	// The open family: nothing here has a region to fill, so a CSS border on the
	// element box outlines a rectangle the shape does not have.
	const OPEN = ['line', 'arc', 'straightConnector1', 'bentConnector3', 'curvedConnector3'];
	// The closed family: a border on the box (or on its clip-path) is correct.
	const CLOSED = ['rect', 'ellipse', 'roundRect', 'triangle', 'pie', 'chord', 'donut'];

	it.each(OPEN)('reports %s as stroke-only', (shapeType) => {
		expect(getStrokeOnlyPresetPaths(shape({ shapeType } as Partial<PptxElement>))).toBeDefined();
		expect(isStrokeOnlyPresetElement(shape({ shapeType } as Partial<PptxElement>))).toBeTruthy();
	});

	it.each(CLOSED)('leaves %s alone', (shapeType) => {
		expect(getStrokeOnlyPresetPaths(shape({ shapeType } as Partial<PptxElement>))).toBeUndefined();
		expect(isStrokeOnlyPresetElement(shape({ shapeType } as Partial<PptxElement>))).toBeFalsy();
	});

	it('ignores custom geometry, which paints through its own pathData', () => {
		expect(
			getStrokeOnlyPresetPaths(
				shape({ shapeType: 'line', pathData: 'M 0 0 L 5 5' } as Partial<PptxElement>),
			),
		).toBeUndefined();
		expect(
			getStrokeOnlyPresetPaths(shape({ shapeType: 'custom' } as Partial<PptxElement>)),
		).toBeUndefined();
		expect(getStrokeOnlyPresetPaths(shape({ shapeType: undefined }))).toBeUndefined();
	});

	it('never reinterprets a picture as an outline', () => {
		// A picture paints its own bitmap; `line` here would be a crop geometry.
		expect(
			getStrokeOnlyPresetPaths(shape({ type: 'image', shapeType: 'line' } as Partial<PptxElement>)),
		).toBeUndefined();
	});

	it('evaluates a degenerate box at a 1px floor instead of dividing by zero', () => {
		const paths = getStrokeOnlyPresetPaths(
			shape({ shapeType: 'line', width: 400, height: 0 } as Partial<PptxElement>),
		);
		expect(paths).toStrictEqual([{ d: 'M 0 0 L 400 1', fill: 'none', stroke: true }]);
	});
});

describe('strokeOnlyPresetPathData', () => {
	it('joins the stroked sub-paths', () => {
		expect(
			strokeOnlyPresetPathData(
				shape({ shapeType: 'bentConnector3', width: 200, height: 120 } as Partial<PptxElement>),
			),
		).toBe('M 0 0 L 100 0 L 100 120 L 200 120');
	});

	it('is undefined for a closed preset', () => {
		expect(strokeOnlyPresetPathData(shape())).toBeUndefined();
	});
});
