import type { PptxElement, PptxElementWithShapeStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	beginShapeAdjustment,
	clampShapeAdjustmentValue,
	getRoundRectAdjustmentValue,
	getRoundRectRadiusPx,
	getDraggedShapeAdjustmentValue,
	getDraggedShapeAdjustments,
	getShapeAdjustmentHandleDescriptor,
	getShapeAdjustmentHandleDescriptors,
	SHAPE_ADJUSTMENT_MAX,
	SHAPE_ADJUSTMENT_MIN,
	DEFAULT_ROUND_RECT_ADJUSTMENT,
} from './shape-adjustment';
import type { ShapeAdjustmentDragState } from './shape-adjustment';

/** A shape element with the fields the descriptor reads. */
function shapeElement(overrides: Record<string, unknown>): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

describe('clampShapeAdjustmentValue', () => {
	it('clamps below minimum to SHAPE_ADJUSTMENT_MIN', () => {
		expect(clampShapeAdjustmentValue(-100)).toBe(SHAPE_ADJUSTMENT_MIN);
	});

	it('clamps above maximum to SHAPE_ADJUSTMENT_MAX', () => {
		expect(clampShapeAdjustmentValue(100000)).toBe(SHAPE_ADJUSTMENT_MAX);
	});

	it('rounds to nearest integer', () => {
		expect(clampShapeAdjustmentValue(25000.7)).toBe(25001);
		expect(clampShapeAdjustmentValue(25000.3)).toBe(25000);
	});

	it('passes through valid values unchanged', () => {
		expect(clampShapeAdjustmentValue(25000)).toBe(25000);
	});

	it('accepts exact minimum', () => {
		expect(clampShapeAdjustmentValue(SHAPE_ADJUSTMENT_MIN)).toBe(SHAPE_ADJUSTMENT_MIN);
	});

	it('accepts exact maximum', () => {
		expect(clampShapeAdjustmentValue(SHAPE_ADJUSTMENT_MAX)).toBe(SHAPE_ADJUSTMENT_MAX);
	});
});

