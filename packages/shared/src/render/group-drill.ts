/**
 * Selecting inside a group, the way PowerPoint does: the first click selects
 * the group, a click on one of its members while the group is selected selects
 * that member, a click on another member of the same group moves the selection
 * to it, a double-click goes straight to the innermost shape (so its text can
 * be edited without ungrouping), and Escape steps back out one level.
 *
 * Group members are stored relative to their group (the parser subtracts the
 * parent's offset, see `PptxHandlerRuntimeGroupParsing`), and every binding's
 * lookups, selection chrome and update paths only know top-level elements. So
 * this module gives the bindings three things, framework-free:
 *
 *   - the decision (which id a click, double-click or Escape selects);
 *   - a geometric hit-test, because grouped children render with
 *     `pointer-events: none` and a click's DOM target is always the group;
 *   - a slide-space view of a member (absolute x/y) for the chrome, drag and
 *     inline editor, and the reverse: an update in slide space written back
 *     into the group's coordinate space.
 *
 * Only groups that are neither rotated nor flipped are entered: their members'
 * slide-space box is then a plain offset, and anything else keeps today's
 * behaviour (the group selects as one) instead of drawing chrome in the wrong
 * place.
 *
 * @module render/group-drill
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import { walkAndPatchElements } from '../loader/element-patch-walker';
import { canDrillDown, canInteractWithElement } from './element-locks';

function isGroup(el: PptxElement): el is GroupPptxElement {
	return el.type === 'group' && Array.isArray((el as GroupPptxElement).children);
}

/** A group whose members can be selected one by one (see the module note). */
export function isEnterableGroup(el: PptxElement): el is GroupPptxElement {
	return (
		isGroup(el) && !el.rotation && !el.flipHorizontal && !el.flipVertical && el.children.length > 0
	);
}

/**
 * The path from a top-level element down to `id`, outermost first; `null` when
 * `id` is nowhere on the slide. For a top-level element the path has one entry.
 */
export function findElementPath(
	elements: readonly PptxElement[],
	id: string,
): PptxElement[] | null {
	for (const el of elements) {
		if (el.id === id) {
			return [el];
		}
		if (isGroup(el)) {
			const inner = findElementPath(el.children, id);
			if (inner) {
				return [el, ...inner];
			}
		}
	}
	return null;
}

/** True when `id` is a member of a group (at any depth), not a top-level element. */
export function isGroupMember(elements: readonly PptxElement[], id: string): boolean {
	const path = findElementPath(elements, id);
	return path !== null && path.length > 1;
}

/**
 * The slide-space offset of a path's last element: the sum of its ancestor
 * groups' offsets. `null` when an ancestor isn't enterable (rotated, flipped),
 * because then no plain offset maps the member onto the slide.
 */
function ancestorOffset(path: readonly PptxElement[]): { dx: number; dy: number } | null {
	let dx = 0;
	let dy = 0;
	for (const ancestor of path.slice(0, -1)) {
		if (!isEnterableGroup(ancestor)) {
			return null;
		}
		dx += ancestor.x;
		dy += ancestor.y;
	}
	return { dx, dy };
}

/**
 * A member as the editor should see it: the same element with its x/y in slide
 * space, so selection chrome, drag, resize and the inline text editor can use
 * it like any top-level element. A top-level element comes back unchanged.
 * `null` when `id` isn't on the slide or sits in a group that can't be entered.
 */
export function slideSpaceElement(
	elements: readonly PptxElement[],
	id: string,
): PptxElement | null {
	const path = findElementPath(elements, id);
	if (!path) {
		return null;
	}
	const target = path[path.length - 1];
	if (path.length === 1) {
		return target;
	}
	const offset = ancestorOffset(path);
	if (!offset) {
		return null;
	}
	return { ...target, x: target.x + offset.dx, y: target.y + offset.dy } as PptxElement;
}

/**
 * Every member of every enterable group on the slide, in slide space, keyed by
 * id: what a binding merges into its element lookup so a member id resolves
 * like a top-level one.
 */
export function slideSpaceMembers(elements: readonly PptxElement[]): Map<string, PptxElement> {
	const out = new Map<string, PptxElement>();
	const visit = (list: readonly PptxElement[], dx: number, dy: number) => {
		for (const el of list) {
			if (!isEnterableGroup(el)) {
				continue;
			}
			const ox = dx + el.x;
			const oy = dy + el.y;
			for (const child of el.children) {
				out.set(child.id, { ...child, x: child.x + ox, y: child.y + oy } as PptxElement);
			}
			visit(el.children, ox, oy);
		}
	};
	visit(elements, 0, 0);
	return out;
}

/**
 * Apply `updates` to the element `id` wherever it is in the tree. Geometry in
 * `updates` is slide space (what the chrome and inline editor produce); for a
 * member it is translated back into its group's space before the patch, so a
 * dragged card lands where it was dropped. Untouched branches keep their
 * references ({@link walkAndPatchElements}). Returns the same array when `id`
 * isn't found.
 */
