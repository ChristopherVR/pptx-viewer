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
