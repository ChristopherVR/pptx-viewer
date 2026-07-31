import { parseMediaCommand } from 'pptx-viewer-shared';
import type { TimelineStepCommand } from 'pptx-viewer-shared';

/**
 * `p:cmd` media verbs: the DOM half of animation playback.
 *
 * The animation controller is pure, so the timeline hands us a target element
 * id and a verb string and this module finds the real `<video>` / `<audio>` on
 * the live stage and drives it. Lookup is by `data-element-id` rather than a
 * registry, which is why it is scoped to the slide frame where possible: the
 * thumbnail rail and the off-screen export stage carry the same ids.
 *
 * Split out of `animation-playback-helpers` to keep that file within the repo's
 * file-size budget.
 *
 * @module presentation/animation-media-commands
 */

function findMediaElement(
	targetId: string,
	frameRoot?: () => HTMLElement | null,
): HTMLMediaElement | undefined {
	if (typeof HTMLMediaElement === 'undefined') {
		return undefined;
	}
	const root: ParentNode | null =
		frameRoot?.() ?? (typeof document !== 'undefined' ? document : null);
	if (!root) {
		return undefined;
	}
	for (const wrapper of root.querySelectorAll<HTMLElement>('[data-element-id]')) {
		if (wrapper.dataset.elementId !== targetId) {
			continue;
		}
		if (wrapper instanceof HTMLMediaElement) {
			return wrapper;
		}
		const media = wrapper.querySelector('video, audio');
		if (media instanceof HTMLMediaElement) {
			return media;
		}
	}
	return undefined;
}

/** Apply a parsed `p:cmd` media verb to the target's `<video>` / `<audio>`. */
export function executeMediaCommand(
	command: TimelineStepCommand,
	frameRoot?: () => HTMLElement | null,
): void {
	const el = findMediaElement(command.targetId, frameRoot);
	if (!el) {
		return;
	}
	const parsed = parseMediaCommand(command.command);
	if (!parsed) {
		return;
	}
	const safePlay = (): void => {
		void el.play().catch(() => {
			/* autoplay blocked or not ready: ignore */
		});
	};
	const safeSeek = (seconds: number): void => {
		try {
			el.currentTime = seconds;
		} catch {
			/* not seekable yet: ignore */
		}
	};
	switch (parsed.verb) {
		case 'playFrom':
			safeSeek(parsed.seekSeconds ?? 0);
			safePlay();
			return;
		case 'play':
			safePlay();
			return;
		case 'pause':
			el.pause();
			return;
		case 'stop':
			el.pause();
			safeSeek(0);
			return;
		case 'togglePlay':
			if (el.paused) {
				safePlay();
			} else {
				el.pause();
			}
			break;
		default:
	}
}
