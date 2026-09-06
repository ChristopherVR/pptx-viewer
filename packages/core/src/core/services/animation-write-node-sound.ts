/**
 * Effect-sound (`p:audio/p:sndTgt`) node assembly for the OOXML animation
 * write service. Extracted from `animation-write-node-behaviors` to keep
 * file sizes manageable.
 */
import type { PptxElementAnimation, XmlObject } from '../types';
import { ensureArray, isEffectSoundAudioNode } from './native-animation-helpers';

/**
 * Apply (or clear) an effect's sound action onto its `p:cTn`
 * (CT_TLCommonTimeNodeData). Shared by the full-rebuild builders
 * (`animation-write-node-effect.ts` / `animation-write-node-motion.ts`) and
 * the surgical updater (`animation-timing-surgical.ts`) so an existing
 * effect's sound can be edited without rebuilding the whole node.
 *
 * Writes the MODERN form PowerPoint itself uses (COM-verified against
 * PowerPoint 2016): a `p:audio/p:cMediaNode/p:tgtEl/p:sndTgt` node inside
 * `p:subTnLst`, a sibling of `p:childTnLst`, referencing the effect's own
 * `p:cTn/@_id` from its start condition. The legacy `p:stSnd` (directly on
 * `p:cTn`) is never written (PowerPoint does not recognise it back:
 * reopening a deck carrying only that form reports an empty
 * `Effect.EffectInformation.SoundEffect.Name`/`.Type`), but any pre-existing
 * one is cleaned up so a surgically-patched node does not keep a stale copy
 * alongside the modern one.
 *
 * Only touches the `p:audio` entries `isEffectSoundAudioNode` recognises as
 * the sound picker's own (`p:sndTgt`-targeted): other `p:subTnLst` content
 * (the "after animation" dim/hide behaviours built by
 * `applyAfterAnimationBehavior`, or a genuine embedded-media `p:audio`
 * targeting a real shape via `p:spTgt`) is left exactly as it was. Callers
 * must therefore run `applyAfterAnimationBehavior` FIRST when both apply to
 * the same effect: it deletes and rebuilds the whole `p:subTnLst` from
 * scratch, which would otherwise erase whatever this function just wrote.
 */
export function applySoundToEffectCTn(
	effectCTn: XmlObject,
	anim: Pick<PptxElementAnimation, 'soundRId' | 'soundName' | 'stopSound'>,
): void {
	delete effectCTn['p:stSnd'];
	delete effectCTn['p:endSnd'];
	if (anim.stopSound) {
		effectCTn['p:endSnd'] = {};
	}
	removeEffectSoundAudioNode(effectCTn);
	if (!anim.stopSound && anim.soundRId) {
		addEffectSoundAudioNode(effectCTn, anim.soundRId, anim.soundName);
	}
}

/** Strip any existing sound-picker `p:audio` entry from `effectCTn`'s `p:subTnLst`, leaving unrelated sub-timing content (after-animation, real media) untouched. */
function removeEffectSoundAudioNode(effectCTn: XmlObject): void {
	const subTnLst = effectCTn['p:subTnLst'] as XmlObject | undefined;
	if (!subTnLst) {
		return;
	}
	const remaining = ensureArray(subTnLst['p:audio']).filter(
		(node) => !isEffectSoundAudioNode(node),
	);
	if (remaining.length > 0) {
		subTnLst['p:audio'] = remaining.length === 1 ? remaining[0] : remaining;
	} else {
		delete subTnLst['p:audio'];
	}
	if (Object.keys(subTnLst).length === 0) {
		delete effectCTn['p:subTnLst'];
	}
}

/** Add the sound-picker `p:audio` entry to `effectCTn`'s `p:subTnLst`, creating it if absent and preserving any other content already there. */
function addEffectSoundAudioNode(
	effectCTn: XmlObject,
	soundRId: string,
	soundName: string | undefined,
): void {
	let subTnLst = effectCTn['p:subTnLst'] as XmlObject | undefined;
	if (!subTnLst) {
		subTnLst = {};
		effectCTn['p:subTnLst'] = subTnLst;
	}
	const effectId = effectCTn['@_id'] !== undefined ? String(effectCTn['@_id']) : '0';
	const sndTgt: XmlObject = { '@_r:embed': soundRId };
	if (soundName) {
		sndTgt['@_name'] = soundName;
	}
	const audioNode: XmlObject = {
		'p:cMediaNode': {
			'p:cTn': {
				'@_display': '0',
				'@_masterRel': 'sameClick',
				'p:stCondLst': {
					'p:cond': { '@_evt': 'begin', '@_delay': '0', 'p:tn': { '@_val': effectId } },
				},
				'p:endCondLst': {
					'p:cond': {
						'@_evt': 'onStopAudio',
						'@_delay': '0',
						'p:tgtEl': { 'p:sldTgt': {} },
					},
				},
			},
			'p:tgtEl': { 'p:sndTgt': sndTgt },
		},
	};
	const otherAudio = ensureArray(subTnLst['p:audio']).filter(
		(node) => !isEffectSoundAudioNode(node),
	);
	subTnLst['p:audio'] = otherAudio.length > 0 ? [...otherAudio, audioNode] : audioNode;
}
