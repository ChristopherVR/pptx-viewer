import type { ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { moveEditNode } from './edit-points-drag-ops';
import { EDIT_POINTS_PATH_SCALE, editGeometryToElementPatch } from './edit-points-export';
import { editFrameFromElement, editLocalToSlide, editSlideToLocal } from './edit-points-frame';
import { editGeometryFromElement } from './edit-points-import';

function shape(extra: Partial<ShapePptxElement>): ShapePptxElement {
	return { id: 's1', type: 'shape', x: 100, y: 50, width: 200, height: 100, ...extra };
}

describe('edit frame', () => {
	it('round-trips slide and local coordinates through rotation and flips', () => {
		const frame = editFrameFromElement(
			shape({ rotation: 33, flipHorizontal: true, flipVertical: false }),
		);
		const local = { x: 17, y: 83 };
		const back = editSlideToLocal(frame, editLocalToSlide(frame, local));
		expect(back.x).toBeCloseTo(17, 9);
		expect(back.y).toBeCloseTo(83, 9);
	});

	it('is the plain offset for an unrotated shape', () => {
		const frame = editFrameFromElement(shape({}));
		expect(editLocalToSlide(frame, { x: 0, y: 0 })).toStrictEqual({ x: 100, y: 50 });
	});
});

describe('editGeometryToElementPatch', () => {
	it('writes a custGeom freeform in EMU path space and clears the preset state', () => {
		const element = shape({ shapeType: 'rect', shapeAdjustments: { adj: 5000 } });
		const patch = editGeometryToElementPatch(
			editGeometryFromElement(element)!,
			editFrameFromElement(element),
		)!;
		expect(patch.shapeType).toBe('custom');
		expect(patch.shapeAdjustments).toBeUndefined();
		expect(patch).toMatchObject({ x: 100, y: 50, width: 200, height: 100 });
		expect(patch.pathWidth).toBe(200 * EDIT_POINTS_PATH_SCALE);
		expect(patch.pathHeight).toBe(100 * EDIT_POINTS_PATH_SCALE);
		expect(patch.customGeometryPaths?.[0].segments.map((s) => s.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'lineTo',
			'lineTo',
			'close',
		]);
		expect(patch.pathData).toMatch(/^M 0 0 L 1905000 0 /);
		expect(patch).toHaveProperty('customGeometryRawData', undefined);
	});

	it('re-anchors the box to the new bounds when a vertex moves outside it', () => {
		const element = shape({ shapeType: 'rect' });
		const geometry = moveEditNode(
			editGeometryFromElement(element)!,
			{ subpath: 0, node: 2 },
			{ x: 260, y: 140 },
		);
		const patch = editGeometryToElementPatch(geometry, editFrameFromElement(element))!;
		expect(patch).toMatchObject({ x: 100, y: 50, width: 260, height: 140 });
	});

	it('keeps a rotated outline in place on the slide after re-anchoring', () => {
		const element = shape({ shapeType: 'rect', rotation: 40, flipVertical: true });
		const frame = editFrameFromElement(element);
		const moved = moveEditNode(
			editGeometryFromElement(element)!,
			{ subpath: 0, node: 0 },
			{ x: -50, y: -30 },
		);
		const patch = editGeometryToElementPatch(moved, frame)!;
		const before = editLocalToSlide(frame, { x: 200, y: 100 });
		// Same vertex, now expressed in the re-anchored element's frame.
		const nextFrame = editFrameFromElement({ ...element, ...patch });
		const after = editLocalToSlide(nextFrame, { x: 200 + 50, y: 100 + 30 });
		expect(after.x).toBeCloseTo(before.x, 6);
		expect(after.y).toBeCloseTo(before.y, 6);
	});

	it('returns nothing for an empty geometry', () => {
		expect(
			editGeometryToElementPatch({ subpaths: [] }, editFrameFromElement(shape({}))),
		).toBeUndefined();
	});

	it('keeps a converted preset text box where the preset had it', () => {
		const element = shape({ shapeType: 'ellipse' });
		const patch = editGeometryToElementPatch(
			editGeometryFromElement(element)!,
			editFrameFromElement(element),
		)!;
		const rect = patch.customGeometryTextRect!;
		// An ellipse's text box is inset from its bounding box on every side.
		expect(Number(rect.l)).toBeGreaterThan(0);
		expect(Number(rect.t)).toBeGreaterThan(0);
		expect(Number(rect.r)).toBeLessThan(patch.pathWidth!);
		expect(Number(rect.b)).toBeLessThan(patch.pathHeight!);
	});
});
