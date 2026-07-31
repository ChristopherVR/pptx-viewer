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

import { findMediaElementByElementId, runMediaCommand } from 'pptx-viewer-shared';
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
 * Execute a timeline media command against the media element for its target.
 * Returns `true` when a media element was found and the verb applied, `false`
 * when the target cannot be resolved or the command has no browser mapping (in
 * which case the caller should treat it as a no-op).
 *
 * The verb mapping (`playFrom` / `play` / `pause` / `stop` / `togglePlay`) is
 * shared with the other bindings via `runMediaCommand`; only the lookup is
 * React's own. The registry is tried first because it is exact, then the shared
 * `data-element-id` DOM scan the other four bindings use, which covers media
 * rendered outside `PresentationMediaController` (the only component that
 * registers). Without that fallback a `p:cmd` aimed at such a node silently did
 * nothing here while it worked everywhere else.
 */
export function executeMediaCommand(
	command: TimelineStepCommand,
	frameRoot?: () => HTMLElement | null,
): boolean {
	return runMediaCommand(
		command,
		(targetId) => registry.get(targetId) ?? findMediaElementByElementId(targetId, frameRoot?.()),
	);
}
