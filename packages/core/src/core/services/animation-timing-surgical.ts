/**
 * Reconcile the editor's animation list into an existing `p:timing` tree.
 *
 * The timing tree is patched, never regenerated. A regenerated tree would drop
 * every structure this app does not model (nested sequences, `p:endCondLst`,
 * `p:iterate`, exclusive containers, text-build sub-targets), and those belong
 * to the deck, not to us. So each authored effect is matched to the existing
 * `p:cTn` that already targets the same shape with the same `@presetClass` and
 * patched in place; only a genuinely new effect creates nodes, and only an
 * effect this editor previously authored (see `animation-timing-ownership`) is
 * ever deleted.
 *
 * Until this existed the surgical path updated attributes ONLY, so adding an
 * effect in the animation panel wrote nothing but the private
 * `pptx:editorMeta` extension, deleting one wrote nothing at all, and both
 * looked correct on reload here while PowerPoint showed the original sequence.
 *
 * @module services/animation-timing-surgical
 */
import type { PptxAnimationPreset, PptxElementAnimation, XmlObject } from '../types';
import { reconcileBuildList } from './animation-timing-build-surgical';
import {
	effectOwnershipKey,
	readOwnedEffectKeys,
	writeOwnedEffectKeys,
} from './animation-timing-ownership';
import type { AuthoredPresetClass } from './animation-timing-place';
import { insertAuthoredEffect, reorderOwnedGroups } from './animation-timing-place';
import type { EffectNodeRef } from './animation-timing-tree';
import { indexEffectNodes, maxTimeNodeId, removeEffectNode } from './animation-timing-tree';
import {
	PRESET_TO_OOXML,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
} from './animation-write-mappings';
import {
	applyAfterEffectFlag,
	applyDimColorBehavior,
	applySoundToEffectCTn,
} from './animation-write-node-builders';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** One effect the editor list asks the timing tree to contain. */
interface DesiredEffect {
	anim: PptxElementAnimation;
	key: string;
	presetClass: AuthoredPresetClass;
	/** Ordinal used to sequence the effects this editor owns. */
	order: number;
}

/** Expand the editor list into one desired effect per populated preset slot. */
function collectDesiredEffects(animations: readonly PptxElementAnimation[]): DesiredEffect[] {
	const desired: DesiredEffect[] = [];
	animations.forEach((anim, index) => {
		const order = anim.order ?? index;
		const add = (presetClass: DesiredEffect['presetClass']): void => {
			desired.push({
				anim,
				key: effectOwnershipKey(anim.elementId, presetClass),
				presetClass,
				order,
			});
		};
		if (anim.entrance && anim.entrance !== 'none') {
			add('entr');
		}
		if (anim.emphasis && anim.emphasis !== 'none') {
			add('emph');
		}
		if (anim.exit && anim.exit !== 'none') {
			add('exit');
		}
		if (anim.motionPath) {
			add('path');
		}
	});
	return desired;
}

/**
 * The `spid:presetClass` keys an animation list claims.
 *
 * The full-rebuild path needs the same registry the reconcile path writes: a
 * tree this app generated from scratch is entirely editor-owned, and without
 * the record the very next save could not tell its own effects from the deck's
 * and would refuse to delete anything.
 */
export function ownedEffectKeysFor(animations: readonly PptxElementAnimation[]): Set<string> {
	return new Set(collectDesiredEffects(animations).map((entry) => entry.key));
}

/** The preset name that fills a given class on an editor animation. */
function presetNameForClass(
	anim: PptxElementAnimation,
	presetClass: string,
): PptxAnimationPreset | undefined {
	switch (presetClass) {
		case 'entr':
			return anim.entrance && anim.entrance !== 'none' ? anim.entrance : undefined;
		case 'exit':
			return anim.exit && anim.exit !== 'none' ? anim.exit : undefined;
		case 'emph':
			return anim.emphasis && anim.emphasis !== 'none' ? anim.emphasis : undefined;
		default:
			return undefined;
	}
}

/**
 * Patch an existing effect node's timing attributes from the editor animation,
 * leaving its structure (behaviour children, end conditions, iteration) alone.
 *
 * Also (re-)applies the effect's sound action, "hide" `afterEffect` flag, and
 * "dim after animation" colour behaviour every time: these are cheap to
 * re-derive from the editor entry and, unlike the other attributes here, an
 * absent value must actively CLEAR whatever the node currently has (see
 * `mergeNativeSoundIntoEditorAnimations`, which seeds `anim.soundRId` from the
 * deck's own `p:stSnd` at load time precisely so an untouched sound is never
 * mistaken for "no sound" and deleted here).
 */
