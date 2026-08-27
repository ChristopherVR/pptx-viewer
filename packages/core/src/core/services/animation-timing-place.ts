/**
 * Where a newly authored effect goes in an existing `p:timing` tree, and how
 * the effects this editor owns are sequenced among the deck's own.
 *
 * Split out of `animation-timing-surgical` so that module keeps to the
 * decision logic (match / add / delete) and this one holds the placement
 * mechanics.
 *
 * @module services/animation-timing-place
 */
import type { PptxAnimationPreset, PptxElementAnimation, XmlObject } from '../types';
import { groupTopLevelEffects } from './animation-timing-groups';
import { effectOwnershipKey } from './animation-timing-ownership';
import {
	appendContainer,
	ensureMainSequence,
	findMainSequenceCTn,
	reorderContainersByRank,
} from './animation-timing-tree';
import { buildMotionPathNode, buildSingleEffectNode } from './animation-write-node-builders';
import {
	buildClickGroupNode,
	buildMainSequenceNode,
	wrapInInteractiveSequence,
} from './animation-write-sequence-builders';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** The OOXML preset class an authored effect occupies. */
export type AuthoredPresetClass = 'entr' | 'exit' | 'emph' | 'path';

/** Build the OOXML effect node for one authored slot, or `undefined` if unmapped. */
function buildEffectNode(
	anim: PptxElementAnimation,
	presetClass: AuthoredPresetClass,
	presetName: PptxAnimationPreset | undefined,
	allocateId: () => number,
): XmlObject | undefined {
	if (presetClass === 'path') {
		return buildMotionPathNode(anim, allocateId);
	}
	if (!presetName) {
		return undefined;
	}
	return buildSingleEffectNode(anim, presetName, presetClass, allocateId);
}

/**
 * Attach a freshly built effect to the main sequence, or to its own
 * interactive sequence when the trigger is a click on another shape.
 */
export function insertAuthoredEffect(args: {
	rawTiming: XmlObject;
	anim: PptxElementAnimation;
	presetClass: AuthoredPresetClass;
	presetName: PptxAnimationPreset | undefined;
	allocateId: () => number;
}): void {
	const { rawTiming, anim, presetClass, presetName, allocateId } = args;
	const effectNode = buildEffectNode(anim, presetClass, presetName, allocateId);
	if (!effectNode) {
		return;
	}

	const mainSeqCTn = ensureMainSequence(rawTiming, allocateId, (id) =>
		buildMainSequenceNode(id, []),
	);
	if (!mainSeqCTn) {
		return;
	}

	if (anim.trigger === 'onShapeClick' && anim.triggerShapeId) {
		// An interactive sequence is a SIBLING of the main sequence, not a child
		// of it: PowerPoint hangs both off the timing root's `p:childTnLst`.
		const holder = sequenceHolderOf(rawTiming, mainSeqCTn);
		if (holder) {
			appendContainer(
				holder,
				'p:seq',
				wrapInInteractiveSequence([effectNode], anim.triggerShapeId, allocateId),
			);
			return;
		}
	}

	const childTnLst = isXmlObject(mainSeqCTn['p:childTnLst'])
		? (mainSeqCTn['p:childTnLst'] as XmlObject)
		: {};
	mainSeqCTn['p:childTnLst'] = childTnLst;
	appendContainer(childTnLst, 'p:par', buildClickGroupNode([effectNode], allocateId));
}

/** The `p:childTnLst` (or `p:tnLst`) that holds the sequence owning `mainSeqCTn`. */
function sequenceHolderOf(rawTiming: XmlObject, mainSeqCTn: XmlObject): XmlObject | undefined {
	const tnLst = rawTiming['p:tnLst'];
	if (!isXmlObject(tnLst)) {
		return undefined;
	}
	let holder: XmlObject | undefined;
	const visit = (current: XmlObject): void => {
		for (const key of ['p:par', 'p:seq', 'p:excl']) {
			for (const node of ensureArray(current[key])) {
				const cTn = node['p:cTn'];
				if (!isXmlObject(cTn)) {
					continue;
				}
				if (cTn === mainSeqCTn) {
					holder ??= current;
					return;
				}
				const childTnLst = cTn['p:childTnLst'];
				if (isXmlObject(childTnLst)) {
					visit(childTnLst);
				}
			}
		}
	};
	visit(tnLst);
	return holder;
}

/**
 * Sequence every top-level click group, editor-owned or the deck's own, by
 * `orderByKey` (built from the panel's live `order` values, re-grounded
 * against the deck's own groups by `computeAnimationTimelineOrder` at load
 * time so the two populations share one numbering space).
 *
 * A group with at least one owned effect named in `orderByKey` moves to the
 * lowest rank among them, which is how an editor-authored effect can be
 * dragged ahead of or behind an effect the deck already had. A group with no
 * owned effect (or one the panel never repositioned) keeps its current slot:
 * only the ARRAY POSITION of a node ever changes here, never its content, so
 * a deck's own untouched effect stays byte-identical apart from where it
 * sits in the sequence.
 */
export function reorderOwnedGroups(
	rawTiming: XmlObject,
	orderByKey: ReadonlyMap<string, number>,
): void {
	const mainSeqCTn = findMainSequenceCTn(rawTiming);
	const childTnLst = mainSeqCTn?.['p:childTnLst'];
	if (!isXmlObject(childTnLst)) {
		return;
	}

	const ranks = new Map<XmlObject, number>();
	for (const group of groupTopLevelEffects(rawTiming)) {
		const ownedRanks = group.effects
			.map((effect) =>
				effect.spid
					? orderByKey.get(effectOwnershipKey(effect.spid, effect.presetClass))
					: undefined,
			)
			.filter((rank): rank is number => rank !== undefined);
		if (ownedRanks.length > 0) {
			ranks.set(group.node, Math.min(...ownedRanks));
		}
	}
	reorderContainersByRank(childTnLst, 'p:par', ranks);
}
