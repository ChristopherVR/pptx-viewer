/**
 * group-ops: Pure, immutable group/ungroup operations for the slide element tree.
 *
 * No framework imports. No mutation of inputs. No `any` types. Shared by every
 * binding's editor.
 *
 * Coordinate system (verified from the renderer):
 *   - The group <div> is positioned at (group.x, group.y) in slide space.
 *   - Each child is positioned at (child.x, child.y) RELATIVE to the group's
 *     top-left corner inside that div.
 *
 * Therefore:
 *   - grouping   -> child slide-absolute -> child group-relative:
 *       childRelX = childAbsX - groupX
 *   - ungrouping -> child group-relative -> child slide-absolute:
 *       childAbsX = childRelX + groupX
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface GroupResult {
	/** New element array for the slide (same length - N + 1). */
	elements: PptxElement[];
	/**
	 * The id of the newly-created group element, or `null` when the operation
	 * was a no-op (fewer than 2 matching ids found).
	 */
	groupId: string | null;
}

export interface UngroupResult {
	/** New element array for the slide. */
	elements: PptxElement[];
	/** The child ids that were actually applied (one per child, in order). */
	childIds: string[];
}

// ---------------------------------------------------------------------------
// groupElements
// ---------------------------------------------------------------------------

/**
 * Gather the elements whose `id` is in `ids` (preserving their existing array
 * order), compute the union bounding box, build a new `group` element whose
 * `children` are positioned relative to the group's top-left corner, remove
 * the originals, and insert the group where the topmost (lowest-index) grouped
 * element was.
 *
 * Requires >= 2 ids that actually exist in `elements`; otherwise returns the
 * original array unchanged and `groupId: null`.
 *
 * The caller supplies `groupId` for determinism (the service passes its
 * `newId()` result).
 */
export function groupElements(
	elements: readonly PptxElement[],
	ids: readonly string[],
	groupId: string,
): GroupResult {
	// Build a fast lookup set.
	const idSet = new Set<string>(ids);

	// Collect matched elements in their existing array order, tracking the
	// index of the first (topmost in the array = furthest back in paint order)
	// matched element so we know where to insert the group.
	const gathered: PptxElement[] = [];
	let insertionIndex = -1;

	for (let i = 0; i < elements.length; i++) {
		const el = elements[i];
		if (idSet.has(el.id)) {
			gathered.push(el);
			if (insertionIndex === -1) {
				insertionIndex = i;
			}
		}
	}

	// Need at least 2 matched elements to form a meaningful group.
	if (gathered.length < 2) {
		return { elements: [...elements], groupId: null };
	}

	// Compute the union bounding box in slide-absolute coordinates.
	let minX = gathered[0].x;
	let minY = gathered[0].y;
	let maxX = gathered[0].x + gathered[0].width;
	let maxY = gathered[0].y + gathered[0].height;

	for (let i = 1; i < gathered.length; i++) {
		const el = gathered[i];
		if (el.x < minX) {
			minX = el.x;
		}
		if (el.y < minY) {
			minY = el.y;
		}
		const rx = el.x + el.width;
		const ry = el.y + el.height;
		if (rx > maxX) {
			maxX = rx;
		}
		if (ry > maxY) {
			maxY = ry;
		}
	}

	const groupX = minX;
	const groupY = minY;
	const groupWidth = maxX - minX;
	const groupHeight = maxY - minY;

	// Convert each child to group-relative coordinates.
	const children: PptxElement[] = gathered.map((el) => ({
		...el,
		x: el.x - groupX,
		y: el.y - groupY,
	}));

	const group: GroupPptxElement = {
		type: 'group',
		id: groupId,
		name: 'Group',
		x: groupX,
		y: groupY,
		width: groupWidth,
		height: groupHeight,
		children,
	};

	// Build the new array: keep all non-grouped elements, insert the group at
	// the position where the first matched element was.
	const remaining: PptxElement[] = elements.filter((el) => !idSet.has(el.id));

	// `insertionIndex` is the position in the *original* array. After removing
	// N grouped elements (all before or at that index minus those removed before
	// it), we need the adjusted position in `remaining`.
	// Count how many non-grouped elements appear before `insertionIndex`.
	let adjustedIndex = 0;
	for (let i = 0; i < insertionIndex; i++) {
		if (!idSet.has(elements[i].id)) {
			adjustedIndex++;
		}
	}

	const result: PptxElement[] = [
		...remaining.slice(0, adjustedIndex),
		group,
		...remaining.slice(adjustedIndex),
	];

	return { elements: result, groupId };
}

// ---------------------------------------------------------------------------
// ungroupElements
// ---------------------------------------------------------------------------

/**
 * Find the group element identified by `groupId` in `elements`. If found and
 * it is a `group`, replace it in-place with its children, each converted back
 * to slide-absolute coordinates (childX + groupX, childY + groupY) and
 * assigned a fresh id from the `childIds` array (one per child, in order).
 *
 * If the element is not found or is not a group, returns the original inputs
 * unchanged.
 *
 * The caller supplies `childIds` for determinism (the service passes one
 * `newId()` result per child).
 */
export function ungroupElements(
	elements: readonly PptxElement[],
	groupId: string,
	childIds: readonly string[],
): UngroupResult {
	const groupIndex = elements.findIndex((el) => el.id === groupId);
	if (groupIndex === -1) {
		return { elements: [...elements], childIds: [] };
	}

	const candidate = elements[groupIndex];
	if (candidate.type !== 'group') {
		return { elements: [...elements], childIds: [] };
	}

	const group = candidate;
	const usedChildIds: string[] = [];

	// Convert each child from group-relative to slide-absolute coordinates and
	// assign the supplied child id.
	const expanded: PptxElement[] = group.children.map((child, index) => {
		const newChildId = childIds[index] ?? child.id;
		usedChildIds.push(newChildId);
		return {
			...child,
			id: newChildId,
			x: child.x + group.x,
			y: child.y + group.y,
		};
	});

	// Splice the group out and spread the children in its place.
	const result: PptxElement[] = [
		...elements.slice(0, groupIndex),
		...expanded,
		...elements.slice(groupIndex + 1),
	];

	return { elements: result, childIds: usedChildIds };
}
