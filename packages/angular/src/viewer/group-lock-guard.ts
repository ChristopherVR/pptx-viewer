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
import type { PptxElement } from 'pptx-viewer-core';

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
