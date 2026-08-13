import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shape-adjustment (amber diamond) handles.
 *
 * Angular used to render a GENERIC top-left corner handle for every selected
 * element, whose pointerdown resized from the south-east corner: it appeared
 * for shapes with nothing to adjust, sat in the wrong place, and adjusted
 * nothing. These tests pin it to the shared
 * `getShapeAdjustmentHandleDescriptors` / `getDraggedShapeAdjustments`
 * decision functions the other four bindings already consume, including the
 * part Angular missed for longest: a preset has ONE handle per `a:avLst` guide,
 * not one handle full stop.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_ROUND_RECT_ADJUSTMENT } from '../internal/shared';
import { computeSingleSelected } from './selection-geometry';
import {
	beginShapeAdjustmentDrag,
	computeAdjustHandles,
	draggedAdjustments,
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

describe('computeAdjustHandles', () => {
	it('is empty for a plain rect (nothing to adjust)', () => {
		const rect = shape('r', 'rect');
		expect(computeAdjustHandles(rect, box(rect), true, 24, 1)).toStrictEqual([]);
	});

	it('offers one handle for a roundRect', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandles(round, box(round), true, 24, 1)).toHaveLength(1);
	});

	it('offers ONE HANDLE PER a:avLst guide on a multi-adjust preset', () => {
		const arrow = shape('a', 'rightArrow');
		expect(computeAdjustHandles(arrow, box(arrow), true, 24, 1).map((h) => h.key)).toStrictEqual([
			'adj1',
			'adj2',
		]);
	});

	it('is empty for a roundRect locked with noAdjustHandles', () => {
		const round = shape('rr', 'roundRect', { locks: { noAdjustHandles: true } });
		expect(computeAdjustHandles(round, box(round), true, 24, 1)).toStrictEqual([]);
	});

	it('is empty when the canvas is not editable', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandles(round, box(round), false, 24, 1)).toStrictEqual([]);
	});

	it('offsets the shared element-local descriptor by the selection box origin', () => {
		const round = shape('rr', 'roundRect');
		const [handle] = computeAdjustHandles(round, box(round), true, 24, 1);
		// The descriptor sits on the TOP edge, `ss * adj / 100000` px along it
		// (ss = 120 here), and the 24px handle is centred on that point.
		const radius = (120 * DEFAULT_ROUND_RECT_ADJUSTMENT) / 100000;
		expect(handle.top).toBe(90 - 12);
		expect(handle.left).toBeCloseTo(40 + radius - 12, 3);
		expect(handle.key).toBe('adj');
		expect(handle.cursor).toBe('ew-resize');
	});

	it('scales its own size against the zoom so it stays 24 SCREEN px', () => {
		const round = shape('rr', 'roundRect');
		expect(computeAdjustHandles(round, box(round), true, 24, 2)[0].size).toBe(12);
	});
});

// ---------------------------------------------------------------------------
// Dragging it changes the adjustment, not the box
// ---------------------------------------------------------------------------

describe('draggedAdjustments', () => {
	const round = shape('rr', 'roundRect');
	const handleOf = () => computeAdjustHandles(round, box(round), true, 24, 1)[0];

	it('a rightward drag raises the corner radius above its default', () => {
		const state = beginShapeAdjustmentDrag(round, handleOf(), 500, 300);
		expect(state.startAdjustment).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT);
		// ss = 120 px spans 100000 guide units, so +40 px is +33333.
		expect(draggedAdjustments(state, 540, 300, 1).adj).toBe(50000);
		expect(draggedAdjustments(state, 510, 300, 1).adj).toBe(DEFAULT_ROUND_RECT_ADJUSTMENT + 8333);
	});

	it('a leftward drag lowers it, and clamps at zero', () => {
		const state = beginShapeAdjustmentDrag(round, handleOf(), 500, 300);
		expect(draggedAdjustments(state, 490, 300, 1).adj).toBeLessThan(DEFAULT_ROUND_RECT_ADJUSTMENT);
		expect(draggedAdjustments(state, -5000, 300, 1).adj).toBe(0);
	});

	it('converts the screen delta into slide px, so zoom does not change the result', () => {
		const state = beginShapeAdjustmentDrag(round, handleOf(), 500, 300);
		// 40 screen px at zoom 2 is the same 20 slide px as 20 screen px at zoom 1.
		expect(draggedAdjustments(state, 540, 300, 2).adj).toBe(
			draggedAdjustments(state, 520, 300, 1).adj,
		);
	});

	it('carries the captured solver, which is what converts px into guide units', () => {
		const state = beginShapeAdjustmentDrag(round, handleOf(), 0, 0);
		expect(state.solvers?.[0]?.key).toBe('adj');
		// The OOXML spelling reaches the state untouched: shared normalises it.
		expect(state.shapeType).toBe('roundRect');
	});

	it('drags the guide belonging to the handle that was grabbed, not always the first', () => {
		const arrow = shape('a', 'rightArrow');
		const handles = computeAdjustHandles(arrow, box(arrow), true, 24, 1);
		const state = beginShapeAdjustmentDrag(arrow, handles[1], 0, 0);
		expect(state.key).toBe('adj2');
		expect(draggedAdjustments(state, -30, 0, 1).adj2).not.toBe(50000);
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

	it('renders every handle, not just the first', () => {
		expect(template).toContain('@for (ah of adjustHandles(); track ah.key)');
	});

	it('runs the adjustment gesture on the grabbed handle, not a south-east resize', () => {
		expect(template).toContain('(pointerdown)="onAdjustPointerDown($event, ah)"');
		expect(template).not.toContain(`onHandlePointerDown($event, 'se')`);
	});
});
