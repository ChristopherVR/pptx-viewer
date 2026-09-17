import type { Doc as YDoc } from 'yjs';

import type { ConnectionStatus } from './collaboration-presence';
import type { AwarenessLike } from './collaboration-presence-publisher';

/** Connection state reported by the host, independent of the viewer lifetime. */
export interface ExternalCollaborationSnapshot {
	status: ConnectionStatus;
	/**
	 * The host has loaded the authoritative document and permits local edits.
	 * Keep true while offline to allow ordinary Yjs offline edits, or set false
	 * to suspend writes until a fresh sync. The viewer never infers this from
	 * `status` and never opens it after a timeout.
	 */
	synced: boolean;
}

/** The public y-protocols Awareness surface needed by a borrowed session. */
export interface ExternalCollaborationAwareness extends AwarenessLike {
	clientID: number;
	getLocalState: () => Record<string, unknown> | null;
	setLocalState: (state: Record<string, unknown> | null) => void;
	off: (event: string, callback: () => void) => void;
}

/**
 * Host-owned Yjs resources. The host creates, connects and destroys them.
 * Keep this object and its resources stable for a session; report connection
 * changes through subscribe instead of replacing the collaboration config.
 */
export interface ExternalCollaborationSession {
	readonly doc: YDoc;
	/** Awareness must belong to doc. One viewer publishes slide presence at a time. */
	readonly awareness: ExternalCollaborationAwareness;
	getSnapshot: () => ExternalCollaborationSnapshot;
	/** Subscribe to status or synced changes; return an unsubscribe function. */
	subscribe: (listener: () => void) => () => void;
}

/**
 * Subscribe before reading so a sync completed during attachment is not lost.
 * The initial snapshot is delivered synchronously, then only changed values.
 */
export function observeExternalCollaborationSession(
	session: ExternalCollaborationSession,
	onSnapshot: (snapshot: ExternalCollaborationSnapshot) => void,
): () => void {
	let active = true;
	let subscribing = true;
	let previous: ExternalCollaborationSnapshot | undefined;
	let unsubscribe: (() => void) | undefined;
	const notify = (): void => {
		if (!active || subscribing) {
			return;
		}
		const snapshot = session.getSnapshot();
		if (previous?.status === snapshot.status && previous.synced === snapshot.synced) {
			return;
		}
		previous = { status: snapshot.status, synced: snapshot.synced };
		onSnapshot(previous);
	};
	const dispose = (): void => {
		if (!active) {
			return;
		}
		active = false;
		unsubscribe?.();
	};
	try {
		unsubscribe = session.subscribe(notify);
		subscribing = false;
		notify();
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}

/** Listener/publisher view, deliberately excluding host lifecycle methods. */
export interface BorrowedCollaborationAwareness extends AwarenessLike {
	clientID: number;
	off: (event: string, callback: () => void) => void;
}

/**
 * Give existing presence publishers a borrowed awareness view. Stop publishers
 * and remove their listeners before disposing this lease. Only the `presence`
 * field last written through this lease is restored; unrelated host fields and
 * subsequent host presence writes are preserved. A departed host is never
 * brought back by viewer cleanup.
 */
export function borrowExternalCollaborationAwareness(host: ExternalCollaborationAwareness): {
	awareness: BorrowedCollaborationAwareness;
	dispose: () => void;
} {
	let disposed = false;
	let ownsPresence = false;
	let hadPresence = false;
	let previousPresence: unknown;
	let lastPresence: unknown;
	const awareness: BorrowedCollaborationAwareness = {
		clientID: host.clientID,
		getStates: () => host.getStates(),
		on: (event, callback) => host.on(event, callback),
		off: (event, callback) => host.off(event, callback),
		setLocalStateField: (field, value) => {
			if (disposed) {
				return;
			}
			const state = host.getLocalState();
			if (state === null) {
				return;
			}
			if (field === 'presence') {
				if (!ownsPresence || state.presence !== lastPresence) {
					hadPresence = Object.hasOwn(state, 'presence');
					previousPresence = state.presence;
				}
				lastPresence = value;
				ownsPresence = true;
			}
			host.setLocalStateField(field, value);
		},
	};
	return {
		awareness,
		dispose: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			const current = host.getLocalState();
			if (!ownsPresence || current === null || current.presence !== lastPresence) {
				return;
			}
			const restored = { ...current };
			if (hadPresence) {
				restored.presence = previousPresence;
			} else {
				delete restored.presence;
			}
			host.setLocalState(restored);
		},
	};
}
