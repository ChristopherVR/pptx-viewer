/**
 * collaboration-presence-view.ts: project inbound awareness state into the
 * render-ready view-models the Vue collaboration components consume.
 *
 * Sanitisation, stale-drop and cursor mapping all live in `pptx-viewer-shared`
 * (`derivePresenceList` / `presenceToCursors`); this module adapts their output
 * to the binding's `RemotePresence` shape and filters cursors to the local
 * user's active slide (so peers on other slides do not paint stray cursors).
 */
import { derivePresenceList, presenceToCursors } from 'pptx-viewer-shared';
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
}

/**
 * Derive the remote-presence and cursor view-models from a raw awareness state
 * map. Cursors are limited to peers on `localActiveSlide`.
 */
export function projectPresence(
	states: Map<number, Record<string, unknown>>,
	selfId: number,
	width: number,
	height: number,
	localActiveSlide: number,
): PresenceProjection {
	const list = derivePresenceList(states, selfId, width, height);
	const presences = list.map<RemotePresence>((p) => ({
		clientId: p.clientId,
		userName: p.userName,
		color: p.userColor,
		cursor: { x: p.cursorX, y: p.cursorY },
		selectionIds: p.selectedElementId ? [p.selectedElementId] : [],
		activeSlide: p.activeSlideIndex,
		role: p.role,
	}));
	return { presences, cursors: presenceToCursors(list, localActiveSlide) };
}
