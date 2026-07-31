/**
 * `animation-media-playback` - the DOM half of OOXML `p:cmd` media commands.
 *
 * {@link ./animation-media-commands} recognises and parses a `p:cmd` node into a
 * {@link ParsedMediaCommand}; this module applies that verb to a real
 * `<video>` / `<audio>` node during slide-show playback.
 *
 * WHY it is shared even though it touches the DOM: only the *lookup* of the
 * target node is per-binding (React keeps a shapeId -> node registry populated
 * by its media renderer; the other four query the live stage by
 * `data-element-id`). The verb mapping itself (play / pause / stop / seek, plus
 * swallowing the promise rejection from a blocked autoplay and the
 * `InvalidStateError` from seeking a not-yet-seekable element) is identical
 * everywhere, and was copied five times before this module existed. Callers
 * inject their lookup via {@link runMediaCommand}; the common `data-element-id`
 * lookup is provided here as {@link findMediaElementByElementId}.
 *
 * @module render/animation-media-playback
 */

import { parseMediaCommand } from './animation-media-commands';
import type { ParsedMediaCommand } from './animation-media-commands';
import type { TimelineStepCommand } from './animation-timeline-types';

/** Resolves a timeline command's `targetId` to the media node it drives. */
export type MediaElementResolver = (targetId: string) => HTMLMediaElement | null | undefined;

/**
 * Apply a parsed media verb to a media element.
 *
 * Both side effects are deliberately guarded: `play()` returns a promise that
 * rejects when autoplay policy blocks it or the element is not ready, and
 * assigning `currentTime` throws while the element has no seekable range. A
 * slide show must not surface either as an unhandled error, so both degrade to
 * a no-op.
 *
 * @returns `true` when the verb was applied.
 */
export function applyMediaCommandVerb(el: HTMLMediaElement, parsed: ParsedMediaCommand): boolean {
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
			return true;
		case 'play':
			safePlay();
			return true;
		case 'pause':
			el.pause();
			return true;
		case 'stop':
			el.pause();
			safeSeek(0);
			return true;
		case 'togglePlay':
			if (el.paused) {
				safePlay();
			} else {
				el.pause();
			}
			return true;
		default:
			return false;
	}
}

/**
 * Find the `<video>` / `<audio>` for an element id by walking `data-element-id`
 * wrappers under `root`.
 *
 * The id may sit on the media node itself or on the wrapper a binding renders
 * around it, so both shapes are accepted. Pass the slide stage as `root` where
 * possible: the thumbnail rail and the off-screen export stage carry the same
 * element ids, and a document-wide lookup can therefore hit the wrong copy.
 *
 * Returns `undefined` outside a DOM (SSR / node tests) rather than throwing.
 */
export function findMediaElementByElementId(
	targetId: string,
	root?: ParentNode | null,
): HTMLMediaElement | undefined {
	if (typeof HTMLMediaElement === 'undefined') {
		return undefined;
	}
	const scope: ParentNode | null = root ?? (typeof document === 'undefined' ? null : document);
	if (!scope) {
		return undefined;
	}
	for (const wrapper of scope.querySelectorAll<HTMLElement>('[data-element-id]')) {
		if (wrapper.dataset['elementId'] !== targetId) {
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

/**
 * Run a timeline media command against whatever node `resolve` hands back.
 *
 * @returns `false` when the target cannot be resolved or the command string has
 * no browser mapping, so the caller can treat the step as a no-op.
 */
export function runMediaCommand(
	command: TimelineStepCommand,
	resolve: MediaElementResolver,
): boolean {
	const el = resolve(command.targetId);
	if (!el) {
		return false;
	}
	const parsed = parseMediaCommand(command.command);
	if (!parsed) {
		return false;
	}
	return applyMediaCommandVerb(el, parsed);
}

/**
 * Run a timeline media command against the live DOM, resolving the target by
 * `data-element-id`. The default for bindings without an element registry.
 *
 * @param frameRoot - Lazily resolves the slide stage to scope the lookup to;
 * omit to search the whole document.
 */
export function executeMediaCommandInDom(
	command: TimelineStepCommand,
	frameRoot?: () => HTMLElement | null,
): boolean {
	return runMediaCommand(command, (targetId) =>
		findMediaElementByElementId(targetId, frameRoot?.() ?? null),
	);
}
