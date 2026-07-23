/**
 * collaboration-connection.ts: provider connection-status wiring for the
 * Angular `CollaborationService`. Owns the websocket connect timeout and drives
 * the status transitions plus the sync-gate re-arm on drops; extracted from
 * `collaboration.service.ts` so the service stays within the file-size budget.
 *
 * Mirrors the vanilla binding's module of the same name, but over Angular's
 * `ProviderLike` event surface (`on('status', payload)` with
 * `payload.connected` for webrtc / `payload.status` for websocket).
 */

import type { CollaborationTransport, ConnectionStatus } from '../internal/shared';
import { CONNECTION_TIMEOUT_MS } from '../internal/shared';
import type { ProviderLike } from './collaboration-providers';

export interface ConnectionWiringDeps {
	provider: ProviderLike;
	transport: CollaborationTransport;
	setStatus(status: ConnectionStatus): void;
	/** Current status, read when the connect timeout fires. */
	getStatus(): ConnectionStatus;
	/** Whether the session is still active (drops after teardown are ignored). */
	isActive(): boolean;
	/**
	 * Re-gate local doc writes after a drop: without this, a peer that drops and
	 * rejoins keeps the gate permanently open from the first connection and can
	 * clobber the room with a stale local doc.
	 */
	reArmGate(): void;
	/** websocket only: the first connect attempt timed out (still unconnected). */
	onConnectTimeout(): void;
}

export interface ConnectionWiring {
	/** Cancel the pending websocket connect timeout (idempotent). */
	cancelConnectTimer(): void;
}

/**
 * Subscribe to the provider's status events, driving `setStatus` and the
 * sync-gate re-arm. For websocket transports this also arms a one-shot connect
 * timeout when the socket is not open yet.
 */
export function wireConnectionStatus(deps: ConnectionWiringDeps): ConnectionWiring {
	const { provider, transport } = deps;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelConnectTimer(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
	}

	if (transport === 'webrtc') {
		// P2P: no server round-trip to wait on. Treat "created" as connected, and
		// reflect explicit disconnect events (re-arming the gate on a drop).
		deps.setStatus('connected');
		provider.on('status', (payload) => {
			if (payload.connected === false && deps.isActive()) {
				deps.setStatus('disconnected');
				deps.reArmGate();
			} else if (payload.connected === true) {
				deps.setStatus('connected');
			}
		});
		return { cancelConnectTimer };
	}

	provider.on('status', (payload) => {
		if (payload.status === 'connected') {
			cancelConnectTimer();
			deps.setStatus('connected');
		} else if (payload.status === 'disconnected' && deps.isActive()) {
			deps.setStatus('disconnected');
			deps.reArmGate();
		}
	});
	if (provider.wsconnected) {
		deps.setStatus('connected');
		return { cancelConnectTimer };
	}
	connectTimer = setTimeout(() => {
		connectTimer = null;
		if (deps.getStatus() !== 'connected') {
			deps.onConnectTimeout();
		}
	}, CONNECTION_TIMEOUT_MS);
	return { cancelConnectTimer };
}
