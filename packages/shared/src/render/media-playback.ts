/**
 * Presentation-mode media autoplay.
 *
 * When present mode makes a slide the active, visible surface, any media on it
 * should begin playing without a manual click (matching PowerPoint's slideshow
 * behaviour). Browsers only honour a fresh `.play()` call, not an `autoplay`
 * attribute added retroactively to an already-mounted node, so each binding
 * calls this once the media element is mounted and its slide is live.
 *
 * `play()` can reject when the browser blocks autoplay-with-sound without a
 * prior user gesture; the rejection is swallowed so it never surfaces as an
 * unhandled promise (the element simply stays paused until the user interacts).
 */
export function startMediaAutoplay(el: HTMLMediaElement, options?: { trimStartMs?: number }): void {
	const trimStartMs = options?.trimStartMs;
	if (trimStartMs !== undefined && trimStartMs > 0) {
		try {
			el.currentTime = trimStartMs / 1000;
		} catch {
			/* seeking before metadata is loaded can throw in some browsers; ignore */
		}
	}
	const result = el.play() as Promise<void> | undefined;
	if (result && typeof result.catch === 'function') {
		void result.catch(() => {
			/* autoplay blocked (e.g. sound without a user gesture) */
		});
	}
}

/** The `p:cMediaNode` playback settings a deck asks a media node to honour. */
export interface MediaPlaybackSource {
	/** `<a:videoFile>` / `p:cMediaNode` loop flag. */
	loop?: boolean;
	/** Authored volume, already normalised to 0..1 by the parse layer. */
	volume?: number;
	/** Authored playback rate multiplier. */
	playbackSpeed?: number;
}

/** The DOM-facing playback attributes derived from {@link MediaPlaybackSource}. */
export interface MediaPlaybackAttributes {
	loop: boolean;
	volume: number;
	playbackRate: number;
}

/**
 * Resolve a media element's authored playback settings into DOM attributes.
 *
 * WHY this is shared: the settings live on the parsed element, the mapping is
 * two clamps and a default, and getting it wrong is invisible in a screenshot.
 * Vanilla and Svelte both omitted `loop`, so `solution-explorer.pptx` slide 2 -
 * a 2-second clip the deck marks `loop` and drives with a `playFrom(0.0)` on
 * slide entry - played once, hit its end and froze on the last frame, which
 * reads exactly like "the video never started". Volume was worse: only React
 * applied it, so a deck that says `vol="0"` blared out of the other four.
 */
export function mediaPlaybackAttributes(source: MediaPlaybackSource): MediaPlaybackAttributes {
	return {
		loop: source.loop === true,
		volume: Math.max(0, Math.min(1, source.volume ?? 1)),
		playbackRate: Math.max(0.25, Math.min(4, source.playbackSpeed ?? 1)),
	};
}

/**
 * Apply {@link mediaPlaybackAttributes} to a live node.
 *
 * `volume` and `playbackRate` are IDL properties with no attribute form, so the
 * declarative bindings cannot set them from a template the way they set `loop`;
 * every binding therefore needs this imperative step, not just the DOM ones.
 */
export function applyMediaPlaybackAttributes(
	el: HTMLMediaElement,
	source: MediaPlaybackSource,
): void {
	const attributes = mediaPlaybackAttributes(source);
	el.loop = attributes.loop;
	el.volume = attributes.volume;
	el.playbackRate = attributes.playbackRate;
}
