import type { PptxElement } from 'pptx-viewer-core';
import type { ElementInteraction, ElementInteractivity } from 'pptx-viewer-shared';
import {
	canInteractWithElement,
	filterInteractableIds,
	isElementIdInteractive,
	resolveElementInteractivity,
} from 'pptx-viewer-shared';

import type { ViewerState } from '../state';
import { findActiveElement } from './editor-active-elements';

/**
 * Lock gates for the on-canvas gestures.
 *
 * PowerPoint's `a:spLocks` flags are parsed onto `element.locks`, and shared's
 * `element-locks` module owns the composition rules (`noSelect` subsumes
 * everything; every other flag gates exactly one gesture). This module is the
 * thin Vanilla adapter: it resolves ids against the ACTIVE element layer (the
 * slide, a template layer, or a master/layout view) and answers the three
 * questions the stage and the overlay ask.
 *
 * Nothing here re-derives a lock rule; every verdict comes from shared.
 */

const activeLookup =
	(state: ViewerState) =>
	(id: string): PptxElement | undefined =>
		findActiveElement(state, id);

/**
 * True when a press on `id` should behave as a hit on an element rather than
 * starting a marquee: the template-mode gate AND `a:spLocks/@noSelect`.
 */
export function isElementIdSelectable(state: ViewerState, id: string): boolean {
	return (
		isElementIdInteractive(id, state.editTemplateMode) &&
		canInteractWithElement(findActiveElement(state, id), 'select')
	);
}

/** The subset of `ids` that may still perform `interaction`, order preserved. */
export function interactableIds(
	state: ViewerState,
	ids: readonly string[],
	interaction: ElementInteraction,
): string[] {
	return filterInteractableIds(ids, activeLookup(state), interaction);
}

/**
 * May a move gesture start from a press on `id`?
 *
 * A press inside a multi-selection drags the whole selection, so it arms as
 * long as ONE member may move: PowerPoint leaves the pinned members behind
 * rather than refusing the drag (`interactableIds` does the leaving-behind).
 */
export function canBeginMoveGesture(state: ViewerState, id: string): boolean {
	const ids =
		state.selectedElementIds.length > 1 && state.selectedElementIds.includes(id)
			? state.selectedElementIds
			: [id];
	return interactableIds(state, ids, 'move').length > 0;
}

/** Nothing locked: the verdict an empty selection resolves to. */
const UNLOCKED: ElementInteractivity = resolveElementInteractivity(undefined);

function andInteractivity(a: ElementInteractivity, b: ElementInteractivity): ElementInteractivity {
	const merged = { ...a };
	for (const key of Object.keys(merged) as Array<keyof ElementInteractivity>) {
		merged[key] &&= b[key];
	}
	return merged;
}

/**
 * What the CURRENT selection may do: the per-element verdicts ANDed together,
 * so a multi-selection holding one pinned shape hides the handles that would
 * move it. Drives both the overlay chrome and the handle-gesture gates, so the
 * affordance a user can see is exactly the one that works.
 */
export function selectionInteractivity(state: ViewerState): ElementInteractivity {
	return state.selectedElementIds.reduce<ElementInteractivity>(
		(acc, id) => andInteractivity(acc, resolveElementInteractivity(findActiveElement(state, id))),
		UNLOCKED,
	);
}
