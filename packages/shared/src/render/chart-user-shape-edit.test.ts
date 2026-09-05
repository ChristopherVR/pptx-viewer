import type { PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	createDefaultChartUserShape,
	listChartUserShapeDescriptors,
	pixelRectToAbsAnchor,
	pixelRectToRelAnchor,
	validateChartUserShapeAnchor,
	withChartUserShapeAdded,
	withChartUserShapeRemoved,
	withChartUserShapeUpdated,
} from './chart-user-shape-edit';

describe('listChartUserShapeDescriptors', () => {
	it('returns an empty list for no overlays', () => {
		expect(listChartUserShapeDescriptors(undefined)).toStrictEqual([]);
	});

	it('flattens shapes with index, joined text, and an editable flag', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.2 },
				fill: '#FF0000',
				paragraphs: [{ text: 'Hello' }, { text: 'World' }],
			},
			{ kind: 'pic', anchor: 'abs', from: { x: 0.5, y: 0.5 }, ext: { cx: 100, cy: 200 } },
		];
		const descriptors = listChartUserShapeDescriptors(shapes);
		expect(descriptors).toStrictEqual([
			{
				index: 0,
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.2 },
				ext: undefined,
				fill: '#FF0000',
				stroke: undefined,
				text: 'Hello World',
				editable: true,
			},
			{
				index: 1,
				kind: 'pic',
				anchor: 'abs',
				from: { x: 0.5, y: 0.5 },
				to: undefined,
				ext: { cx: 100, cy: 200 },
				fill: undefined,
				stroke: undefined,
				text: undefined,
				editable: false,
			},
		]);
	});
});

describe('createDefaultChartUserShape', () => {
	it('returns a valid rel-anchored text box', () => {
		const shape = createDefaultChartUserShape();
		expect(shape.kind).toBe('sp');
		expect(shape.anchor).toBe('rel');
		expect(validateChartUserShapeAnchor(shape)).toBeUndefined();
		expect(shape.paragraphs?.[0].text).toBe('Text');
	});
});

describe('pixelRectToRelAnchor / pixelRectToAbsAnchor', () => {
	it('converts a canvas-pixel rect to rel fractions', () => {
		const result = pixelRectToRelAnchor({ x: 50, y: 100, w: 100, h: 50 }, { w: 500, h: 500 });
		expect(result).toStrictEqual({ from: { x: 0.1, y: 0.2 }, to: { x: 0.3, y: 0.3 } });
	});

	it('clamps fractions into [0, 1] for an out-of-bounds rect', () => {
		const result = pixelRectToRelAnchor({ x: -50, y: 0, w: 700, h: 100 }, { w: 500, h: 500 });
		expect(result.from).toStrictEqual({ x: 0, y: 0 });
		expect(result.to).toStrictEqual({ x: 1, y: 0.2 });
	});

	it('converts a canvas-pixel rect to an abs anchor with an EMU extent', () => {
		const result = pixelRectToAbsAnchor({ x: 0, y: 0, w: 96, h: 48 }, { w: 500, h: 500 });
		expect(result.ext).toStrictEqual({ cx: 96 * 9525, cy: 48 * 9525 });
	});

	it('returns a zero rect for a degenerate canvas', () => {
		expect(pixelRectToRelAnchor({ x: 1, y: 1, w: 1, h: 1 }, { w: 0, h: 0 })).toStrictEqual({
			from: { x: 0, y: 0 },
			to: { x: 0, y: 0 },
		});
	});
});

describe('withChartUserShapeAdded / Updated / Removed', () => {
	const base: PptxChartUserShape = {
		kind: 'sp',
		anchor: 'rel',
		from: { x: 0, y: 0 },
		to: { x: 0.2, y: 0.2 },
	};

	it('withChartUserShapeAdded appends to an undefined list', () => {
		expect(withChartUserShapeAdded(undefined, base)).toStrictEqual([base]);
	});

	it('withChartUserShapeAdded appends without mutating the input array', () => {
		const list = [base];
		const next = withChartUserShapeAdded(list, { ...base, fill: '#FFFFFF' });
		expect(list).toHaveLength(1);
		expect(next).toHaveLength(2);
	});

	it('withChartUserShapeUpdated patches only the targeted index', () => {
		const list = [base, { ...base, from: { x: 0.5, y: 0.5 } }];
		const next = withChartUserShapeUpdated(list, 1, { fill: '#00FF00' });
		expect(next[0]).toStrictEqual(base);
		expect(next[1]).toStrictEqual({ ...list[1], fill: '#00FF00' });
	});

	it('withChartUserShapeRemoved drops the targeted index', () => {
		const list = [base, { ...base, fill: '#000000' }];
		expect(withChartUserShapeRemoved(list, 0)).toStrictEqual([{ ...base, fill: '#000000' }]);
	});
});

describe('validateChartUserShapeAnchor', () => {
	it('rejects a rel anchor whose to-corner is not below/right of from', () => {
		const error = validateChartUserShapeAnchor({
			anchor: 'rel',
			from: { x: 0.5, y: 0.5 },
			to: { x: 0.4, y: 0.6 },
		});
		expect(error).toBeDefined();
	});

	it('rejects an abs anchor with a non-positive extent', () => {
		const error = validateChartUserShapeAnchor({
			anchor: 'abs',
			from: { x: 0.1, y: 0.1 },
			ext: { cx: 0, cy: 10 },
		});
		expect(error).toBeDefined();
	});

	it('accepts a well-formed rel anchor', () => {
		expect(
			validateChartUserShapeAnchor({
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.4, y: 0.3 },
			}),
		).toBeUndefined();
	});
});
