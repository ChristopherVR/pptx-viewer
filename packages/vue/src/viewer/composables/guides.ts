/**
 * guides: pure helpers for the View ▸ H/V Guides feature (draggable alignment
 * guides). Vue port of the guide logic in React's `useViewerDialogs` /
 * `ViewerCanvasArea`. Kept framework-free so it can be unit-tested in isolation.
 */
import type { CanvasSize } from '../types';

/** A single alignment guide, positioned in authored slide pixels. */
export interface Guide {
	id: string;
	axis: 'h' | 'v';
	position: number;
}

/**
 * Build a new guide centred on the slide: horizontal guides sit at half the
 * slide height, vertical guides at half the width (mirrors React's
 * `handleAddGuide`). `id` is supplied by the caller so the source stays pure.
 */
export function createGuide(id: string, axis: 'h' | 'v', canvas: CanvasSize): Guide {
	return {
		id,
		axis,
		position: axis === 'h' ? canvas.height / 2 : canvas.width / 2,
	};
}

/**
 * Return `guides` with the matching guide moved to `position`, clamped to the
 * slide bounds for its axis (h → [0, height], v → [0, width]).
 */
export function moveGuide(
	guides: Guide[],
	id: string,
	position: number,
	canvas: CanvasSize,
): Guide[] {
	return guides.map((guide) => {
		if (guide.id !== id) {
			return guide;
		}
		const max = guide.axis === 'h' ? canvas.height : canvas.width;
		return { ...guide, position: Math.max(0, Math.min(max, position)) };
	});
}

/** Return `guides` without the guide whose id matches. */
export function removeGuide(guides: Guide[], id: string): Guide[] {
	return guides.filter((guide) => guide.id !== id);
}
