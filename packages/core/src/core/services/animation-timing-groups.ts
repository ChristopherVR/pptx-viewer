/**
 * Grouping of effect nodes by their top-level `p:par` click group.
 *
 * Split out of `animation-timing-tree` to keep that module to the structural
 * primitives; this is the one grouping view both native-anchor indexing
 * (`animation-timeline-anchors`) and editor-owned reordering
 * (`animation-timing-place`) build on.
 *
 * @module services/animation-timing-groups
 */
import type { XmlObject } from '../types';
import type { EffectNodeRef } from './animation-timing-tree';
import { findMainSequenceCTn, indexEffectNodes } from './animation-timing-tree';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** One top-level `p:par` click group under a `p:childTnLst`, together with the effect nodes it contains. */
export interface TopLevelGroup {
	/** The group's own container node (`{ 'p:cTn': ... }`). */
	node: XmlObject;
	/** The group's position among its `p:par` siblings before any reorder. */
	index: number;
	/** Every effect node (recursively) inside this group. */
	effects: EffectNodeRef[];
}

/**
 * Every top-level `p:par` click group directly under the main sequence's
 * `p:childTnLst`, each paired with the effect nodes nested inside it.
 *
 * This is the unit both native-anchor indexing and editor-owned reordering
 * work on: an effect is always reached through some top-level group, and
 * moving a group changes only its own slot among its siblings, never the
 * content of any node (its own or anyone else's).
 */
export function groupTopLevelEffects(rawTiming: XmlObject): TopLevelGroup[] {
	const mainSeqCTn = findMainSequenceCTn(rawTiming);
	const childTnLst = mainSeqCTn?.['p:childTnLst'];
	if (!isXmlObject(childTnLst)) {
		return [];
	}
	const allEffects = indexEffectNodes(rawTiming);
	return ensureArray(childTnLst['p:par']).map((node, index) => {
		const effects = allEffects.filter((ref) =>
			ref.chain.some((link) => link.holder === childTnLst && link.node === node),
		);
		return { node, index, effects };
	});
}
