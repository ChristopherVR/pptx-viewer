/**
 * `media-element-registry` - a small shapeId -> HTMLMediaElement registry used
 * to drive media playback from the animation timeline. Rendered `<video>` /
 * `<audio>` elements register their DOM node keyed by the owning element id;
 * when a `p:cmd` command step fires during timeline playback, the playback layer
 * looks the node up here and applies the parsed verb (play / pause / seek).
 *
 * The registry is a module-level singleton: element ids are unique within a
 * deck, and command targets reference those same ids. Registrations are removed
 * on unmount so stale nodes never linger.
 *
 * @module viewer/utils/media-element-registry
 */

import { parseMediaCommand } from 'pptx-viewer-shared';
import type { TimelineStepCommand } from 'pptx-viewer-shared';

const registry = new Map<string, HTMLMediaElement>();

/**
 * Register a media element under an element id. Returns an unregister callback
 * that only removes the entry if it still points at this exact node (so a newer
 * registration for the same id is never clobbered by a late unmount).
 */
export function registerMediaElement(elementId: string, el: HTMLMediaElement): () => void {
	if (!elementId) {
		return () => {
			/* no id: nothing to unregister */
		};
	}
	registry.set(elementId, el);
	return () => {
		if (registry.get(elementId) === el) {
			registry.delete(elementId);
		}
	};
}

/** Look up the media element registered for an element id, if any. */
export function getRegisteredMediaElement(elementId: string): HTMLMediaElement | undefined {
	return registry.get(elementId);
}

/** Remove all registrations. Intended for tests. */
export function clearMediaElementRegistry(): void {
	registry.clear();
}

/**
 * Execute a timeline media command against the registered media element for its
 * target. Returns `true` when a media element was found and the verb applied,
 * `false` when the target is not registered or the command has no browser
 * mapping (in which case the caller should treat it as a no-op).
 *
 * Verb mapping:
 * - `playFrom` -> seek to the parsed offset (seconds), then play.
 * - `play` -> resume playback.
 * - `pause` -> pause playback.
 * - `stop` -> pause and rewind to the start.
 * - `togglePlay` -> pause if playing, else play.
 */
export function executeMediaCommand(command: TimelineStepCommand): boolean {
	const el = registry.get(command.targetId);
	if (!el) {
		return false;
	}
	const parsed = parseMediaCommand(command.command);
	if (!parsed) {
		return false;
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