function updateEffectNodeAttributes(
	cTn: XmlObject,
	anim: PptxElementAnimation,
	presetClass: string,
	shapeId: string,
	allocateId: () => number,
): void {
	const presetName = presetNameForClass(anim, presetClass);
	const mapping = presetName ? PRESET_TO_OOXML[presetName] : undefined;
	if (mapping) {
		cTn['@_presetID'] = String(mapping.presetId);
		cTn['@_presetClass'] = mapping.presetClass;
		const subtype = anim.direction
			? (DIRECTION_TO_SUBTYPE[anim.direction] ?? mapping.defaultSubtype)
			: mapping.defaultSubtype;
		cTn['@_presetSubtype'] = String(subtype);
	}

	if (anim.durationMs !== undefined) {
		cTn['@_dur'] = String(anim.durationMs);
	}
	if (anim.trigger !== undefined) {
		cTn['@_nodeType'] = triggerToNodeType(anim.trigger);
	}

	const stCondList = cTn['p:stCondLst'];
	if (isXmlObject(stCondList) && anim.delayMs !== undefined) {
		for (const cond of ensureArray(stCondList['p:cond'])) {
			cond['@_delay'] = String(anim.delayMs);
		}
	}

	applySoundToEffectCTn(cTn, anim);
	if (presetClass !== 'path') {
		applyAfterEffectFlag(cTn, anim);
	}
	if (presetClass !== 'exit' && presetClass !== 'path') {
		const durationMs = Number(cTn['@_dur']) || anim.durationMs || 0;
		applyDimColorBehavior(cTn, anim, shapeId, durationMs, allocateId);
	}
}

/**
 * Reconcile `animations` into `rawTiming`, mutating and returning the tree.
 *
 * Adds effects the tree lacks, retimes the ones it already has, deletes the
 * ones this editor previously authored and the list no longer names, and
 * sequences the groups it owns. Effects the editor never touched are left
 * exactly as they were.
 */
export function surgicallyUpdateTimingTree(
	rawTiming: XmlObject,
	animations: PptxElementAnimation[],
): XmlObject {
	const desired = collectDesiredEffects(animations);
	const previouslyOwned = readOwnedEffectKeys(rawTiming);
	if (desired.length === 0 && previouslyOwned.size === 0) {
		return rawTiming;
	}

	const byKey = new Map<string, EffectNodeRef>();
	for (const ref of indexEffectNodes(rawTiming)) {
		if (!ref.spid) {
			continue;
		}
		const key = effectOwnershipKey(ref.spid, ref.presetClass);
		if (!byKey.has(key)) {
			byKey.set(key, ref);
		}
	}

	let nextId = maxTimeNodeId(rawTiming) + 1;
	const allocateId = (): number => {
		nextId += 1;
		return nextId - 1;
	};

	const ownedNow = new Set<string>();
	const orderByKey = new Map<string, number>();
	for (const entry of desired) {
		ownedNow.add(entry.key);
		orderByKey.set(entry.key, entry.order);
		const existing = byKey.get(entry.key);
		if (existing) {
			updateEffectNodeAttributes(
				existing.cTn,
				entry.anim,
				entry.presetClass,
				existing.spid ?? entry.anim.elementId,
				allocateId,
			);
			continue;
		}
		insertAuthoredEffect({
			rawTiming,
			anim: entry.anim,
			presetClass: entry.presetClass,
			presetName: presetNameForClass(entry.anim, entry.presetClass),
			allocateId,
		});
	}

	for (const key of previouslyOwned) {
		if (ownedNow.has(key)) {
			continue;
		}
		const stale = byKey.get(key);
		if (stale) {
			removeEffectNode(stale);
		}
	}

	reorderOwnedGroups(rawTiming, orderByKey);
	writeOwnedEffectKeys(rawTiming, ownedNow);
	// Re-derive `p:bldLst/p:bldP` for any animation whose `sequence` field the
	// editor has set: everything else about this tree is patched in place
	// above, but a build's paragraph-level timing lives in a sibling of
	// `p:tnLst` that the effect-node patching never visits. See
	// `animation-timing-build-surgical` for why an untouched animation's
	// `p:bldP` is never rewritten.
	reconcileBuildList(rawTiming, animations);
	return rawTiming;
}
