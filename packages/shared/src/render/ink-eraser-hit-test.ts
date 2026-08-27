/**
 * Draw-tab eraser hit-testing: which ink element a point falls on.
 *
 * The eraser walks the slide's elements top-most first and hit-tests each
 * erasable element's box, expanded by a tolerance radius so a thin stroke is
 * still easy to tap. Every binding implemented this loop independently
 * (React, Angular and Svelte agreed on a 15px radius; Vue used none, making
 * thin strokes hard to erase there). This is the single decision function; a
 * binding only needs to feed it a point and act on the returned id.
 *
 * Erasable types are `ink` (a stroke still open in the current editing
 * session) and `contentPart` (ink reloaded from a saved file, or from a
 * dirty save earlier in the same session): both are strokes the Draw
 * eraser should remove.
 *
 * @module render/ink-eraser-hit-test
 */
import type { PptxElement } from 'pptx-viewer-core';

/** Element types the Draw-tab eraser removes. */
const ERASABLE_TYPES = new Set<PptxElement['type']>(['ink', 'contentPart']);

/** Default tolerance (px, slide coordinate space) added around each element's box. */
export const ERASER_HIT_RADIUS = 15;

/**
 * Find the top-most erasable element whose box (expanded by `hitRadius`)
 * contains `point`, or `undefined` when nothing is hit.
 */
export function findEraserHitElementId(
	elements: readonly PptxElement[],
	point: { x: number; y: number },
	hitRadius: number = ERASER_HIT_RADIUS,
): string | undefined {
	for (let i = elements.length - 1; i >= 0; i--) {
		const el = elements[i];
		if (!ERASABLE_TYPES.has(el.type)) {
			continue;
		}
		if (
			point.x >= el.x - hitRadius &&
			point.x <= el.x + el.width + hitRadius &&
			point.y >= el.y - hitRadius &&
			point.y <= el.y + el.height + hitRadius
		) {
			return el.id;
		}
	}
	return undefined;
}
