/**
 * Whether Edit Points may be offered for an element: the one gate every
 * entry point (context menu, ribbon, keyboard) asks, so the `noEditPoints`
 * lock and the element-type rule cannot drift between bindings.
 *
 * @module render/edit-points/edit-points-availability
 */
import type { PptxElement } from 'pptx-viewer-core';

import { canInteractWithElement } from '../element-locks';
import { isEditPointsCandidate } from './edit-points-import';

/** How Edit Points should be offered for an element. */
export type EditPointsAvailability = 'available' | 'locked' | 'unsupported';

/**
 * `available`: offer it; `locked`: offer it greyed out (the shape carries
 * `a:spLocks/@noEditPoints`, as PowerPoint greys the entry); `unsupported`:
 * do not offer it at all (not a shape, or no outline to edit).
 */
export function resolveEditPointsAvailability(
	element: PptxElement | null | undefined,
): EditPointsAvailability {
	if (!element || !isEditPointsCandidate(element)) {
		return 'unsupported';
	}
	return canInteractWithElement(element, 'editPoints') ? 'available' : 'locked';
}

/** Shorthand: may the user start Edit Points on `element` right now? */
export function canEditElementPoints(element: PptxElement | null | undefined): boolean {
	return resolveEditPointsAvailability(element) === 'available';
}
