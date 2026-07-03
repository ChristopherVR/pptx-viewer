/**
 * collaboration-sync-gate.ts: first-write gate for collaborative sessions.
 *
 * Until a provider confirms its initial document sync, local state must not
 * be written into the shared doc: a late joiner bootstrapped with a
 * placeholder deck would otherwise merge that placeholder into the room's
 * real content. Websocket providers emit a reliable 'synced' event; y-webrtc
 * only syncs when a peer is present, so a lone fresh-room peer opens the gate
 * after {@link INITIAL_SYNC_GRACE_MS} instead and seeds the empty doc.
 *
 * Usage per binding: create the gate with an `onOpen` callback that performs
 * the deferred first write, call `arm()` when the provider is created (and on
 * (re)connect), `open()` from the provider's sync event, gate local writes on
 * `isOpen()`, and `reset()` on session teardown.
 */

import { INITIAL_SYNC_GRACE_MS } from './collaboration-presence';

export interface SyncGate {
	/** Whether local doc writes are allowed. */
	isOpen: () => boolean;
	/** (Re)start the grace timer that opens the gate without a sync event. */
	arm: () => void;
	/** Open the gate now (provider confirmed its initial sync). Idempotent. */
	open: () => void;
	/** Close the gate and cancel the grace timer (session teardown). */
	reset: () => void;
}

/**
 * Create a first-write gate. `onOpen` fires exactly once per session (until
 * `reset()`), from either the provider sync signal or the grace timer.
 */
export function createSyncGate(
	onOpen: () => void,
	graceMs: number = INITIAL_SYNC_GRACE_MS,
): SyncGate {
	let opened = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const clear = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};

	const open = (): void => {
		clear();
		if (opened) {
			return;
		}
		opened = true;
		onOpen();
	};

	return {
		isOpen: () => opened,
		arm: () => {
			clear();
			if (!opened) {
				timer = setTimeout(open, graceMs);
			}
		},
		open,
		reset: () => {
			clear();
			opened = false;
		},
	};
}
