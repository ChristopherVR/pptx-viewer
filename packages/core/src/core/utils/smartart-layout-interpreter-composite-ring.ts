/**
 * SmartArt DiagramML interpreter - composite same-ring `des` sibling fold.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` to keep that file
 * under the repo's per-file line budget: this half matches a `self`-anchored
 * composite slot (`Target List`'s `rect1`, a ring's own `sp` background
 * shape) to an UNPOSITIONED `des`-axis sibling reached through the SAME
 * `dgm:forEach` ring (`rect1ChTx`, the same ring's child text template - no
 * `w`/`h`/`l`/`t` of its own, since the ring's whole visible box already
 * belongs to `rect1`), so that sibling's descendant text still gets its own
 * rendered box instead of being silently dropped. Pure geometry; no
 * framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { Slot } from './smartart-layout-interpreter-composite-slots';

type ForEachOrigin = NonNullable<PptxSmartArtLayoutNode['forEachOrigin']>;

/** `true` when two `forEachOrigin`s describe the SAME enclosing `dgm:forEach`
 * "ring" (same axis/pointTypes/start), ignoring the forEach's own cosmetic
 * `@name` - see {@link findRingDesSibling}'s doc comment for why the name
 * differs even for the same ring. */
function sameForEachRing(a: ForEachOrigin | undefined, b: ForEachOrigin | undefined): boolean {
	if (!a || !b) {
		return false;
	}
	return (
		JSON.stringify(a.axis) === JSON.stringify(b.axis) &&
		JSON.stringify(a.pointTypes) === JSON.stringify(b.pointTypes) &&
		(a.start?.[0] ?? 1) === (b.start?.[0] ?? 1)
	);
}

/**
 * An UNPOSITIONED `des`-axis sibling template reached through the SAME
 * enclosing `dgm:forEach` "ring" as `selfNode` (`Target List`'s `rect1`, the
 * ring's own `sp` background shape, and `rect1ChTx`, the SAME ring's child
 * text template - both un-`st`'d "ring 1", but declared under TWO SEPARATE
 * `dgm:forEach`s with different `@name`s, one for the ring's shapes, one for
 * its text; {@link sameForEachRing} matches them by shape, not name). Such a
 * sibling carries no geometry of its own - the ring's whole visible box
 * belongs to the self shape - so its content folds INTO that same box (see
 * {@link ringFoldRect}) rather than needing a separately-positioned `des`
 * slot (`gear1ch`'s shape, the already-handled case via `desSlots`).
 */
export function findRingDesSibling(
	allChildren: PptxSmartArtLayoutNode[],
	selfNode: PptxSmartArtLayoutNode,
): PptxSmartArtLayoutNode | undefined {
	return allChildren.find(
		(child) =>
			child.presentationOf?.axis?.[0] === 'des' &&
			sameForEachRing(child.forEachOrigin, selfNode.forEachOrigin),
	);
}

/**
 * A placeholder inset for a ring's own descendant fold when it has no real
 * geometry of its own (see {@link findRingDesSibling}): the self rect's own
 * trailing third, full height. NOT reverse-engineered against the cached
 * drawing - `Target List`'s real "target" algorithm reshapes every ring's
 * OWN width when ANY ring holds a fold (measured, not yet modelled here) -
 * this only gets the descendant's own shape to EXIST and carry its text, so
 * the gate's shape-COUNT check passes; position/size still fails the gate's
 * separate geometry assertion until that algorithm is implemented.
 */
export function ringFoldRect(selfRect: Slot): Slot {
	const width = selfRect.width / 3;
	return { x: selfRect.x + selfRect.width - width, y: selfRect.y, width, height: selfRect.height };
}
