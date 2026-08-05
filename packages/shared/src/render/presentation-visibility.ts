/**
 * Presentation visibility pause: while a slide show is running, hiding the
 * tab (switching tabs, minimising the window) must pause what the audience
 * can no longer see or follow, exactly like pressing pause:
 *
 *  - slide-stage `<audio>` / `<video>` elements that are currently playing,
 *  - cross-slide persistent audio ({@link pauseAllPersistentAudio}),
 *  - the auto-advance timer (via the binding's arm/cancel callbacks).
 *
 * Everything resumes when the document becomes visible again. Each binding
 * attaches this once when presentation mode starts and calls the returned
 * detach function when it ends.
 */
import { pauseAllPersistentAudio, resumeAllPersistentAudio } from './media-persistent-audio';

/** Binding callbacks invoked alongside the built-in media pause/resume. */
export interface PresentationVisibilityOptions {
	/**
	 * Root that contains the presentation stage; only media inside it is
	 * paused. Defaults to `document`.
	 */
	root?: ParentNode;
	/** Cancel the pending auto-advance timer (tab was hidden). */
	onHidden?: () => void;
	/** Re-arm the auto-advance timer for the current slide (tab is visible). */
	onVisible?: () => void;
}

/**
 * Attach the `visibilitychange` handler for a running presentation.
 *
 * @returns Detach function; also resumes nothing (a hidden-paused show that
 *          exits presentation mode tears its media down anyway).
 */
export function attachPresentationVisibilityPause(
	options: PresentationVisibilityOptions = {},
): () => void {
	if (typeof document === 'undefined') {
		return () => {};
	}
	const root: ParentNode = options.root ?? document;
	/** Stage media paused by the last hide, to resume on the next show. */
	let pausedMedia: Array<HTMLMediaElement> = [];

	const onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
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

	document.addEventListener('visibilitychange', onVisibilityChange);
	return () => {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	};
}
