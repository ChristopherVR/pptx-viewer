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

/** Fraction of the union two boxes must share to read as the same object. */
const CHILD_OVERLAP_RATIO = 0.5;

/**
 * Intersection over union of two element boxes.
 *
 * Exported because the same "these two occupy the same slot" question decides
 * whether a replaced text box dissolves in place or travels (`morph-text-slot`).
 */
export function boxOverlapRatio(a: PptxElement, b: PptxElement): number {
	const left = Math.max(a.x, b.x);
	const top = Math.max(a.y, b.y);
	const right = Math.min(a.x + a.width, b.x + b.width);
	const bottom = Math.min(a.y + a.height, b.y + b.height);
	if (right <= left || bottom <= top) {
		return 0;
	}
	const intersection = (right - left) * (bottom - top);
	const union = a.width * a.height + b.width * b.height - intersection;
	return union > 0 ? intersection / union : 0;
}

/** Whether two group children read as the same object, restyled or nudged. */
function childrenPair(a: PptxElement, b: PptxElement): boolean {
	const morphName = getElementMorphName(a);
	if (morphName !== undefined && getElementMorphName(b) === morphName) {
		return true;
	}
	if (a.name && a.name === b.name) {
		return true;
	}
	return boxOverlapRatio(a, b) >= CHILD_OVERLAP_RATIO;
}

/**
 * Whether two paired groups hold the SAME cast of objects, one for one.
 *
 * This is what decides between animating a group's contents individually and
 * dissolving the whole group into its counterpart, and PowerPoint draws the
 * line in the same place. Measured on the issue #131 deck by exporting the real
 * transitions to video (`CreateVideo`, 62.5fps) and fitting every frame of the
 * centre panel to a blend of the first and last:
 *
 *   - hub -> topic (`!!Circle` = disc + "Select Challenge", against disc +
 *     button + three paragraphs): every frame is a clean linear blend of the
 *     two end states, residual < 1/255, with the arriving title AND the
 *     departing wording both following the same curve. That is one object
 *     dissolving into another, not four shapes appearing and one leaving:
 *     unmatched shapes hold, then fade out by 23% and in from 42%, which would
 *     leave the middle of the transition empty (issue #146).
 *   - topic -> topic (five children against five, same boxes): also a clean
 *     blend, so decomposing there is harmless - each child simply crossfades
 *     into its own counterpart.
 *
 * So a group is decomposed only when its children line up; a group that gained
 * or lost content dissolves as a whole.
 *
 * Returns the one-for-one correspondence itself, not just a yes/no, because
 * that IS the pairing the matcher then has to honour: see
 * {@link morphGroupChildPairs}.
 */
function correspondingChildren(
	a: readonly PptxElement[],
	b: readonly PptxElement[],
): Array<[PptxElement, PptxElement]> | undefined {
	if (a.length !== b.length || a.length === 0) {
		return undefined;
	}
	const unclaimed = b.map((child) => child);
	const paired: Array<[PptxElement, PptxElement]> = [];
	for (const child of a) {
		const index = unclaimed.findIndex((candidate) => childrenPair(child, candidate));
		if (index < 0) {
			return undefined;
		}
		paired.push([child, unclaimed[index]]);
		unclaimed.splice(index, 1);
	}
	return paired;
}

/**
 * The elements of `elements` that a morph should treat as individual units,
 * given the `counterpart` slide's elements at the same level of the tree.
 *
 * A group is replaced by its children (in document order, recursively, in
 * absolute coordinates) when it holds a `!!`-named descendant, `counterpart`
 * holds a group it would pair with, AND the two groups hold the same cast of
 * objects; everything else is passed through untouched. See the module comment
 * for why the first two are required and {@link childrenCorrespond} for the
 * third.
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
			if (twinChildren && correspondingChildren(children, twinChildren)) {
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
 * The pairs {@link flattenMorphElements} implied when it took two groups apart,
 * as `outgoing element id -> incoming element id`.
 *
 * A group is only decomposed once its children have been shown to line up one
 * for one (see {@link correspondingChildren}), which is a statement that these
 * five shapes ARE those five shapes. The matcher has to be told, because it
 * cannot see it: the flat list it works on has lost the grouping, and its
 * general passes deliberately refuse to pair two text boxes that sit in the same
 * place but say different things ("same place, different words" is normally a
 * rebuilt panel, not one object that moved).
 *
 * That refusal is exactly wrong here. The wheel deck's topic slides each hold
 * the same panel with the challenge's own wording, so every topic-to-topic morph
 * left its three text boxes unpaired: the old wording faded out inside the first
 * quarter, the new one only began at 42%, and the middle of the transition was
 * empty. PowerPoint crossfades them - measured on its own render of slides 5->6
 * (`CreateVideo`, 62.5fps), where every frame of that panel is a blend of the
 * two end states whose weights sum to 1.000 for the whole transition (issue
 * #160).
 *
 * @param elements - The outgoing slide's top-level elements.
 * @param counterpart - The incoming slide's top-level elements.
 * @returns Outgoing id -> incoming id for every corresponded child, recursively.
 */
export function morphGroupChildPairs(
	elements: readonly PptxElement[],
	counterpart: readonly PptxElement[],
): Map<string, string> {
	const pairs = new Map<string, string>();
	collectGroupChildPairs(elements, counterpart, pairs);
	return pairs;
}

/** Walk both trees the way {@link flattenMorphElements} does, recording pairs. */
function collectGroupChildPairs(
	elements: readonly PptxElement[],
	counterpart: readonly PptxElement[],
	into: Map<string, string>,
): void {
	for (const element of elements) {
		const children = groupChildren(element);
		if (!children || !containsMorphNamedDescendant(element)) {
			continue;
		}
		const twin = correspondingGroup(element, counterpart);
		const twinChildren = twin ? (groupChildren(twin) ?? []) : undefined;
		const corresponded = twinChildren ? correspondingChildren(children, twinChildren) : undefined;
		if (!corresponded) {
			continue;
		}
		for (const [child, twinChild] of corresponded) {
			into.set(child.id, twinChild.id);
		}
		collectGroupChildPairs(children, twinChildren ?? [], into);
	}
}

/**
 * True when `elements` holds a group that {@link flattenMorphElements} could
 * decompose against some counterpart. Lets a caller skip the copy entirely for
 * the overwhelmingly common case of a slide with no `!!`-named group content.
 */
export function needsMorphFlattening(elements: readonly PptxElement[]): boolean {
	return elements.some((element) => containsMorphNamedDescendant(element));
}
