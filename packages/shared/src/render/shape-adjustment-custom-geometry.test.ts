import type { PptxElement } from 'pptx-viewer-core';
/**
 * Custom-geometry (`a:custGeom`) adjustment handles: G3 of the D3 geometry
 * audit. Before this module, `getShapeAdjustmentHandleDescriptors` returned
 * an empty array for ANY shape with `customGeometryPaths`, so a freeform
 * shape authored with its own `a:ahXY`/`a:ahPolar` showed no on-canvas
 * adjust diamond at all, even though the handle data survived parse/save.
 */
import { describe, expect, it } from 'vitest';

import {
	beginShapeAdjustment,
	getDraggedShapeAdjustments,
	getShapeAdjustmentHandleDescriptors,
} from './shape-adjustment';
import { deriveCustomGeometryAdjustmentHandles } from './shape-adjustment-custom-geometry';

/** A 200x100 freeform shape whose `x1 = w * adj1 / 100000` guide an `a:ahXY` exposes. */
function makeCustomShape(shapeAdjustments?: Record<string, number>): PptxElement {
	return {
		id: 'custom-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeType: 'custom',
		pathWidth: 200,
		pathHeight: 100,
		customGeometryPaths: [
			{ width: 200, height: 100, segments: [{ type: 'moveTo', pt: { x: 0, y: 0 } }] },
		],
		customGeometryAdjustHandlesXY: [
			{ gdRefX: 'adj1', minX: '0', maxX: '100000', posX: 'x1', posY: 't' },
		],
		customGeometryRawData: {
			avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
			gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
		},
		shapeAdjustments,
	} as unknown as PptxElement;
}

describe('deriveCustomGeometryAdjustmentHandles', () => {
	it("places the handle at the a:ahXY <pos> formula, evaluated against the geometry's own a:gdLst", () => {
		const [handle, ...rest] = deriveCustomGeometryAdjustmentHandles(makeCustomShape());
		expect(rest).toHaveLength(0);
		// x1 = w * adj1 / 100000 = 200 * 25000 / 100000 = 50; posY="t" = 0.
		expect(handle.x).toBe(50);
		expect(handle.y).toBe(0);
		expect(handle.key).toBe('adj1');
		expect(handle.value).toBe(25000);
	});

	it('moves with a live shapeAdjustments override (mid-drag re-render)', () => {
		const [handle] = deriveCustomGeometryAdjustmentHandles(makeCustomShape({ adj1: 80000 }));
		// x1 = 200 * 80000 / 100000 = 160
		expect(handle.x).toBe(160);
		expect(handle.value).toBe(80000);
	});

	it('returns nothing for a custom shape with no a:ahLst at all', () => {
		const shape = makeCustomShape();
		delete (shape as { customGeometryAdjustHandlesXY?: unknown }).customGeometryAdjustHandlesXY;
		expect(deriveCustomGeometryAdjustmentHandles(shape)).toStrictEqual([]);
	});
});

describe('getShapeAdjustmentHandleDescriptors (custom geometry)', () => {
	it('routes a custGeom shape to the custom-geometry derivation instead of returning empty', () => {
		const descriptors = getShapeAdjustmentHandleDescriptors(makeCustomShape());
		expect(descriptors).toHaveLength(1);
		expect(descriptors[0].key).toBe('adj1');
		expect(descriptors[0].left).toBe(50);
	});

	it('a full drag solves back to a shapeAdjustments patch, round-tripping the SAME field a preset drag uses', () => {
		const shape = makeCustomShape();
		const [descriptor] = getShapeAdjustmentHandleDescriptors(shape);
		const state = beginShapeAdjustment(shape, descriptor, 0, 0);
		// dx1/dadj1 = w/100000 = 0.002 px/unit; moving 100px right -> +50000 guide units.
		const patch = getDraggedShapeAdjustments(state, 100, 0);
		expect(patch.adj1).toBe(75000);
	});
});
