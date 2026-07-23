/**
 * collaboration-teardown.ts: make a departing peer actually leave the room.
 *
 * Every binding tears its collaboration session down on component unmount, but
 * that path never runs when the *document* goes away: closing the tab,
 * navigating away, or (the case that motivated this module) an embedding page
 * removing the viewer's `<iframe>` outright. y-webrtc installs its own
 * `beforeunload` handler, but `beforeunload` is only fired by the
 * "prompt to unload" algorithm during a navigation; destroying a document by
 * detaching its frame fires `pagehide`/`unload` and never `beforeunload`. The
 * peer therefore keeps its awareness entry until the 30s awareness timeout,
 * which reads as a ghost collaborator in everyone else's presence list.
 *
 * This helper registers the missing listeners once per session:
 *  - `pagehide` (the reliable signal, and the only one mobile Safari honours),
 *  - `beforeunload` (belt and braces for the plain navigation case),
 *  - a `postMessage` from an embedding page (see {@link COLLAB_LEAVE_MESSAGE}),
 *    so a host that is about to destroy the frame can ask it to leave first
 *    instead of relying on the unload path alone.
 *
 * A `pagehide` with `persisted === true` means the document went into the
 * back/forward cache and may come back. We only leave in that case when the
 * caller supplied a `rejoin`, and then rejoin from `pageshow`.
 *
 * The window is injected (structurally typed) so bindings can unit-test the
 * behaviour without a DOM.
 */

/**
 * `postMessage` payload an embedding page can send into a viewer frame to make
 * it leave its collaboration room before the frame is destroyed:
 * `frame.contentWindow?.postMessage({ type: COLLAB_LEAVE_MESSAGE }, '*')`.
 */
export const COLLAB_LEAVE_MESSAGE = 'pptx-viewer:collab-leave';

/** The subset of `PageTransitionEvent` / `MessageEvent` these listeners read. */
export interface TeardownEventLike {
	/** `pagehide` / `pageshow` only: whether the document entered the bfcache. */
	readonly persisted?: boolean;
	/** `message` only: the posted payload. */
	readonly data?: unknown;
}

/** A listener registered by {@link registerCollaborationTeardown}. */
export type TeardownListener = (event: TeardownEventLike) => void;

/** The structural slice of `window` this module needs. */
export interface TeardownWindowLike {
	addEventListener: (type: string, listener: TeardownListener) => void;
	removeEventListener: (type: string, listener: TeardownListener) => void;
}

export interface CollaborationTeardownOptions {
	/**
	 * Leave the room: clear the local awareness state and destroy the transport.
	 * Called at most once per "departure"; must tolerate being called when no
	 * session is active.
	 */
	leave: () => void;
	/**
	 * Optional: re-establish the session after a bfcache restore. Supplying it
	 * also opts the session into leaving on a persisted `pagehide`; without it a
	 * bfcache'd page keeps its session so it still works when restored.
	 */
	rejoin?: () => void;
	/** Window to listen on. Defaults to the ambient `window` when present. */
	target?: TeardownWindowLike;
}

/** Resolve the listener target without depending on DOM lib types. */
function resolveTarget(target?: TeardownWindowLike): TeardownWindowLike | null {
	if (target) {
		return target;
	}
	const scope = globalThis as { window?: TeardownWindowLike };
	return scope.window ?? null;
}

/** Whether a `message` event carries the leave request. */
function isLeaveMessage(data: unknown): boolean {
	if (typeof data === 'string') {
		return data === COLLAB_LEAVE_MESSAGE;
	}
	if (typeof data !== 'object' || data === null) {
		return false;
	}
	return (data as { type?: unknown }).type === COLLAB_LEAVE_MESSAGE;
}

/**
 * Register document-teardown listeners that make the local peer leave its
 * collaboration room. Returns a disposer that removes them again; call it from
 * the binding's normal unmount cleanup (which performs its own teardown).
 *
 * Safe to call in a non-browser environment: it becomes a no-op disposer.
 */
export function registerCollaborationTeardown(options: CollaborationTeardownOptions): () => void {
	const target = resolveTarget(options.target);
	if (!target) {
		return () => {};
	}

	const { leave, rejoin } = options;
	let left = false;

	const doLeave = (): void => {
		if (left) {
			return;
		}
		left = true;
		leave();
	};

	const onPageHide: TeardownListener = (event) => {
		if (event.persisted === true && !rejoin) {
			// Bfcache'd with no way back into the room: keep the session so the
			// restored page keeps working rather than silently going offline.
			return;
		}
		doLeave();
	};

	const onBeforeUnload: TeardownListener = () => {
		doLeave();
	};

	const onPageShow: TeardownListener = (event) => {
		if (event.persisted !== true || !left || !rejoin) {
			return;
		}
		left = false;
		rejoin();
	};

	const onMessage: TeardownListener = (event) => {
		if (isLeaveMessage(event.data)) {
			doLeave();
		}
	};

	target.addEventListener('pagehide', onPageHide);
	target.addEventListener('beforeunload', onBeforeUnload);
	target.addEventListener('pageshow', onPageShow);
	target.addEventListener('message', onMessage);

	return () => {
		target.removeEventListener('pagehide', onPageHide);
		target.removeEventListener('beforeunload', onBeforeUnload);
		target.removeEventListener('pageshow', onPageShow);
		target.removeEventListener('message', onMessage);
	};
}

/** The slice of a Yjs `Awareness` needed to withdraw the local presence. */
export interface AwarenessTeardownLike {
	setLocalState?: (state: null) => void;
}

/**
 * Withdraw the local awareness state so peers drop us immediately instead of
 * waiting out the 30s awareness timeout. Yjs broadcasts the resulting `removed`
 * update through the still-open transport, so call this BEFORE destroying the
 * provider.
 */
export function clearLocalAwareness(awareness: AwarenessTeardownLike | null | undefined): void {
	awareness?.setLocalState?.(null);
}
