/**
 * collaboration-presence.ts: local presence publishing + remote presence
 * projection for the vanilla viewer's collaboration session.
 *
 * Publishes the local user's cursor/selection/active-slide via the shared
 * `createPresencePublisher` (the same nested `presence` awareness field
 * every binding reads), and projects inbound awareness state into
 * `store.get().remotePresences` / `.cursors` via the shared
 * memoising `createPresenceProjector`, so the cursors overlay and status UI
 * re-render off the store like the rest of the viewer, and only when an
 * awareness event actually changes something visible (issue #145).
 */
import type { AwarenessLike, PresenceIdentity, PresencePublisher } from 'pptx-viewer-shared';
import {
	createPresencePublisher,
	createPresenceProjector,
	PRESENCE_HEARTBEAT_MS,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

const DEFAULT_CANVAS_BOUND = 100_000;

export interface PresenceController {
	/** Publish a cursor move (slide-space px) plus the current active slide. */
	setCursor(x: number, y: number, activeSlideIndex?: number): void;
	/** Publish the local selection plus the current active slide. */
	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void;
	/** Publish the local active-slide index (drives peer follow-along). */
	setActiveSlide(index: number): void;
	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void;
	/** Stop publishing and clear remote presence from the store. */
	destroy(): void;
}

/** Read a positive numeric bound, falling back generously (matches Vue's `readBound`). */
function readBound(size: number | undefined): number {
	return size !== undefined && size > 0 ? size : DEFAULT_CANVAS_BOUND;
}

export function createPresenceController(
	store: Store<ViewerState>,
	awareness: AwarenessLike,
	identity: PresenceIdentity,
	getCanvasSize: () => { width?: number; height?: number },
): PresenceController {
	const publisher: PresencePublisher = createPresencePublisher(awareness, identity);
	const selfId = awareness.clientID ?? -1;
	let localActiveSlide = 0;
	// Memoises the awareness -> presence projection so idle heartbeats are dropped.
	const projector = createPresenceProjector();

	function refresh(): void {
		const { width, height } = getCanvasSize();
		// This binding repaints imperatively, so an awareness event that carries
		// no visible change is not just a wasted diff, it is a wasted DOM write.
		// Peer heartbeats fire on a fixed interval, so an idle room repainted the
		// cursor layer forever. The shared projector gates that (issue #145).
		const { list, cursors, changed } = projector.project(
			awareness.getStates(),
			selfId,
			readBound(width),
			readBound(height),
			localActiveSlide,
		);
		if (!changed) {
			return;
		}
		const followed = store.get().followedClientId;
		store.set({
			remotePresences: list,
			cursors,
			followedClientId:
				followed !== null && !list.some((p) => p.clientId === followed) ? null : followed,
		});
	}

	awareness.on('change', refresh);
	awareness.on('update', refresh);
	const heartbeat = setInterval(() => publisher.flush(), PRESENCE_HEARTBEAT_MS);
	refresh();

	return {
		setCursor(x, y, activeSlideIndex = localActiveSlide) {
			localActiveSlide = activeSlideIndex;
			publisher.update({ cursorX: x, cursorY: y, activeSlideIndex });
		},
		setSelection(selectedElementId, activeSlideIndex = localActiveSlide) {
			localActiveSlide = activeSlideIndex;
			publisher.update({ selectedElementId, activeSlideIndex });
		},
		setActiveSlide(index) {
			localActiveSlide = Math.max(0, Math.floor(index));
			publisher.update({ activeSlideIndex: localActiveSlide });
			refresh(); // re-filter which peer cursors are visible on this slide
		},
		followUser(clientId) {
			store.set({ followedClientId: clientId });
		},
		destroy() {
			clearInterval(heartbeat);
			awareness.off?.('change', refresh);
			awareness.off?.('update', refresh);
			publisher.dispose();
			store.set({ remotePresences: [], cursors: [], followedClientId: null });
		},
	};
}
