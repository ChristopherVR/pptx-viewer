/**
 * Trim-end stop and fade in/out playback scheduling for a live media element
 * (G20). Split out of `media-playback.ts` (already at the file-size cap) to
 * keep both files under it.
 *
 * WHY this exists: `startMediaAutoplay` seeks to `trimStartMs` and calls
 * `.play()` once, but stopping at a trim END and ramping volume in/out around
 * the trim boundaries takes an ongoing scheduler (a `play` listener, a couple
 * of timers, and an animation-frame volume ramp) - logic that used to live
 * ONLY in React's `media-controller.tsx`, so trimmed/faded clips played past
 * their trim end, unfaded, in the other four bindings.
 *
 * `source.trimEndMs` mirrors `p14:trim/@end`'s own on-the-wire unit: the
 * distance, in milliseconds, from the END of the clip, NOT an absolute stop
 * time (COM-verified; see `PptxHandlerRuntimeMediaParsingUtils.ts`'s
 * `MediaExtensionData` doc). Converting it to an absolute stop needs the
 * clip's real duration, which is only known once the browser has decoded
 * metadata, so that conversion happens here, at schedule time, via a
 * `loadedmetadata` listener when `el.duration` is not yet available.
 */
export interface MediaTrimFadeSource {
	/** `p14:trim/@st`: absolute milliseconds from the clip's start. */
	trimStartMs?: number;
	/** `p14:trim/@end`: distance, in milliseconds, from the clip's END. */
	trimEndMs?: number;
	/** `p14:fade/@in`, in seconds. */
	fadeInDuration?: number;
	/** `p14:fade/@out`, in seconds. */
	fadeOutDuration?: number;
	/** The DOM-facing target volume (post `mediaPlaybackAttributes` clamp). */
	volume?: number;
}

/**
 * Attach trim-end stop and fade in/out scheduling to a media element for as
 * long as it keeps playing. Re-arms on every `play` (a manual replay, a loop,
 * or `startMediaAutoplay`'s own `.play()` call all fire it), and applies the
 * trim-start seek + fade-in immediately when playback (re)starts.
 *
 * Returns a cleanup function that cancels any pending timer/animation frame
 * and removes the listeners; call it on unmount or before rescheduling with
 * new settings.
 */
export function scheduleMediaTrimAndFade(
	el: HTMLMediaElement,
	source: MediaTrimFadeSource,
): () => void {
	const trimStartSec =
		source.trimStartMs !== undefined && source.trimStartMs > 0 ? source.trimStartMs / 1000 : 0;
	const trimEndDistanceSec =
		source.trimEndMs !== undefined && source.trimEndMs > 0 ? source.trimEndMs / 1000 : 0;
	const fadeIn = source.fadeInDuration ?? 0;
	const fadeOut = source.fadeOutDuration ?? 0;
	const targetVolume = source.volume ?? el.volume;

	if (trimStartSec <= 0 && trimEndDistanceSec <= 0 && fadeIn <= 0 && fadeOut <= 0) {
		return () => {
			/* nothing was scheduled */
		};
	}

	let rafId: number | null = null;
	let stopTimer: number | null = null;
	let fadeOutTimer: number | null = null;
	let metadataListener: (() => void) | null = null;
	let timeUpdateListener: (() => void) | null = null;
	let cancelled = false;

	const clearScheduled = (): void => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		if (stopTimer !== null) {
			window.clearTimeout(stopTimer);
			stopTimer = null;
		}
		if (fadeOutTimer !== null) {
			window.clearTimeout(fadeOutTimer);
			fadeOutTimer = null;
		}
		if (metadataListener) {
			el.removeEventListener('loadedmetadata', metadataListener);
			metadataListener = null;
		}
		if (timeUpdateListener) {
			el.removeEventListener('timeupdate', timeUpdateListener);
			timeUpdateListener = null;
		}
	};

	const runFade = (from: number, to: number, durationSec: number): void => {
		if (durationSec <= 0) {
			el.volume = to;
			return;
		}
		const start = performance.now();
		const durationMs = durationSec * 1000;
		const tick = (): void => {
			if (cancelled) {
				return;
			}
			const progress = Math.min(1, (performance.now() - start) / durationMs);
			el.volume = from + (to - from) * progress;
			if (progress < 1 && !el.paused) {
				rafId = requestAnimationFrame(tick);
			}
		};
		rafId = requestAnimationFrame(tick);
	};

	/** `endSeconds` is an ABSOLUTE position (already converted from the tail distance). */
	const scheduleStopAt = (endSeconds: number): void => {
		const remaining = endSeconds - el.currentTime;
		if (remaining <= 0) {
			return;
		}
		if (fadeOut > 0) {
			const fadeOutDelayMs = Math.max(0, (remaining - fadeOut) * 1000);
			fadeOutTimer = window.setTimeout(() => runFade(el.volume, 0, fadeOut), fadeOutDelayMs);
		}
		stopTimer = window.setTimeout(() => {
			if (!el.paused) {
				el.pause();
				el.currentTime = endSeconds;
			}
		}, remaining * 1000);
	};

	/** No trim end configured: fade out against the clip's own natural end. */
	const scheduleNaturalFadeOut = (): void => {
		timeUpdateListener = (): void => {
			if (!Number.isFinite(el.duration)) {
				return;
			}
			const timeLeft = el.duration - el.currentTime;
			if (timeLeft <= fadeOut && timeLeft > 0) {
				if (timeUpdateListener) {
					el.removeEventListener('timeupdate', timeUpdateListener);
				}
				timeUpdateListener = null;
				runFade(el.volume, 0, timeLeft);
			}
		};
		el.addEventListener('timeupdate', timeUpdateListener);
	};

	const handlePlay = (): void => {
		clearScheduled();
		if (trimStartSec > 0 && el.currentTime < trimStartSec) {
			el.currentTime = trimStartSec;
		}
		if (fadeIn > 0) {
			el.volume = 0;
			runFade(0, targetVolume, fadeIn);
		}
		if (trimEndDistanceSec > 0) {
			if (Number.isFinite(el.duration)) {
				scheduleStopAt(Math.max(0, el.duration - trimEndDistanceSec));
			} else {
				metadataListener = (): void => {
					if (metadataListener) {
						el.removeEventListener('loadedmetadata', metadataListener);
					}
					metadataListener = null;
					if (Number.isFinite(el.duration)) {
						scheduleStopAt(Math.max(0, el.duration - trimEndDistanceSec));
					}
				};
				el.addEventListener('loadedmetadata', metadataListener);
			}
		} else if (fadeOut > 0) {
			scheduleNaturalFadeOut();
		}
	};

	el.addEventListener('play', handlePlay);

	return () => {
		cancelled = true;
		clearScheduled();
		el.removeEventListener('play', handlePlay);
	};
}
