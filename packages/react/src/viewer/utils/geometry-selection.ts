/**
 * Selection bounds, clamping, and marquee geometry helpers for the PowerPoint
 * editor.
 *
 * The pure snap-to-shape maths now lives in `pptx-viewer-shared`
 * (`render/snap-guides` → `computeSnapToShape`); it is re-exported here as
 * `computeSnapToShapeResult` so `pointer-move-handlers` and the colocated test
 * keep their existing import. Shared defaults its threshold to `SNAP_THRESHOLD`
 * (6), matching the value this binding has always used. The pointer/drag driver
 * stays in `pointer-move-handlers`.
 */
import type { PptxElement } from 'pptx-viewer-core';

import { MIN_ELEMENT_SIZE } from '../constants';
import type { ElementBounds, MarqueeSelectionState } from '../types';

export { computeSnapToShape as computeSnapToShapeResult } from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Bounds / clamping helpers
// ---------------------------------------------------------------------------

export function clampPosition(value: number, max: number): number {
	return Math.min(Math.max(value, 0), Math.max(max, 0));
}

export function clampSize(value: number): number {
	return Math.max(value, MIN_ELEMENT_SIZE);
}

export function getSelectionBounds(elements: PptxElement[]): ElementBounds | null {
	if (elements.length === 0) {
		return null;
	}

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	elements.forEach((element) => {
		minX = Math.min(minX, element.x);
		minY = Math.min(minY, element.y);
		maxX = Math.max(maxX, element.x + Math.max(element.width, MIN_ELEMENT_SIZE));
		maxY = Math.max(maxY, element.y + Math.max(element.height, MIN_ELEMENT_SIZE));
	});

	if (
		!Number.isFinite(minX) ||
		!Number.isFinite(minY) ||
		!Number.isFinite(maxX) ||
		!Number.isFinite(maxY)
	) {
		return null;
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
	};
}

export function normalizeMarqueeRect(state: MarqueeSelectionState): ElementBounds {
	return {
		minX: Math.min(state.startX, state.currentX),
		minY: Math.min(state.startY, state.currentY),
		maxX: Math.max(state.startX, state.currentX),
		maxY: Math.max(state.startY, state.currentY),
	};
}

export function intersectsBounds(left: ElementBounds, right: ElementBounds): boolean {
	return !(
		left.maxX < right.minX ||
		left.minX > right.maxX ||
		left.maxY < right.minY ||
		left.minY > right.maxY
	);
}
