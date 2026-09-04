/**
 * Slide-transition sound playback (`p:transition/p:sndAc/p:stSnd` and
 * `p:endSndAc`), as opposed to `slide-transition-sound.ts` (the AUTHORING
 * picker that lets the Transitions ribbon attach/clear a sound file).
 *
 * PowerPoint's Transitions ribbon > Sound dropdown attaches a sound to a
 * slide's transition: `p:stSnd` (with `@loop`, "Loop Until Next Sound") plays
 * a new sound the instant the transition starts; `p:endSnd` ("Stop Previous
 * Sound") silences whatever transition sound is already playing instead.
 * Before this module, only React played `p:stSnd` at all (via its own
 * ad hoc `new Audio()` call sequenced through `onPlayActionSound`), Angular
 * handed the RAW in-archive path straight to `new Audio()` (a guaranteed 404,
 * since the browser cannot fetch a path inside a `.pptx` zip), and
 * Vue/Svelte/Vanilla had no transition-sound code at all. `p:endSnd` was
 * wired nowhere.
 *
 * {@link resolveTransitionSoundAction} is the pure decision (what a
 * transition's sound-action list means, given nothing but the transition
 * object); {@link playTransitionSound}/{@link stopTransitionSound} are the
 * tiny DOM-audio primitives every binding already re-implements one-for-one
 * as `playAnimationSound`/`stopAnimationSound` (per-effect `p:cBhvr` sound,
 * a distinct construct) - so `applySlideTransitionSound` deliberately takes a
 * `play`/`stop` pair as parameters rather than owning its own singleton,
 * letting every binding reuse the SAME "one sound plays at a time" primitive
 * for both constructs instead of running two independent audio channels that
 * could talk over each other.
 *
 * @module render/slide-transition-sound-playback
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';

/**
 * What a slide transition's sound-action list means at the moment the
 * transition starts.
 *
 * `'play'` and `'stop'` are mutually exclusive on a single transition (core's
 * `PptxSlideTransition` comment on `stopSound` says as much: `p:stSnd` and
 * `p:endSnd` are alternatives within `p:sndAc`), so this is a plain union
 * rather than two independent booleans.
 */
export type TransitionSoundAction =
	| { kind: 'play'; soundPath: string; loop: boolean }
	| { kind: 'stop' }
	| { kind: 'none' };

/**
 * Decide what `transition`'s sound action means, without resolving the sound
 * path to a playable URL (each binding already has its own cache/loader for
 * that - see {@link applySlideTransitionSound}).
 */
export function resolveTransitionSoundAction(
	transition: PptxSlideTransition | undefined,
): TransitionSoundAction {
	if (!transition) {
		return { kind: 'none' };
	}
	if (transition.soundPath) {
		return { kind: 'play', soundPath: transition.soundPath, loop: transition.soundLoop === true };
	}
	if (transition.stopSound) {
		return { kind: 'stop' };
	}
	return { kind: 'none' };
}

/** The two primitives every binding's `animation-sound.ts` already exports. */
export interface TransitionSoundPlayer {
	/** Play `url`, replacing any sound already playing on this channel. */
	play: (url: string, loop: boolean) => void;
	/** Stop whatever is currently playing on this channel, if anything. */
	stop: () => void;
}

/**
 * Resolve `soundPath` to a playable URL and hand it to `player`.
 *
 * `resolveUrl` is deliberately loose (sync-or-async, `undefined`-tolerant) so
 * a binding can pass a plain `Map.prototype.get` (the common case, since every
 * binding's load pipeline pre-resolves transition sounds into its
 * `mediaDataUrls` cache via `collectAnimationSoundPaths`) or an async fetch
 * fallback without this module caring which.
 */
export function applySlideTransitionSound(
	transition: PptxSlideTransition | undefined,
	resolveUrl: (soundPath: string) => string | undefined | Promise<string | undefined>,
	player: TransitionSoundPlayer,
): void {
	const action = resolveTransitionSoundAction(transition);
	if (action.kind === 'stop') {
		player.stop();
		return;
	}
	if (action.kind === 'none') {
		return;
	}
	const resolved = resolveUrl(action.soundPath);
	if (resolved instanceof Promise) {
		void resolved.then((url) => {
			if (!url) {
				return undefined;
			}
			return player.play(url, action.loop);
		});
		return;
	}
	if (resolved) {
		player.play(resolved, action.loop);
	}
}
