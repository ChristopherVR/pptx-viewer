/**
 * Presentation visibility pause: while a slide show is running, backgrounding
 * the browser must pause what the audience can no longer see or follow,
 * exactly like pressing pause:
 *
 *  - slide-stage `<audio>` / `<video>` elements that are currently playing,
 *  - cross-slide persistent audio ({@link pauseAllPersistentAudio}),
 *  - the auto-advance timer (via the binding's arm/cancel callbacks).
 *
 * "Backgrounded" covers BOTH signals: the tab being hidden (switching tabs,
 * minimising) via `visibilitychange`, and the window merely losing focus
 * (clicking another application while the browser stays on screen) via
 * `window` blur/focus. The issue #132 reporter alt-tabbed away with the
 * browser still visible and the soundtrack kept playing; visibility alone
 * never fires for that. Everything resumes when the document is visible AND
 * focused again. Each binding attaches this once when presentation mode
 * starts and calls the returned detach function when it ends.
 */
import { pauseAllPersistentAudio, resumeAllPersistentAudio } from './media-persistent-audio';

/** Binding callbacks invoked alongside the built-in media pause/resume. */
export interface PresentationVisibilityOptions {
	/**
	 * Root that contains the presentation stage; only media inside it is
	 * paused. Defaults to `document`.
	 */
	root?: ParentNode;
	/** Cancel the pending auto-advance timer (show was backgrounded). */
	onHidden?: () => void;
	/** Re-arm the auto-advance timer for the current slide (show is live). */
	onVisible?: () => void;
}

/**
 * Attach the backgrounding handlers for a running presentation.
 *
 * @returns Detach function; it resumes nothing (a suspended show that exits
 *          presentation mode tears its media down anyway).
 */
export function attachPresentationVisibilityPause(
	options: PresentationVisibilityOptions = {},
): () => void {
	if (typeof document === 'undefined') {
		return () => {};
	}
	const root: ParentNode = options.root ?? document;
	/** Stage media paused by the last suspension, to resume on the next. */
	let pausedMedia: Array<HTMLMediaElement> = [];
	/** Whether the show is currently suspended (transition-edge tracking). */
	let suspended = false;

	const update = (): void => {
		const shouldSuspend = document.visibilityState === 'hidden' || !document.hasFocus();
		if (shouldSuspend === suspended) {
			return;
		}
		suspended = shouldSuspend;
		if (shouldSuspend) {
			pausedMedia = [];
			for (const media of root.querySelectorAll<HTMLMediaElement>('audio, video')) {
				if (!media.paused && !media.ended) {
					pausedMedia.push(media);
					media.pause();
				}
			}
			pauseAllPersistentAudio();
			options.onHidden?.();
			return;
		}
		for (const media of pausedMedia) {
			if (media.isConnected) {
				void media.play().catch(() => {
					/* autoplay may be blocked */
				});
			}
		}
		pausedMedia = [];
		resumeAllPersistentAudio();
		options.onVisible?.();
	};

	document.addEventListener('visibilitychange', update);
	window.addEventListener('blur', update);
	window.addEventListener('focus', update);
	return () => {
		document.removeEventListener('visibilitychange', update);
		window.removeEventListener('blur', update);
		window.removeEventListener('focus', update);
	};
}
