/**
 * Merge the editor's animation list with the deck's own effect groups into
 * one coherent ordering space, so the authoring UI can render (and
 * drag-to-reorder across) the FULL animation sequence, not just the effects
 * this editor added.
 *
 * `PptxSlide.animations` is parsed only from this app's own `pptx:editorMeta`
 * extension (see `animation-timing-ownership`), so it never contains the
 * deck's own effects. Those live only in the raw `p:timing` tree. This module
 * derives two things from that tree at load time, in the SAME `order`
 * numbering space:
 *
 *  - {@link PptxAnimationTimelineAnchor} entries for every top-level click
 *    group this editor does not fully own, so the UI has something to render
 *    and drop onto.
 *  - The `order` an editor-authored animation's OWN group currently occupies
 *    in that tree, overwriting whatever was stored in `pptx:editorMeta` (a
 *    separate, editor-only counter that cannot be compared against an
 *    anchor's position). Grounding `order` in the live tree on every load
 *    keeps the two populations comparable without persisting anything new.
 *
 * @module services/animation-timeline-anchors
 */
import type { PptxAnimationTimelineAnchor, PptxElementAnimation, XmlObject } from '../types';
import { groupTopLevelEffects } from './animation-timing-groups';
import { effectOwnershipKey, readOwnedEffectKeys } from './animation-timing-ownership';

/** The preset-class keys one editor animation entry currently claims. */
function ownershipKeysFor(anim: PptxElementAnimation): string[] {
	const keys: string[] = [];
	if (anim.entrance && anim.entrance !== 'none') {
		keys.push(effectOwnershipKey(anim.elementId, 'entr'));
	}
	if (anim.emphasis && anim.emphasis !== 'none') {
		keys.push(effectOwnershipKey(anim.elementId, 'emph'));
	}
	if (anim.exit && anim.exit !== 'none') {
		keys.push(effectOwnershipKey(anim.elementId, 'exit'));
	}
	if (anim.motionPath) {
		keys.push(effectOwnershipKey(anim.elementId, 'path'));
	}
	return keys;
}

/**
 * Compute native-effect anchors and re-grounded editor `order` values from
 * `rawTiming`, in the id space `animations[].elementId` is in at parse time
 * (the native `spid`, before {@link reconcileAnimationTargets} rewrites it to
 * the positional `element.id`). Call this BEFORE that reconciliation runs, and
 * pass its `anchors` through it too so their `targetIds` get the same rewrite.
 */
export function computeAnimationTimelineOrder(
	rawTiming: XmlObject,
	animations: readonly PptxElementAnimation[],
): { animations: PptxElementAnimation[]; anchors: PptxAnimationTimelineAnchor[] } {
	const ownedKeys = readOwnedEffectKeys(rawTiming);
	const groups = groupTopLevelEffects(rawTiming);

	const orderByOwnedKey = new Map<string, number>();
	const anchors: PptxAnimationTimelineAnchor[] = [];

	for (const group of groups) {
		const spidKeys = group.effects
			.filter((effect): effect is typeof effect & { spid: string } => Boolean(effect.spid))
			.map((effect) => effectOwnershipKey(effect.spid, effect.presetClass));
		const isFullyOwned = spidKeys.length > 0 && spidKeys.every((key) => ownedKeys.has(key));

		if (isFullyOwned) {
			for (const key of spidKeys) {
				orderByOwnedKey.set(key, group.index);
			}
			continue;
		}

		const targetIds = [
			...new Set(
				group.effects.map((effect) => effect.spid).filter((id): id is string => Boolean(id)),
			),
		];
		const presetClasses = [
			...new Set(group.effects.map((effect) => effect.presetClass)),
		] as PptxAnimationTimelineAnchor['presetClasses'];
		anchors.push({ order: group.index, targetIds, presetClasses });
	}

	const fallbackOrder = groups.length;
	const reconciled = animations.map((anim) => {
		const keys = ownershipKeysFor(anim);
		const knownOrders = keys
			.map((key) => orderByOwnedKey.get(key))
			.filter((order): order is number => order !== undefined);
		const order = knownOrders.length > 0 ? Math.min(...knownOrders) : (anim.order ?? fallbackOrder);
		return order === anim.order ? anim : { ...anim, order };
	});

	return { animations: reconciled, anchors };
}