describe('getRoundRectAdjustmentValue', () => {
	it("returns the element's adjustment value when valid", () => {
		const element = {
			shapeAdjustments: { adj: 10000 },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(10000);
	});

	it('returns DEFAULT when no adjustments object', () => {
		const element = {} as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
	});

	it('returns DEFAULT when adj is undefined', () => {
		const element = {
			shapeAdjustments: {},
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
	});

	it('returns DEFAULT for NaN adjustment', () => {
		const element = {
			shapeAdjustments: { adj: NaN },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
	});

	it('returns DEFAULT for Infinity adjustment', () => {
		const element = {
			shapeAdjustments: { adj: Infinity },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
	});

	it('clamps out-of-range adjustment values', () => {
		const element = {
			shapeAdjustments: { adj: -500 },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectAdjustmentValue(element)).toBe(SHAPE_ADJUSTMENT_MIN);
	});
});

describe('getRoundRectRadiusPx', () => {
	it('computes radius for default adjustment', () => {
		const element = {
			width: 200,
			height: 100,
			shapeAdjustments: { adj: DEFAULT_ROUND_RECT_ADJUSTMENT },
		} as unknown as PptxElementWithShapeStyle;
		const radius = getRoundRectRadiusPx(element);
		expect(radius).toBeCloseTo(16.667, 0);
	});

	it('returns 0 for zero adjustment', () => {
		const element = {
			width: 100,
			height: 100,
			shapeAdjustments: { adj: 0 },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectRadiusPx(element)).toBe(0);
	});

	it('uses smaller dimension', () => {
		const narrow = {
			width: 50,
			height: 200,
			shapeAdjustments: { adj: SHAPE_ADJUSTMENT_MAX },
		} as unknown as PptxElementWithShapeStyle;
		const wide = {
			width: 200,
			height: 50,
			shapeAdjustments: { adj: SHAPE_ADJUSTMENT_MAX },
		} as unknown as PptxElementWithShapeStyle;
		expect(getRoundRectRadiusPx(narrow)).toBe(getRoundRectRadiusPx(wide));
		expect(getRoundRectRadiusPx(narrow)).toBe(25);
	});

	it('handles very small dimensions', () => {
		const element = {
			width: 0,
			height: 0,
			shapeAdjustments: { adj: 25000 },
		} as unknown as PptxElementWithShapeStyle;
		const radius = getRoundRectRadiusPx(element);
		expect(radius).toBeCloseTo(0.25, 2);
	});

	it('uses default adjustment when none provided', () => {
		const element = {
			width: 100,
			height: 100,
		} as unknown as PptxElementWithShapeStyle;
		const radius = getRoundRectRadiusPx(element);
		const expected = 100 * 0.5 * (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX);
		expect(radius).toBeCloseTo(expected, 1);
	});
});

function makeDragState(
	overrides: Partial<ShapeAdjustmentDragState> = {},
): ShapeAdjustmentDragState {
	return {
		elementId: 'el-1',
		key: 'adj',
		shapeType: 'roundrect',
		startClientX: 0,
		startClientY: 0,
		startAdjustment: 25000,
		startWidth: 200,
		startHeight: 100,
		moved: false,
		...overrides,
	};
}

describe('getDraggedShapeAdjustmentValue', () => {
	it('adjusts value based on positive deltaX', () => {
		const state = makeDragState();
		const result = getDraggedShapeAdjustmentValue(state, 10);
		expect(result).toBeGreaterThan(25000);
	});

	it('adjusts value based on negative deltaX', () => {
		const state = makeDragState();
		const result = getDraggedShapeAdjustmentValue(state, -10);
		expect(result).toBeLessThan(25000);
	});

	it('clamps result to valid range', () => {
		const state = makeDragState({ startAdjustment: 0 });
		const result = getDraggedShapeAdjustmentValue(state, -1000);
		expect(result).toBe(SHAPE_ADJUSTMENT_MIN);
	});

	it('returns startAdjustment for non-roundrect shapes', () => {
		const state = makeDragState({
			shapeType: 'rect',
			startAdjustment: 12345,
		});
		expect(getDraggedShapeAdjustmentValue(state, 50)).toBe(12345);
	});

	it('returns startAdjustment when deltaX is 0', () => {
		const state = makeDragState({ startAdjustment: 15000 });
		expect(getDraggedShapeAdjustmentValue(state, 0)).toBe(15000);
	});

	it('handles very small element dimensions', () => {
		const state = makeDragState({ startWidth: 1, startHeight: 1 });
		const result = getDraggedShapeAdjustmentValue(state, 5);
		expect(Number.isFinite(result)).toBeTruthy();
	});

	// The bug this guards: the branch compared `state.shapeType` RAW against the
	// all-lowercase `'roundrect'`, while a deck spells the preset `roundRect`
	// and every binding passes that spelling straight through from the element.
	// So the drag always fell into the "not adjustable" arm and returned the
	// start value: the amber handle rendered, tracked the pointer, and changed
	// nothing. The fixture above hid it by using the lowercase spelling, which
	// no real deck produces.
	it('accepts the OOXML spelling `roundRect`, not just an already-lowercased one', () => {
		const state = makeDragState({ shapeType: 'roundRect', startAdjustment: 16667 });
		expect(getDraggedShapeAdjustmentValue(state, 40)).toBeGreaterThan(16667);
	});

	it('offers the handle for the OOXML spelling too', () => {
		const element = {
			id: 'r1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 220,
			height: 110,
			shapeType: 'roundRect',
			shapeAdjustments: { adj: 16667 },
		} as unknown as PptxElementWithShapeStyle;
		expect(getShapeAdjustmentHandleDescriptor(element)).not.toBeNull();
	});
});

describe('getShapeAdjustmentHandleDescriptors', () => {
	it('returns every handle a multi-adjust preset has, not just the first', () => {
		const chevron = getShapeAdjustmentHandleDescriptors(
			shapeElement({ shapeType: 'rightArrow', width: 240, height: 120 }),
		);
		expect(chevron.map((h) => h.key)).toStrictEqual(['adj1', 'adj2']);
		// The historical singular entry point is the first of the same list.
		expect(getShapeAdjustmentHandleDescriptor(shapeElement({ shapeType: 'rightArrow' }))?.key).toBe(
			'adj1',
		);
	});

	it('offers no handle for a plain rect (the negative case the overlay relies on)', () => {
		expect(getShapeAdjustmentHandleDescriptors(shapeElement({ shapeType: 'rect' }))).toStrictEqual(
			[],
		);
		expect(getShapeAdjustmentHandleDescriptors(shapeElement({}))).toStrictEqual([]);
	});

	it('honours a:spLocks/@noAdjustHandles', () => {
		expect(
			getShapeAdjustmentHandleDescriptors(
				shapeElement({ shapeType: 'roundRect', locks: { noAdjustHandles: true } }),
			),
		).toStrictEqual([]);
	});

	it('offers no preset handle for a connector or a custom-geometry freeform', () => {
		expect(
			getShapeAdjustmentHandleDescriptors(
				shapeElement({ type: 'connector', shapeType: 'bentConnector3' }),
			),
		).toStrictEqual([]);
		expect(
			getShapeAdjustmentHandleDescriptors(
				shapeElement({ shapeType: 'roundRect', customGeometryPaths: [{ commands: [] }] }),
			),
		).toStrictEqual([]);
	});

	it('reports the value in guide space, so a 16667 radius is not collapsed to 1', () => {
		const [handle] = getShapeAdjustmentHandleDescriptors(
			shapeElement({ shapeType: 'roundRect', shapeAdjustments: { adj: 16667 } }),
		);
		expect(handle.value).toBe(16667);
		expect(handle.left).toBeCloseTo(16.667, 3);
		expect(handle.top).toBeCloseTo(0, 6);
	});
});

describe('beginShapeAdjustment / getDraggedShapeAdjustments', () => {
	it('carries the solver so a drag writes the preset scale, not a start value', () => {
		const element = shapeElement({ shapeType: 'roundRect', shapeAdjustments: { adj: 16667 } });
		const [handle] = getShapeAdjustmentHandleDescriptors(element);
		const state = beginShapeAdjustment(element, handle, 400, 300);
		expect(state.solvers).toBeDefined();
		// ss = 100 px per 100000 guide units.
		expect(getDraggedShapeAdjustmentValue(state, 20)).toBe(36667);
		expect(getDraggedShapeAdjustments(state, 20)).toStrictEqual({ adj: 36667 });
	});

	it('writes both guides of a merged callout handle', () => {
		const element = shapeElement({ shapeType: 'callout1', width: 240, height: 120 });
		const [handle] = getShapeAdjustmentHandleDescriptors(element);
		const state = beginShapeAdjustment(element, handle, 0, 0);
		expect(getDraggedShapeAdjustments(state, 24, 12)).toStrictEqual({ adj1: 28750, adj2: 1667 });
	});

	it('falls back to a single-key patch when no solver was captured', () => {
		const state = makeDragState({ shapeType: 'roundRect', startAdjustment: 10000 });
		expect(Object.keys(getDraggedShapeAdjustments(state, 0))).toStrictEqual(['adj']);
	});

	it("carries the element's OTHER adjustments through, so a drag cannot drop them", () => {
		const element = shapeElement({
			shapeType: 'quadArrow',
			width: 200,
			height: 200,
			shapeAdjustments: { adj1: 22500, adj2: 22500, adj3: 22500 },
		});
		const handles = getShapeAdjustmentHandleDescriptors(element);
		const state = beginShapeAdjustment(element, handles[0], 0, 0);
		const next = getDraggedShapeAdjustments(state, 10, 10);
		expect(Object.keys(next).sort()).toStrictEqual(['adj1', 'adj2', 'adj3']);
		expect(next.adj2).toBe(22500);
		expect(next.adj3).toBe(22500);
		expect(next.adj1).not.toBe(22500);
	});
});
