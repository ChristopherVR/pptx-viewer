/**
 * collaboration-presence-view.ts: project inbound awareness state into the
 * render-ready view-models the Vue collaboration components consume.
 *
 * Sanitisation, stale-drop, cursor mapping and the no-op-change memo all live
 * in `pptx-viewer-shared` (`createPresenceProjector`); this module adapts their
 * output to the binding's `RemotePresence` shape and filters cursors to the
 * local user's active slide (so peers on other slides paint no stray cursors).
 */
import { createPresenceProjector } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import type { RemotePresence } from './collaboration-types';

const DEFAULT_CANVAS_BOUND = 100_000;

/** Read a numeric bound from a plain number, a ref, or fall back generously. */
export function readBound(source: Ref<number> | number | undefined): number {
	if (source === undefined) {
		return DEFAULT_CANVAS_BOUND;
	}
	const value = typeof source === 'number' ? source : source.value;
	return value > 0 ? value : DEFAULT_CANVAS_BOUND;
}

export interface PresenceProjection {
	presences: RemotePresence[];
	cursors: RemoteCursor[];
	/**
	 * False when nothing visible changed, in which case both arrays are the SAME
	 * references returned last time and the caller should skip its `ref` writes.
	 */
	changed: boolean;
}

/**
 * Build a memoising projection from a raw awareness state map to the Vue
 * collaboration view-models. Cursors are limited to peers on `localActiveSlide`.
 *
 * Stateful (rather than the pure function this used to be) because awareness
 * fires on every peer heartbeat and on our own local writes, none of which
 * necessarily change anything a user can see. Assigning a fresh array to a
 * `ref` triggers regardless, so an idle room re-rendered the cursor overlay on
 * a fixed interval. The shared `createPresenceProjector` decides that once for
 * every binding; this only adds the Vue-specific `RemotePresence` mapping on
 * top, and reuses the previous mapping when the projector reports no change.
 */
export function createPresenceProjection(): {
	project: (
		states: Map<number, Record<string, unknown>>,
		selfId: number,
		width: number,
		height: number,
		localActiveSlide: number,
	) => PresenceProjection;
	reset: () => void;
} {
	const projector = createPresenceProjector();
	let lastPresences: RemotePresence[] = [];

	return {
		project(states, selfId, width, height, localActiveSlide) {
			const { list, cursors, changed } = projector.project(
				states,
				selfId,
				width,
				height,
				localActiveSlide,
			);
			if (!changed) {
				return { presences: lastPresences, cursors, changed: false };
			}
			lastPresences = list.map<RemotePresence>((p) => ({
				clientId: p.clientId,
				userName: p.userName,
				color: p.userColor,
				cursor: { x: p.cursorX, y: p.cursorY },
				selectionIds: p.selectedElementId ? [p.selectedElementId] : [],
				activeSlide: p.activeSlideIndex,
				role: p.role,
			}));
			return { presences: lastPresences, cursors, changed: true };
		},
		reset() {
			projector.reset();
			lastPresences = [];
		},
	};
}
