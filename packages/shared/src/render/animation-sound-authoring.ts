/**
 * `animation-sound-authoring` — pure decision logic for the animation panel's
 * effect sound picker (`p:stSnd`).
 *
 * Playback already resolves and plays `PptxElementAnimation.soundRId` /
 * `soundPath` (see `pptx-viewer-shared/render/animation-sound` used by every
 * binding's presentation mode); what was missing was an AUTHORING control:
 * a way to choose "no sound" or a new audio file, with the choice actually
 * landing in the saved OOXML.
 *
 * Bundling stock sound assets (PowerPoint's own "Applause" / "Camera" /
 * "Chime" WAVs) was out of scope here: no such assets exist anywhere in this
 * repo (only a throwaway test fixture, `e2e/fixtures/media/tiny-audio.mp3`,
 * unsuitable to ship as a real feature). The picker this module supports is
 * therefore two states: **no sound**, or a **custom sound** the user chooses
 * from their own files. A `dataUrl` staged this way is a *pending* embed
 * (mirrors `imageData` / `mediaData`): `PptxHandlerRuntimeSaveSlideWriter`'s
 * `embedPendingAnimationSounds` converts it to real archive bytes and mints
 * an `audio` relationship on save, at which point `soundRId` / `soundPath`
 * become the resolved reference and `soundData` is cleared.
 *
 * @module render/animation-sound-authoring
 */
import type { PptxElementAnimation } from 'pptx-viewer-core';

import { animationFor, upsert } from './animation-authoring';

/** A newly-picked sound file, staged for embedding on the next save. */
export interface EffectSoundPick {
	/** `data:audio/...;base64,...` contents of the picked file. */
	dataUrl: string;
	/** Display name (e.g. the file's original name), shown by the picker. */
	fileName?: string;
}

/** Framework-neutral descriptor of an effect's current sound state. */
export interface EffectSoundState {
	/** Whether the effect currently has a sound bound, embedded or pending. */
	hasSound: boolean;
	/**
	 * Best-effort display name: the picked file's own name when known,
	 * otherwise the resolved archive path's file name for a sound that was
	 * already on the deck when it was opened.
	 */
	fileName?: string;
}

/**
 * Derive the sound picker's current state for one element's animation entry.
 * Returns "no sound" for an element with no animation entry at all (the
 * panel only shows the sound row once an effect exists).
 */
export function getEffectSoundState(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): EffectSoundState {
	const entry = animationFor(slideAnimations, elementId);
	if (!entry) {
		return { hasSound: false };
	}
	const hasSound = Boolean(entry.soundData || entry.soundRId);
	if (!hasSound) {
		return { hasSound: false };
	}
	const fileName = entry.soundFileName ?? lastPathSegment(entry.soundPath);
	return { hasSound: true, fileName };
}

function lastPathSegment(path: string | undefined): string | undefined {
	if (!path) {
		return undefined;
	}
	const segments = path.split('/');
	return segments[segments.length - 1] || undefined;
}

/**
 * Stage a newly-picked sound file on the element's animation entry, or clear
 * it entirely when `pick` is `undefined` ("No sound"). Either way, any
 * previously-resolved `soundRId` / `soundPath` is cleared: a fresh pick
 * supersedes it (the save-time embed step re-derives both), and clearing
 * removes it outright so the next save writes no `p:stSnd` for this effect.
 */
export function setEffectSound(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	pick: EffectSoundPick | undefined,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({
		...cur,
		soundData: pick?.dataUrl,
		soundFileName: pick?.fileName,
		soundRId: undefined,
		soundPath: undefined,
	}));
}
