import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shape-adjustment (amber diamond) handle.
 *
 * Angular used to render a GENERIC top-left corner handle for every selected
 * element, whose pointerdown resized from the south-east corner: it appeared
 * for shapes with nothing to adjust, sat in the wrong place, and adjusted
 * nothing. These tests pin it to the shared
 * `getShapeAdjustmentHandleDescriptor` / `getDraggedShapeAdjustmentValue`
 * decision functions the other four bindings already consume.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_ROUND_RECT_ADJUSTMENT, SHAPE_ADJUSTMENT_MAX } from '../internal/shared';
import { computeSingleSelected } from './selection-geometry';
import {
	beginShapeAdjustmentDrag,
	computeAdjustHandle,
	draggedAdjustmentValue,
} from './shape-adjust-handle';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function shape(id: string, shapeType: string, extra: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		name: id,
		x: 40,
		y: 90,
		width: 200,
		height: 120,
		shapeType,
		...extra,
	} as PptxElement;
}

const box = (element: PptxElement) => computeSingleSelected([element], [element.id]);

// ---------------------------------------------------------------------------
// Which shapes get a handle at all
// ---------------------------------------------------------------------------

describe('computeAdjustHandle', () => {
	it('is null for a plain rect (nothing to adjust)', () => {
		const rect = shape('r', 'rect');
		expect(computeAdjustHandle(rect, box(rect), true, 24, 1)).toBeNull();
	});

	it('is non-null for a roundRect', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandle(round, box(round), true, 24, 1)).not.toBeNull();
	});

	it('is null for a roundRect locked with noAdjustHandles', () => {
		const round = shape('rr', 'roundRect', { locks: { noAdjustHandles: true } });
		expect(computeAdjustHandle(round, box(round), true, 24, 1)).toBeNull();
	});

	it('is null when the canvas is not editable', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandle(round, box(round), false, 24, 1)).toBeNull();
	});

	it('offsets the shared element-local descriptor by the selection box origin', () => {
		const round = shape('rr', 'roundRect');
		const handle = computeAdjustHandle(round, box(round), true, 24, 1);
		// The descriptor's `top` is -8 element-local px; the handle is centered on
		// that point, so a 24px handle sits 12px higher again.
		expect(handle?.top).toBe(90 - 8 - 12);
		// ...and its left is the corner radius, likewise centered, from the box x.
		const radius = (DEFAULT_ROUND_RECT_ADJUSTMENT / SHAPE_ADJUSTMENT_MAX) * 0.5 * 120;
		expect(handle?.left).toBeCloseTo(40 + Math.round(radius) - 12, 5);
		expect(handle?.key).toBe('adj');
		expect(handle?.cursor).toBe('ew-resize');
	});

	it('scales its own size against the zoom so it stays 24 SCREEN px', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandle(round, box(round), true, 24, 2)?.size).toBe(12);
	});
});

// ---------------------------------------------------------------------------
// Dragging it changes the adjustment, not the box
// ---------------------------------------------------------------------------

describe('draggedAdjustmentValue', () => {
	it('a rightward drag raises the corner radius above its default', () => {
		const round = shape('rr', 'roundRect');
		const handle = computeAdjustHandle(round, box(round), true, 24, 1);
		const state = beginShapeAdjustmentDrag(round, handle!, 500, 300);
		expect(state.startAdjustment).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
		expect(draggedAdjustmentValue(state, 540, 1)).toBeGreaterThan(DEFAULT_ROUND_RECT_ADJUSTMENT);
	});

	it('a leftward drag lowers it, and clamps at zero', () => {
		const round = shape('rr', 'roundRect');
		const handle = computeAdjustHandle(round, box(round), true, 24, 1);
		const state = beginShapeAdjustmentDrag(round, handle!, 500, 300);
		expect(draggedAdjustmentValue(state, 490, 1)).toBeLessThan(DEFAULT_ROUND_RECT_ADJUSTMENT);
		expect(draggedAdjustmentValue(state, -5000, 1)).toBe(0);
	});

	it('converts the screen delta into slide px, so zoom does not change the result', () => {
		const round = shape('rr', 'roundRect');
		const handle = computeAdjustHandle(round, box(round), true, 24, 1);
		const state = beginShapeAdjustmentDrag(round, handle!, 500, 300);
		// 40 screen px at zoom 2 is the same 20 slide px as 20 screen px at zoom 1.
		expect(draggedAdjustmentValue(state, 540, 2)).toBe(draggedAdjustmentValue(state, 520, 1));
	});

	it('lower-cases the preset name, which the shared solver compares raw', () => {
		const round = shape('rr', 'roundRect');
		const handle = computeAdjustHandle(round, box(round), true, 24, 1);
		expect(beginShapeAdjustmentDrag(round, handle!, 0, 0).shapeType).toBe('roundrect');
	});
});

// ---------------------------------------------------------------------------
// Template wiring: the handle must not be a resize decoy any more
// ---------------------------------------------------------------------------

const template = readFileSync(join(__dirname, 'slide-canvas.component.html'), 'utf8');

describe('adjust handle template contract', () => {
	it('carries the shared accessible name', () => {
		expect(template).toContain(`[attr.aria-label]="'pptx.selectionOverlay.adjust' | translate"`);
	});

	it('runs the adjustment gesture, not a south-east resize', () => {
		expect(template).toContain('(pointerdown)="onAdjustPointerDown($event)"');
		expect(template).not.toContain(`onHandlePointerDown($event, 'se')`);
	});
});
