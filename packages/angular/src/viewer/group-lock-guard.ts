/**
 * group-lock-guard: the `a:spLocks`/`a:grpSpLocks`/@noGrouping check for
 * `EditorStateService`'s group/ungroup commands.
 *
 * Split out of the (already oversized) `editor-state.service.ts` rather than
 * inlined there, per the repo's file-size convention. Thin wrapper around the
 * shared `canInteractWithElement` decision (`element-locks.ts`), which every
 * binding's group/ungroup entry point calls the same way (G10, OpenXML
 * parity audit D3).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { canInteractWithElement } from '../internal/shared';

/**
 * May every one of `ids` be grouped together?
 *
 * PowerPoint's `a:spLocks/@noGrouping` rejects the WHOLE grouping attempt
 * when it involves a locked shape, not just that one shape, so this checks
 * `every`, not `filter`.
 */
export function canGroupSelected(
	elements: readonly PptxElement[],
	ids: readonly string[],
): boolean {
	return ids
		.map((id) => elements.find((el) => el.id === id) ?? null)
		.every((el) => canInteractWithElement(el, 'group'));
}

/** May this specific group be ungrouped (`a:grpSpLocks/@noGrouping`)? */
export function canUngroupGroup(group: PptxElement | null | undefined): boolean {
	return canInteractWithElement(group, 'group');
}

/**
 * The classic toolbar's Group-button decision (`EditorToolbarComponent`):
 * needs >=2 selected ids and `a:spLocks/@noGrp` allowing all of them.
 */
export function canGroupSelectionOnSlide(
	slide: PptxSlide | undefined,
	ids: readonly string[],
): boolean {
	if (ids.length < 2) {
		return false;
	}
	return slide ? canGroupSelected(slide.elements, ids) : true;
}

/**
 * The classic toolbar's Ungroup-button decision (`EditorToolbarComponent`):
 * needs exactly one selected id that is itself a group, with
 * `a:grpSpLocks/@noGrp` allowing it.
 */
export function canUngroupSelectionOnSlide(
	slide: PptxSlide | undefined,
	ids: readonly string[],
): boolean {
	if (ids.length !== 1) {
		return false;
	}
	const target = slide?.elements.find((el) => el.id === ids[0]);
	return target?.type === 'group' && canUngroupGroup(target);
}

/**
 * The lock-only half of Group/Ungroup gating for the right-click menu
 * (`EditorContextMenuComponent`'s `selectionGroupable`): a single selected
 * element uses its own `a:grpSpLocks` (the Ungroup case), a multi-selection
 * checks every member's `a:spLocks` (the Group case). Independent of
 * selection count or element type, which the menu already gates separately.
 */
export function resolveContextMenuSelectionGroupable(
	slide: PptxSlide | undefined,
	ids: readonly string[],
): boolean {
	if (!slide) {
		return true;
	}
	if (ids.length === 1) {
		const el = slide.elements.find((e) => e.id === ids[0]);
		return el ? canUngroupGroup(el) : true;
	}
	return canGroupSelected(slide.elements, ids);
}
