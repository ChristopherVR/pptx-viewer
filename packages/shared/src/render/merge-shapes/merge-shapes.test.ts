import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { elementOutlineLoops } from './element-outline';
import {
	applyMergeShapesPlan,
	canMergeShapes,
	isMergeableElement,
	planMergeShapes,
} from './merge-shapes';
import { MERGE_SHAPES_MENU_ITEMS, mergeOperationForCommand } from './merge-shapes-menu';
import { regionArea } from './polygon-boolean';

function rect(
	id: string,
	x: number,
	y: number,
	w: number,
	h: number,
	extra: Partial<ShapePptxElement> = {},
): ShapePptxElement {
	return { id, type: 'shape', x, y, width: w, height: h, shapeType: 'rect', ...extra };
}

let counter = 0;
const createId = () => `new-${++counter}`;

function areaOf(el: ShapePptxElement): number {
	return Math.abs(regionArea(elementOutlineLoops(el)));
}

describe('isMergeableElement / canMergeShapes', () => {
	it('accepts shapes and text boxes, rejects pictures, connectors and lines', () => {
		expect(isMergeableElement(rect('a', 0, 0, 10, 10))).toBeTruthy();
		expect(
			isMergeableElement({ id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10 }),
		).toBeTruthy();
		expect(
			isMergeableElement({
				id: 'p',
				type: 'picture',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
			} as PptxElement),
		).toBeFalsy();
		expect(
			isMergeableElement({
				id: 'c',
				type: 'connector',
				x: 0,
				y: 0,
				width: 10,
				height: 0,
			} as PptxElement),
		).toBeFalsy();
		expect(isMergeableElement(rect('l', 0, 0, 10, 10, { shapeType: 'line' }))).toBeFalsy();
	});

	it('needs two mergeable shapes', () => {
		expect(canMergeShapes([rect('a', 0, 0, 10, 10)])).toBeFalsy();
		expect(canMergeShapes([rect('a', 0, 0, 10, 10), rect('b', 5, 5, 10, 10)])).toBeTruthy();
	});
});

describe('planMergeShapes', () => {
	const first = rect('a', 0, 0, 100, 100, {
		shapeStyle: { fillColor: '#FF0000', strokeColor: '#000000' },
		text: 'Hello',
	});
	const second = rect('b', 50, 50, 100, 100, { shapeStyle: { fillColor: '#00FF00' } });

	it('unions into one custom-geometry shape with the first shape formatting', () => {
		const plan = planMergeShapes('union', [first, second], { createId });
		expect(plan).not.toBeNull();
		const [shape] = plan!.created;
		expect(plan!.created).toHaveLength(1);
		expect(shape).toMatchObject({
			x: 0,
			y: 0,
			width: 150,
			height: 150,
			shapeType: 'custom',
			text: 'Hello',
		});
		expect(shape.shapeStyle?.fillColor).toBe('#FF0000');
		expect(shape.customGeometryPaths?.[0].segments.at(-1)).toStrictEqual({ type: 'close' });
		expect(areaOf(shape)).toBeCloseTo(17500, 0);
		expect(plan!.removedIds).toStrictEqual(['a', 'b']);
	});

	it('uses selection order, not slide order, for the surviving formatting', () => {
		const plan = planMergeShapes('union', [second, first], { createId });
		expect(plan!.created[0].shapeStyle?.fillColor).toBe('#00FF00');
		expect(plan!.primaryId).toBe('b');
	});

	it('subtracts every other shape from the first-selected one', () => {
		const third = rect('c', -20, 80, 40, 40);
		const plan = planMergeShapes('subtract', [first, second, third], { createId });
		expect(areaOf(plan!.created[0])).toBeCloseTo(10000 - 2500 - 400, 0);
	});

	it('intersects, combines and returns null for an empty result', () => {
		expect(
			areaOf(planMergeShapes('intersect', [first, second], { createId })!.created[0]),
		).toBeCloseTo(2500, 0);
		expect(
			areaOf(planMergeShapes('combine', [first, second], { createId })!.created[0]),
		).toBeCloseTo(15000, 0);
		expect(
			planMergeShapes('intersect', [first, rect('far', 500, 500, 10, 10)], { createId }),
		).toBeNull();
	});

	it('fragments into every distinct region', () => {
		const plan = planMergeShapes('fragment', [first, second], { createId });
		expect(plan!.created).toHaveLength(3);
		const areas = plan!.created.map(areaOf).sort((x, y) => x - y);
		expect(areas[0]).toBeCloseTo(2500, 0);
		expect(areas[1]).toBeCloseTo(7500, 0);
		expect(areas[2]).toBeCloseTo(7500, 0);
		for (const piece of plan!.created) {
			expect(piece.shapeStyle?.fillColor).toBe('#FF0000');
		}
	});

	it('honours rotation and curved presets', () => {
		const diamond = rect('r', 0, 0, 100, 100, { rotation: 45 });
		const loops = elementOutlineLoops(diamond);
		const xs = loops[0].map((p) => p.x);
		expect(Math.min(...xs)).toBeCloseTo(50 - 50 * Math.SQRT2, 3);
		const ellipse = rect('e', 0, 0, 100, 100, { shapeType: 'ellipse' });
		expect(Math.abs(regionArea(elementOutlineLoops(ellipse)))).toBeCloseTo(Math.PI * 2500, -2);
		const plan = planMergeShapes('union', [ellipse, rect('s', 50, 0, 100, 100)], { createId });
		expect(plan!.created[0].width).toBeCloseTo(150, 1);
	});
});

describe('applyMergeShapesPlan', () => {
	it('puts the result where the first-selected shape was and drops the rest', () => {
		const other = rect('x', 0, 0, 1, 1);
		const a = rect('a', 0, 0, 10, 10);
		const b = rect('b', 5, 5, 10, 10);
		const plan = planMergeShapes('union', [b, a], { createId: () => 'merged' })!;
		const result = applyMergeShapesPlan([a, other, b], plan);
		expect(result.map((el) => el.id)).toStrictEqual(['x', 'merged']);
	});
});

describe('merge shapes menu', () => {
	it('lists the five operations in PowerPoint order', () => {
		expect(MERGE_SHAPES_MENU_ITEMS.map((item) => item.operation)).toStrictEqual([
			'union',
			'combine',
			'fragment',
			'intersect',
			'subtract',
		]);
		expect(MERGE_SHAPES_MENU_ITEMS[0].labelKey).toBe('pptx.shape.mergeUnion');
		expect(mergeOperationForCommand('merge-subtract')).toBe('subtract');
		expect(mergeOperationForCommand('copy')).toBeNull();
	});
});
