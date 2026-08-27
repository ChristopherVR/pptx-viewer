/**
 * Merge a deck's own effect sound (`p:stSnd` / `p:endSnd`, already resolved to
 * `soundRId` / `soundPath` on the native animation record) onto the matching
 * editor animation entry, when the editor entry does not already carry its
 * own sound state.
 *
 * The editor's own `pptx:editorMeta` extension (see
 * `PptxEditorAnimationService`) does not carry sound fields, so an element
 * this editor has never touched loses no information by omission, but an
 * element the user HAS added an entrance/exit/emphasis effect to (so it now
 * appears in the editor's `animations` list) would otherwise present an
 * `undefined` `soundRId` to the surgical timing writer. That writer treats
 * "no soundRId" as "the author wants no sound" and deletes whatever
 * `p:stSnd` the deck already had the next time ANY field on that effect is
 * edited (see `animation-timing-surgical`'s `updateEffectNodeAttributes`).
 * This merge, run once at load time right after `reconcileAnimationTargets`
 * (so both lists already share `element.id`), closes that gap.
 *
 * @module services/animation-sound-merge
 */
import type { PptxElementAnimation, PptxNativeAnimation } from '../types';

/** The sound-related fields copied from a native animation record. */
interface NativeSoundState {
	soundRId?: string;
	soundPath?: string;
	stopSound?: boolean;
}

export function mergeNativeSoundIntoEditorAnimations(
	nativeAnimations: readonly PptxNativeAnimation[] | undefined,
	editorAnimations: readonly PptxElementAnimation[] | undefined,
): void {
	if (!nativeAnimations || !editorAnimations || editorAnimations.length === 0) {
		return;
	}

	const soundByElement = new Map<string, NativeSoundState>();
	for (const nativeAnim of nativeAnimations) {
		if (!nativeAnim.targetId || soundByElement.has(nativeAnim.targetId)) {
			continue;
		}
		if (nativeAnim.soundRId || nativeAnim.stopSound) {
			soundByElement.set(nativeAnim.targetId, {
				soundRId: nativeAnim.soundRId,
				soundPath: nativeAnim.soundPath,
				stopSound: nativeAnim.stopSound,
			});
		}
	}
	if (soundByElement.size === 0) {
		return;
	}

	for (const editorAnim of editorAnimations) {
		if (editorAnim.soundRId !== undefined || editorAnim.soundData !== undefined) {
			continue;
		}
		const nativeSound = soundByElement.get(editorAnim.elementId);
		if (!nativeSound) {
			continue;
		}
		editorAnim.soundRId = nativeSound.soundRId;
		editorAnim.soundPath = nativeSound.soundPath;
		editorAnim.stopSound = nativeSound.stopSound;
	}
}
