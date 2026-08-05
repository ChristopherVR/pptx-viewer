/**
 * Persistent audio manager: keeps "play across slides" audio alive when the
 * presentation advances and its source slide unmounts.
 *
 * Framework-agnostic (document-level, no framework types): every binding
 * registers its cross-slide audio here instead of letting the element die
 * with the slide DOM. Registered audio lives hidden on `document.body` until
 * {@link stopAllPersistentAudio} tears it down on presentation exit.
 */

/** Tracks a persistent audio element that spans multiple slides. */
interface PersistentAudioEntry {
	elementId: string;
	audio: HTMLAudioElement;
	loop: boolean;
	/** True while a visibility pause is holding a previously-playing track. */
	pausedByVisibility: boolean;
}

const persistentAudioMap = new Map<string, PersistentAudioEntry>();

/** Whether an element's audio is already registered (and thus playing). */
export function hasPersistentAudio(elementId: string): boolean {
	return persistentAudioMap.has(elementId);
}

/**
 * Register (and start) a cross-slide audio track. Idempotent per element id:
 * re-registering while the track is alive is a no-op, so re-entering the
 * slide that owns the audio does not restart it.
 */
export function registerPersistentAudio(
	elementId: string,
	dataUrl: string,
	mimetype: string | undefined,
	loop: boolean,
	volume: number,
	trimStartSec: number,
): void {
	if (persistentAudioMap.has(elementId) || typeof document === 'undefined') {
		return;
	}

	const audio = document.createElement('audio');
	audio.src = dataUrl;
	if (mimetype) {
		const source = document.createElement('source');
		source.src = dataUrl;
		source.type = mimetype;
		audio.appendChild(source);
	}
	audio.loop = loop;
	audio.volume = Math.max(0, Math.min(1, volume));
	if (trimStartSec > 0) {
		try {
			audio.currentTime = trimStartSec;
		} catch {
			/* seeking before metadata may throw in some engines */
		}
	}

	// Keep the element in the DOM but hidden.
	audio.style.display = 'none';
	audio.setAttribute('data-pptx-persistent-audio', elementId);
	document.body.appendChild(audio);

	persistentAudioMap.set(elementId, { elementId, audio, loop, pausedByVisibility: false });

	void audio.play().catch(() => {
		/* autoplay may be blocked */
	});
}

/** Stop and remove all persistent audio; call when leaving presentation mode. */
export function stopAllPersistentAudio(): void {
	for (const entry of persistentAudioMap.values()) {
		entry.audio.pause();
		entry.audio.remove();
	}
	persistentAudioMap.clear();
}

/**
 * Pause every currently-playing persistent track, remembering which ones
 * were playing so {@link resumeAllPersistentAudio} restarts only those.
 * Used by the presentation visibility handler when the tab is hidden.
 */
export function pauseAllPersistentAudio(): void {
	for (const entry of persistentAudioMap.values()) {
		if (!entry.audio.paused) {
			entry.pausedByVisibility = true;
			entry.audio.pause();
		}
	}
}

/** Resume the tracks {@link pauseAllPersistentAudio} paused. */
export function resumeAllPersistentAudio(): void {
	for (const entry of persistentAudioMap.values()) {
		if (entry.pausedByVisibility) {
			entry.pausedByVisibility = false;
			void entry.audio.play().catch(() => {
				/* autoplay may be blocked */
			});
		}
	}
}
