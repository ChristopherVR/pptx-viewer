/**
 * HTML5 audio playback for native-animation sound actions (`p:snd` / `p:stSnd`),
 * ported from the Vue binding's `composables/animation-sound` (and the React
 * binding's `viewer/utils/animation-sound`).
 *
 * A single shared audio element means only one animation sound plays at a time,
 * matching PowerPoint: a new sound replaces any in-progress animation sound.
 *
 * @module viewer/animation-sound
 */

/** Global audio element for animation sounds (singleton). */
let activeAudio: HTMLAudioElement | null = null;

/**
 * Play a sound file during animation. Stops any previously playing animation
 * sound first. Silently ignores autoplay restrictions and unplayable sources.
 *
 * @param soundUrl - Blob URL or data URL of the sound file.
 * @param loop - When true, repeat the sound until it is stopped or replaced.
 */
export function playAnimationSound(soundUrl: string, loop = false): void {
	stopAnimationSound();
	if (typeof Audio === 'undefined') {
		return;
	}
	activeAudio = new Audio(soundUrl);
	activeAudio.loop = loop;
	activeAudio.play().catch(() => {
		/* silently ignore autoplay restrictions */
	});
}

/** Stop any currently playing animation sound. */
export function stopAnimationSound(): void {
	if (activeAudio) {
		activeAudio.pause();
		activeAudio.currentTime = 0;
		activeAudio = null;
	}
}
