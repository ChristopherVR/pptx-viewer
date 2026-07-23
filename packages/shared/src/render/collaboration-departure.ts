/**
 * collaboration-departure.ts: a synchronous "I am leaving" announcement.
 *
 * Destroying a Yjs provider is NOT enough to make a peer disappear when the
 * document itself is going away (tab close, navigation, or an embedding page
 * detaching the viewer's iframe):
 *
 *  - y-webrtc broadcasts the awareness removal through
 *    `cryptoutils.encrypt(...).then(...)`, i.e. always one microtask later. By
 *    then the detached frame's BroadcastChannel / RTCDataChannel are dead and
 *    the browser silently drops the message.
 *  - y-webrtc's `peer.on('close')` handler does not remove the peer's awareness
 *    state either, so surviving peers keep the entry until the 30s awareness
 *    timeout: a ghost collaborator in every presence list.
 *
 * This module closes that window for the same-browser case (which is exactly
 * the embedded-iframe case) with a plain BroadcastChannel `postMessage` issued
 * SYNCHRONOUSLY from the teardown path, which the browser does deliver even
 * from a document that is being destroyed. Every live session listens on the
 * same channel and drops the announced client from its own awareness at once.
 *
 * Cross-device peers are unaffected by this channel and still rely on the
 * transport (socket close / peer close plus the awareness timeout).
 */

/** BroadcastChannel name shared by every viewer session in the browser. */
export const DEPARTURE_CHANNEL = 'pptx-viewer:collab-departures';

/** Wire format of a departure announcement. */
export interface DepartureNotice {
	channel: typeof DEPARTURE_CHANNEL;
	roomId: string;
	clientId: number;
}

/**
 * The slice of a Yjs `Awareness` needed to drop a departed peer. `states` and
 * `emit` are the same public members `y-protocols`' own `removeAwarenessStates`
 * uses, so this stays in step with the protocol without adding a dependency.
 */
export interface AwarenessStatesLike {
	clientID?: number;
	states?: Map<number, Record<string, unknown>>;
	emit?: (name: string, args: unknown[]) => void;
}

/** The structural slice of `BroadcastChannel` this module needs. */
export interface DepartureChannelLike {
	postMessage: (message: DepartureNotice) => void;
	close: () => void;
	onmessage: ((event: { data: unknown }) => void) | null;
}

/** Factory for the channel, injectable so the behaviour is testable. */
export type DepartureChannelFactory = (name: string) => DepartureChannelLike;

export interface DepartureChannel {
	/**
	 * Announce that this client is leaving `roomId`. Synchronous on purpose:
	 * it must survive being called from a `pagehide` handler.
	 */
	announce: () => void;
	/** Stop listening and release the channel. */
	dispose: () => void;
}

/**
 * Drop `clients` from `awareness` locally and notify its observers, mirroring
 * `y-protocols`' `removeAwarenessStates` for remote clients (the local-client
 * clock bump is not needed here: we never announce ourselves to ourselves).
 */
export function removeAwarenessStatesLocally(
	awareness: AwarenessStatesLike | null | undefined,
	clients: readonly number[],
): number[] {
	const states = awareness?.states;
	if (!awareness || !states) {
		return [];
	}
	const removed: number[] = [];
	for (const clientId of clients) {
		if (states.delete(clientId)) {
			removed.push(clientId);
		}
	}
	if (removed.length > 0) {
		const change = { added: [], updated: [], removed };
		awareness.emit?.('change', [change, 'peer-departed']);
		awareness.emit?.('update', [change, 'peer-departed']);
	}
	return removed;
}

/** Whether `data` is a departure notice for a different client in `roomId`. */
function readNotice(data: unknown, roomId: string, selfId: number | undefined): number | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}
	const notice = data as Partial<DepartureNotice>;
	if (notice.channel !== DEPARTURE_CHANNEL || notice.roomId !== roomId) {
		return null;
	}
	if (typeof notice.clientId !== 'number' || notice.clientId === selfId) {
		return null;
	}
	return notice.clientId;
}

function defaultFactory(name: string): DepartureChannelLike | null {
	const scope = globalThis as { BroadcastChannel?: new (name: string) => DepartureChannelLike };
	if (!scope.BroadcastChannel) {
		return null;
	}
	return new scope.BroadcastChannel(name);
}

/**
 * Open the departure channel for one collaboration session: listens for peers
 * announcing their exit (dropping them from `awareness` immediately) and
 * exposes {@link DepartureChannel.announce} for our own exit.
 *
 * Returns a no-op channel where `BroadcastChannel` is unavailable (SSR, older
 * runtimes), so callers never need to guard.
 */
export function createDepartureChannel(
	roomId: string,
	awareness: AwarenessStatesLike,
	factory?: DepartureChannelFactory,
): DepartureChannel {
	const channel = factory ? factory(DEPARTURE_CHANNEL) : defaultFactory(DEPARTURE_CHANNEL);
	if (!channel) {
		return { announce: () => {}, dispose: () => {} };
	}
	const selfId = awareness.clientID;
	channel.onmessage = (event) => {
		const departed = readNotice(event.data, roomId, selfId);
		if (departed !== null) {
			removeAwarenessStatesLocally(awareness, [departed]);
		}
	};
	let closed = false;
	return {
		announce: () => {
			if (closed || typeof selfId !== 'number') {
				return;
			}
			channel.postMessage({ channel: DEPARTURE_CHANNEL, roomId, clientId: selfId });
		},
		dispose: () => {
			if (closed) {
				return;
			}
			closed = true;
			channel.onmessage = null;
			channel.close();
		},
	};
}