export function updateElementInTree(
	elements: PptxElement[],
	id: string,
	updates: Partial<PptxElement>,
): PptxElement[] {
	const path = findElementPath(elements, id);
	if (!path) {
		return elements;
	}
	const patch = { ...updates } as Partial<PptxElement> & { x?: number; y?: number };
	if (path.length > 1) {
		const offset = ancestorOffset(path) ?? { dx: 0, dy: 0 };
		if (typeof patch.x === 'number') {
			patch.x -= offset.dx;
		}
		if (typeof patch.y === 'number') {
			patch.y -= offset.dy;
		}
	}
	return walkAndPatchElements(elements, (el) =>
		el.id === id ? ({ ...el, ...patch } as PptxElement) : el,
	);
}

/** A point inside an element's box, honouring the element's own rotation. */
function containsPoint(el: PptxElement, px: number, py: number): boolean {
	const cx = el.x + el.width / 2;
	const cy = el.y + el.height / 2;
	const rad = ((el.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(-rad);
	const sin = Math.sin(-rad);
	const lx = (px - cx) * cos - (py - cy) * sin + cx;
	const ly = (px - cx) * sin + (py - cy) * cos + cy;
	return lx >= el.x && lx <= el.x + el.width && ly >= el.y && ly <= el.y + el.height;
}

/**
 * The ids under a slide-space point inside the top-level element `topId`,
 * innermost first and `topId` last -- the same order as
 * `resolveElementIdChain`, but found by geometry, since grouped children don't
 * receive pointer events. Later children win (they are drawn on top). The walk
 * stops above a `noDrilldown` group and above a `noSelect` member. A point
 * on the group but between its members yields just `[topId]`.
 */
export function memberChainAtPoint(
	elements: readonly PptxElement[],
	topId: string,
	point: { x: number; y: number },
): string[] {
	const top = elements.find((el) => el.id === topId);
	if (!top) {
		return [];
	}
	const chain: string[] = [topId];
	let group: PptxElement = top;
	let dx = 0;
	let dy = 0;
	// A group that forbids drilling (`noDrilldown`) selects as one.
	while (isEnterableGroup(group) && canDrillDown(group)) {
		const ox = dx + group.x;
		const oy = dy + group.y;
		let hit: PptxElement | null = null;
		for (let i = group.children.length - 1; i >= 0; i--) {
			const child = group.children[i];
			const abs = { ...child, x: child.x + ox, y: child.y + oy } as PptxElement;
			if (!child.hidden && containsPoint(abs, point.x, point.y)) {
				hit = child;
				break;
			}
		}
		// A locked (`noSelect`) member can't be selected, and it swallows the
		// click rather than letting it fall through to what it covers: the
		// selection stays at the group level.
		if (!hit || !canInteractWithElement(hit, 'select')) {
			break;
		}
		chain.unshift(hit.id);
		group = hit;
		dx = ox;
		dy = oy;
	}
	return chain;
}

/**
 * What a single click selects, given the chain under the pointer (innermost
 * first, top-level last) and the current selection:
 *
 *   - nothing of this chain selected: the top-level element (the group);
 *   - an ancestor in the chain selected: one level deeper, towards the pointer;
 *   - a member of one of the chain's groups selected (a sibling of what was
 *     hit, or inside it): the chain entry at that member's depth -- clicking
 *     another card of an entered group selects that card;
 *   - the hit element itself selected: it stays selected (the binding's own
 *     "click a selected shape again to edit its text" then applies).
 *
 * `selectedPath` is {@link findElementPath} of the current selection (or null).
 */
export function drillSelectionForClick(
	chain: readonly string[],
	selectedPath: readonly PptxElement[] | null,
): string | null {
	if (chain.length === 0) {
		return null;
	}
	const top = chain[chain.length - 1];
	if (!selectedPath || selectedPath.length === 0) {
		return top;
	}
	const selectedId = selectedPath[selectedPath.length - 1].id;
	const at = chain.indexOf(selectedId);
	if (at === 0) {
		return selectedId;
	}
	if (at > 0) {
		return chain[at - 1];
	}
	// The selection is elsewhere: inside one of the chain's groups? Its depth
	// (path length - 1) is where the new selection belongs. `chain` is
	// innermost-first, so depth d (0 = top level) is chain[length - 1 - d].
	const outermostFirst = [...chain].reverse();
	const depth = selectedPath.length - 1;
	const sharesAncestors =
		depth > 0 &&
		depth < outermostFirst.length &&
		selectedPath.slice(0, depth).every((el, i) => el.id === outermostFirst[i]);
	return sharesAncestors ? outermostFirst[depth] : top;
}

/** What a double-click selects: the innermost shape under the pointer, ready to edit. */
export function drillSelectionForDoubleClick(chain: readonly string[]): string | null {
	return chain.length > 0 ? chain[0] : null;
}

/**
 * What Escape selects from `selectedId`: its parent group when it is a member,
 * `null` (clear the selection) when it is top-level or unknown. Bindings leave
 * an inline text edit first, as they do today.
 */
export function parentSelection(
	elements: readonly PptxElement[],
	selectedId: string,
): string | null {
	const path = findElementPath(elements, selectedId);
	return path && path.length > 1 ? path[path.length - 2].id : null;
}
