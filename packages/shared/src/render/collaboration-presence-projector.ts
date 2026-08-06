/**
 * collaboration-presence-projector.ts: a memoising projection from a raw Yjs
 * awareness map to the presence + cursor view-models every binding renders.
 *
 * WHY this is shared rather than five local guards: awareness fires on every
 * peer heartbeat, and each peer re-stamps `lastUpdated` on a fixed interval, so
 * an idle room emits a steady stream of events that carry no visible change.
 * `derivePresenceList` allocates a fresh array per call, so each of those events
 * looked like new state to React (`setState`), Vue (`ref.value =`), Angular
 * (`signal.set`), Svelte (`$state =`) and Vanilla (an imperative repaint) alike.
 * Five bindings were each re-rendering their collaboration layer on a timer.
 *
 * The projector holds the previous result and returns it BY IDENTITY when
 * nothing a user could see has changed, along with an explicit `changed` flag
 * for the imperative bindings that need to skip work rather than skip a render.
 *
 * The memo key is the derived presence list plus the local active slide, since
 * cursors are filtered to the slide the local user is on: a peer that did not
 * move still needs its cursor re-projected when WE change slide.
 */
import { derivePresenceList, presenceToCursors } from './collaboration-presence';
import type { RemoteCursor, SanitizedPresence } from './collaboration-presence';
import { presenceListsEqual } from './state-equality';

export interface PresenceProjection {
	/** Remote collaborators, stale entries already dropped. */
	list: SanitizedPresence[];
	/** Cursors for the peers on the local user's slide. */
	cursors: RemoteCursor[];
	/**
	 * False when this projection is identical to the previous one, in which case
	 * `list` and `cursors` are the SAME references that were returned last time.
	 * Bindings should skip their state write (and any repaint) entirely.
	 */
	changed: boolean;
}

export interface PresenceProjector {
	project(
		states: Map<number, Record<string, unknown>>,
		localClientId: number,
		canvasWidth: number,
		canvasHeight: number,
		localActiveSlideIndex?: number,
		now?: number,
	): PresenceProjection;
	/** Drop the memo, so the next projection is treated as a change. */
	reset(): void;
}

export function createPresenceProjector(): PresenceProjector {
	let lastList: SanitizedPresence[] = [];
	let lastCursors: RemoteCursor[] = [];
	let lastActiveSlideIndex: number | undefined;
	let primed = false;

	return {
		project(states, localClientId, canvasWidth, canvasHeight, localActiveSlideIndex, now) {
			const list = derivePresenceList(
				states,
				localClientId,
				canvasWidth,
				canvasHeight,
				now ?? Date.now(),
			);
			if (
				primed &&
				localActiveSlideIndex === lastActiveSlideIndex &&
				presenceListsEqual(lastList, list)
			) {
				return { list: lastList, cursors: lastCursors, changed: false };
			}
			lastList = list;
			lastCursors = presenceToCursors(list, localActiveSlideIndex);
			lastActiveSlideIndex = localActiveSlideIndex;
			primed = true;
			return { list, cursors: lastCursors, changed: true };
		},
		reset() {
			lastList = [];
			lastCursors = [];
			lastActiveSlideIndex = undefined;
			primed = false;
		},
	};
}
