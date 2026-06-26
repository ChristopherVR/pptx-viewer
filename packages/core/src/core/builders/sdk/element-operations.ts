/**
 * Element-level operations for the headless PPTX SDK.
 *
 * Pure, immutable helpers that take an element and return a new element
 * with the requested mutation applied. These are framework-agnostic and
 * can be used in any binding.
 */

import type { PptxElement, PptxShapeLocks } from '../../types';

/**
 * Lock or unlock an element by setting its {@link PptxShapeLocks} field.
 *
 * When `locked` is `true`, the element's `locks` are set to prevent the most
 * disruptive editor interactions: selecting, moving, and resizing. Other
 * granular lock flags (e.g. `noRotation`, `noTextEdit`) are left to the
 * caller to set explicitly via the `extraLocks` parameter.
 *
 * When `locked` is `false`, the `locks` field is removed entirely so the
 * element behaves as if no locks were ever specified.
 *
 * @param element - The element to update.
 * @param locked - Whether the element should be locked.
 * @param extraLocks - Additional lock flags merged in when locking.
 * @returns A new element object with the updated `locks` field.
 */
export function setElementLocked(
	element: PptxElement,
	locked: boolean,
	extraLocks: Partial<PptxShapeLocks> = {},
): PptxElement {
	if (!locked) {
		const { locks: _locks, ...rest } = element;
		return rest as PptxElement;
	}
	const locks: PptxShapeLocks = {
		noMove: true,
		noResize: true,
		noSelect: true,
		...extraLocks,
	};
	return { ...element, locks };
}
