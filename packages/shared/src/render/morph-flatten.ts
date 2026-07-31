/**
 * Decompose the groups that take part in a morph, so the shapes INSIDE two
 * corresponding groups can be paired with each other.
 *
 * PowerPoint matches a morph level by level: it pairs the two slides' top-level
 * objects first, and only looks inside a group once that group itself has been
 * paired. A group is one object until then, so a shape nested in a group on one
 * slide and sitting top-level on the other is NOT carried through, even under
 * the `!!` naming convention.
 *
 * That was measured, not assumed. Driving PowerPoint 16 through a windowed
 * slide show and sampling the rendered frames (25ms apart) over the issue #131
 * wheel deck shows the centre disc, which is `!!Content` top-level on the
 * overview slide and `!!Content` inside a `!!Circle` group on every topic
 * slide:
 *
 *   - overview -> topic (3->4): the disc dissolves out and back in. The pixel
 *     at the disc's centre reads RGB 39,40,42 (opaque) at 0ms, 174,194,204
 *     (the artwork BEHIND it) from 324ms to 449ms, and 39,40,42 again by 983ms.
 *     PowerPoint did not pair the two halves.
 *   - topic -> topic (4->5, 5->9): the same pixel holds 39,40,42 for the whole
 *     transition. The two `!!Circle` groups paired, so their contents did too.
 *
 * So a group is decomposed only when the OTHER slide has a group it would pair
 * with, which reproduces both halves of that measurement. Groups without a
 * counterpart stay whole and dissolve as one object, and ordinary grouped
 * artwork keeps animating as a single unit exactly as before.
 *
 * Decomposed children are returned with ABSOLUTE slide coordinates, because
 * that is the space every downstream geometry calculation (deltas, proximity)
 * works in. A binding renders group children as absolutely positioned boxes
 * inside the group's own box, and the group carries no extra scale, so a
 * translation delta in slide space is also correct inside the group - which is
 * what lets the incoming half animate the child's own node in place.
 *
 * @module render/morph-flatten
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import { getElementMorphName } from './morph-name';

/** Children of `element` when it is a group, else `undefined`. */
function groupChildren(element: PptxElement): PptxElement[] | undefined {
	if (element.type !== 'group') {
		return undefined;
	}
	const children = (element as GroupPptxElement).children;
	return Array.isArray(children) && children.length > 0 ? children : undefined;
}

/** Whether `element` or any descendant carries a `!!` morph name. */
function containsMorphNamedDescendant(element: PptxElement): boolean {
	const children = groupChildren(element);
	if (!children) {
		return false;
	}
	for (const child of children) {
		if (getElementMorphName(child) !== undefined || containsMorphNamedDescendant(child)) {
			return true;
		}
	}
	return false;
}

/**
 * Re-express a group child in absolute slide coordinates.
 *
 * Group children are stored relative to their group's box origin, already in
 * the group's rendered scale, so an absolute position is the running sum of the
 * ancestors' origins.
 */
function toAbsolute(child: PptxElement, offsetX: number, offsetY: number): PptxElement {
	if (offsetX === 0 && offsetY === 0) {
		return child;
	}
	return { ...child, x: child.x + offsetX, y: child.y + offsetY } as PptxElement;
}

/** Boxes agree on all four numbers to within a sub-pixel tolerance. */
function sameBox(a: PptxElement, b: PptxElement): boolean {
	return (
		Math.abs(a.x - b.x) <= 0.5 &&
		Math.abs(a.y - b.y) <= 0.5 &&
		Math.abs(a.width - b.width) <= 0.5 &&
		Math.abs(a.height - b.height) <= 0.5
	);
}

/**
 * The group among `candidates` that a morph would pair `group` with, if any.
 *
 * Only signals strong enough to mean "the same container, restyled or moved"
 * count: the `!!` morph name, the Selection Pane name, or an identical box.
 * Proximity deliberately does not, because two unrelated groups that merely sit
 * near each other must keep animating as whole objects.
 */
function correspondingGroup(
	group: PptxElement,
	candidates: readonly PptxElement[],
): PptxElement | undefined {
	const morphName = getElementMorphName(group);
	return candidates.find((candidate) => {
		if (candidate.type !== 'group') {
			return false;
		}
		if (morphName !== undefined && getElementMorphName(candidate) === morphName) {
			return true;
		}
		if (group.name && candidate.name === group.name) {
			return true;
		}
		return sameBox(group, candidate);
	});
}

/**
 * The elements of `elements` that a morph should treat as individual units,
 * given the `counterpart` slide's elements at the same level of the tree.
 *
 * A group is replaced by its children (in document order, recursively, in
 * absolute coordinates) when it holds a `!!`-named descendant AND `counterpart`
 * holds a group it would pair with; everything else is passed through
 * untouched. See the module comment for why both conditions are required.
 */
export function flattenMorphElements(
	elements: readonly PptxElement[],
	counterpart: readonly PptxElement[],
	offsetX = 0,
	offsetY = 0,
): PptxElement[] {
	const out: PptxElement[] = [];
	for (const element of elements) {
		const children = groupChildren(element);
		if (children && containsMorphNamedDescendant(element)) {
			const twin = correspondingGroup(element, counterpart);
			const twinChildren = twin ? (groupChildren(twin) ?? []) : undefined;
			if (twinChildren) {
				out.push(
					...flattenMorphElements(children, twinChildren, offsetX + element.x, offsetY + element.y),
				);
				continue;
			}
		}
		out.push(toAbsolute(element, offsetX, offsetY));
	}
	return out;
}

/**
 * True when `elements` holds a group that {@link flattenMorphElements} could
 * decompose against some counterpart. Lets a caller skip the copy entirely for
 * the overwhelmingly common case of a slide with no `!!`-named group content.
 */
export function needsMorphFlattening(elements: readonly PptxElement[]): boolean {
	return elements.some((element) => containsMorphNamedDescendant(element));
}
