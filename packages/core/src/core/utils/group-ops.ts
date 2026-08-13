/**
 * Pure, immutable group / ungroup operations for a slide's element array.
 *
 * These live in core rather than in a binding (or in `pptx-viewer-shared`)
 * because THREE consumers need the same answer: every viewer binding through
 * shared, the SDK, and the `pptx-viewer-mcp` tool set that backs the AI panel.
 * `pptx-viewer-mcp` is published and shared is a private, never-published
 * package that already imports the tools, so the tools cannot import shared:
 * core is the only place all three can reach. The MCP copy had drifted (it
 * appended a new group to the END of the slide instead of putting it where the
 * grouped shapes stood, silently restacking the deck, and it re-ided nothing
 * when promoting a nested group out of a template group).
 *
 * Coordinate system (verified from the renderer):
 *   - The group is positioned at (group.x, group.y) in slide space.
 *   - Each child is positioned at (child.x, child.y) RELATIVE to the group's
 *     top-left corner.
 *
 * Therefore:
 *   - grouping   -> child slide-absolute -> child group-relative:
 *       childRelX = childAbsX - groupX
 *   - ungrouping -> child group-relative -> child slide-absolute:
 *       childAbsX = childRelX + groupX
 *
 * @module group-ops
 */
import type { GroupPptxElement, PptxElement } from '../types';
import { cloneElement } from './clone-utils';
import { createEditorId } from './element-utils';

/** Result of {@link groupElements}. */
export interface GroupResult {
	/** New element array for the slide (same length - N + 1). */
	elements: PptxElement[];
	/**
	 * The id of the newly-created group element, or `null` when the operation
	 * was a no-op (fewer than 2 matching ids found).
	 */
	groupId: string | null;
}

/** Result of {@link ungroupElements}. */
export interface UngroupResult {
	/** New element array for the slide. */
	elements: PptxElement[];
	/** The child ids that were actually applied (one per child, in order). */
	childIds: string[];
}

/** Options for {@link ungroupElements}. */
export interface UngroupOptions {
	/**
	 * Whether the promoted children land in the template (master/layout) store,
	 * so their whole subtree must keep a template id prefix. Edits route by that
	 * prefix, so a descendant left on the other store's prefix is edited into the
	 * wrong store and dropped on save. Defaults to the group's own id prefix.
	 */
	intoTemplate?: boolean;
}

/** Whether an element id routes to the template (layout / master) store. */
export function isTemplateElementId(elementId: string): boolean {
	return elementId.startsWith('layout-') || elementId.startsWith('master-');
}

/**
 * Build an id for a promoted / pasted element so it routes to the store it is
 * being inserted into: inside the template store it must keep the source's
 * `master-` / `layout-` prefix, because edits route by that prefix.
 */
export function makeStoreAwareId(intoTemplate: boolean, sourceId: string): string {
	if (!intoTemplate) {
		return createEditorId('el');
	}
	return sourceId.startsWith('master-')
		? `master-${createEditorId('el')}`
		: `layout-${createEditorId('el')}`;
}

/**
 * Re-id the DESCENDANTS of an already-cloned element, in place.
 *
 * `mintId` returns the replacement id for a descendant, or `undefined` to leave
 * it alone. The root's own id is left to the caller. Mutates `element`, so it
 * must only be handed a tree the caller has just cloned.
 */
export function reassignDescendantIds(
	element: PptxElement,
	mintId: (descendant: PptxElement) => string | undefined,
): void {
	if (element.type !== 'group') {
		return;
	}
	for (const child of element.children) {
		const next = mintId(child);
		if (next !== undefined) {
			child.id = next;
		}
		reassignDescendantIds(child, mintId);
	}
}

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
 * The caller supplies `groupId` for determinism.
 */
export function groupElements(
	elements: readonly PptxElement[],
	ids: readonly string[],
	groupId: string,
): GroupResult {
	const idSet = new Set<string>(ids);

	// Collect matched elements in their existing array order, tracking the index
	// of the first match so the group can take that slot (appending it instead
	// would move the whole selection to the front of the paint order).
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

	if (gathered.length < 2) {
		return { elements: [...elements], groupId: null };
	}

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

	// Convert each child to group-relative coordinates. The child is cloned so
	// the caller's originals (and any undo snapshot holding them) are untouched.
	const children: PptxElement[] = gathered.map((el) => {
		const child = cloneElement(el);
		child.x = el.x - minX;
		child.y = el.y - minY;
		return child;
	});

	const group: GroupPptxElement = {
		type: 'group',
		id: groupId,
		name: 'Group',
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
		children,
	};

	const remaining: PptxElement[] = elements.filter((el) => !idSet.has(el.id));

	// `insertionIndex` indexes the ORIGINAL array; count the survivors before it.
	let adjustedIndex = 0;
	for (let i = 0; i < insertionIndex; i++) {
		if (!idSet.has(elements[i].id)) {
			adjustedIndex++;
		}
	}

	return {
		elements: [...remaining.slice(0, adjustedIndex), group, ...remaining.slice(adjustedIndex)],
		groupId,
	};
}

/**
 * Replace the group identified by `groupId` with its children IN PLACE, each
 * converted back to slide-absolute coordinates and assigned a fresh id from
 * `childIds` (one per child, in order; a missing entry keeps the child's id).
 *
 * A promoted child is deep-cloned, so the group left behind in an undo snapshot
 * keeps its own copy of the subtree, and a promoted NESTED group's descendants
 * are re-ided when their ids route to the wrong store: only the top level was
 * ever renamed, which was invisible while a group could hold nothing but leaves.
 *
 * If the element is not found or is not a group, returns the inputs unchanged.
 */
export function ungroupElements(
	elements: readonly PptxElement[],
	groupId: string,
	childIds: readonly string[],
	options: UngroupOptions = {},
): UngroupResult {
	const groupIndex = elements.findIndex((el) => el.id === groupId);
	if (groupIndex === -1) {
		return { elements: [...elements], childIds: [] };
	}

	const group = elements[groupIndex];
	if (group.type !== 'group') {
		return { elements: [...elements], childIds: [] };
	}

	const intoTemplate = options.intoTemplate ?? isTemplateElementId(group.id);
	const usedChildIds: string[] = [];

	const expanded: PptxElement[] = group.children.map((child, index) => {
		const newChildId = childIds[index] ?? child.id;
		usedChildIds.push(newChildId);
		const promoted = cloneElement(child);
		promoted.id = newChildId;
		promoted.x = child.x + group.x;
		promoted.y = child.y + group.y;
		// Keep the whole promoted subtree in one store. A descendant already on
		// the right side keeps its id, so ungrouping on a slide does not churn
		// ids that animations and collaborators still refer to.
		reassignDescendantIds(promoted, (descendant) =>
			isTemplateElementId(descendant.id) === intoTemplate
				? undefined
				: makeStoreAwareId(intoTemplate, newChildId),
		);
		return promoted;
	});

	return {
		elements: [...elements.slice(0, groupIndex), ...expanded, ...elements.slice(groupIndex + 1)],
		childIds: usedChildIds,
	};
}
