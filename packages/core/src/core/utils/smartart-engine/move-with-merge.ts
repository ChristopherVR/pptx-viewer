/**
 * `dgm:layoutNode/@moveWith` (ECMA-376 Part 1, 21.4.2.19) pairs a hidden text
 * carrier with the sibling shape whose geometry it tracks. Two authoring
 * patterns share this attribute, and only one of them wants a merge:
 *
 * - Numbered Title List / Numbered Card List: `nodeText` (`hideGeom`,
 *   `presOf` axis `desOrSelf`) presents the SAME point as `bgRect`
 *   (`presOf` axis `self`) plus any demoted descendants folded in. Painting
 *   both doubles the item in the text-keyed comparison (the background
 *   under its own truncated text, the carrier under the fuller one) even
 *   though PowerPoint paints exactly one shape: `bgRect`'s geometry/style
 *   carrying `nodeText`'s fuller text. Here the carrier's presented ids are
 *   a SUPERSET of the target's own, so folding the extra ids into the
 *   target and dropping the carrier reproduces that one shape.
 * - Detailed Process: `childNode` (`hideGeom`, `presOf` axis `des` only)
 *   presents a DIFFERENT, demoted SIBLING point than `bgRect`'s own `self`
 *   point (a disjoint id set, not a superset) - PowerPoint paints these as
 *   two separate, independently positioned boxes (a promoted step's own
 *   card plus its demoted child's card alongside it), so the carrier must
 *   keep rendering on its own.
 *
 * `computeMoveWithMerge`'s `every` check below is exactly that distinction:
 * fold and suppress only when the target's own ids are already fully covered
 * by the carrier's, so the carrier is strictly "the target's content plus
 * more," never "different content the target doesn't have."
 */

import type { EngineNode } from './engine-node';

/** Data-model nodes this rendered point presents text for, in `presOf` order. */
export function sourceIdsOf(node: EngineNode): string[] {
	const ids: string[] = [];
	for (const point of node.presOf) {
		if (point.source && !ids.includes(point.source.id)) {
			ids.push(point.source.id);
		}
	}
	return ids;
}

export interface MoveWithMerge {
	/** `moveWith` target layout-node name -> extra source ids folded into it. */
	extraIdsByTarget: Map<string, string[]>;
	/** Carrier nodes that were folded into a target and must not render on their own. */
	suppressed: Set<EngineNode>;
	/**
	 * `moveWith` target layout-node name -> the carrier folded into it. The
	 * carrier is the `tx` node that actually sized the text (its own box,
	 * margins and `primFontSz` constraints), so font fitting reads it rather
	 * than the decorative target shape.
	 */
	carrierByTarget: Map<string, EngineNode>;
}

const NO_MERGE: MoveWithMerge = {
	extraIdsByTarget: new Map(),
	suppressed: new Set(),
	carrierByTarget: new Map(),
};

/**
 * `moveWith` only ever pairs SIBLINGS (nodes sharing the same parent), so
 * this is computed once per sibling group as the engine tree is walked, not
 * globally: see `engine-to-result.ts`'s `collectRenderedNodes`.
 */
export function computeMoveWithMerge(siblings: EngineNode[]): MoveWithMerge {
	if (siblings.length < 2) {
		return NO_MERGE;
	}
	const byName = new Map(siblings.map((s) => [s.name, s]));
	const extraIdsByTarget = new Map<string, string[]>();
	const suppressed = new Set<EngineNode>();
	const carrierByTarget = new Map<string, EngineNode>();
	for (const sibling of siblings) {
		const targetName = sibling.moveWith;
		if (!sibling.shape?.hideGeom || !targetName || targetName === sibling.name) {
			continue;
		}
		const target = byName.get(targetName);
		if (!target) {
			continue;
		}
		const carrierIds = sourceIdsOf(sibling);
		const targetIds = sourceIdsOf(target);
		if (carrierIds.length === 0 || !targetIds.every((id) => carrierIds.includes(id))) {
			continue;
		}
		// The carrier's ids fully cover the target's own: it presents nothing
		// the target doesn't already, so it is safe to drop unconditionally.
		// Fold in whatever it adds beyond that (descendant ids the target's
		// own `presOf` doesn't reach), if any.
		const extra = carrierIds.filter((id) => !targetIds.includes(id));
		if (extra.length > 0) {
			extraIdsByTarget.set(targetName, [...(extraIdsByTarget.get(targetName) ?? []), ...extra]);
		}
		suppressed.add(sibling);
		if (!carrierByTarget.has(targetName)) {
			carrierByTarget.set(targetName, sibling);
		}
	}
	return { extraIdsByTarget, suppressed, carrierByTarget };
}
