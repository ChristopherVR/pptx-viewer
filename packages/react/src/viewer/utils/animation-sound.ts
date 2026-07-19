/**
 * HTML5 audio playback for animation sound actions.
 *
 * Provides a singleton audio element so that only one animation sound
 * plays at a time, matching PowerPoint behaviour where a new `p:stSnd`
 * replaces any in-progress animation sound.
 */

/** Global audio element for animation sounds (singleton). */
let activeAudio: HTMLAudioElement | null = null;

/**
 * Play a sound file during animation.
 * Stops any previously playing animation sound first.
 *
 * @param soundUrl - Blob URL or data URL of the sound file.
 * @param loop - When true, repeat the sound until it is stopped or replaced.
 */
export function playAnimationSound(soundUrl: string, loop = false): void {
	stopAnimationSound();
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
