/**
 * collaboration-connection.ts: provider connection-status wiring for the
 * vanilla collaboration session. Owns the websocket connect timeout and the
 * sync-gate re-arming on drops; extracted from `collaboration-controller.ts`
 * so the controller stays within the file-size budget.
 */
import type { CollaborationTransport, ConnectionStatus } from 'pptx-viewer-shared';
import { CONNECTION_TIMEOUT_MS } from 'pptx-viewer-shared';

import type { CollabProviderHandle } from './collaboration-provider';

export interface ConnectionWiringDeps {
	provider: CollabProviderHandle;
	transport: CollaborationTransport;
	setStatus(status: ConnectionStatus): void;
	/** Whether the session is still active (drops after teardown are ignored). */
	isActive(): boolean;
	/**
	 * Re-gate local doc writes after a drop: without this, a peer that drops
	 * and rejoins keeps the gate permanently open from the first connection and
	 * can clobber the room with a stale local doc.
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
 * Subscribe to the provider's connection events, driving `setStatus` and the
 * sync-gate re-arm. For websocket transports this also arms a one-shot connect
 * timeout when the provider is not connected yet.
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

	function onDrop(): void {
		if (deps.isActive()) {
			deps.setStatus('disconnected');
			deps.reArmGate();
		}
	}

	if (transport === 'webrtc') {
		// Same-browser tabs meet over BroadcastChannel at once (no server wait).
		deps.setStatus('connected');
		// y-webrtc reports peer connectivity via the same onStatus surface;
		// re-arm the gate on a drop so a reconnect re-gates writes instead of
		// leaving it permanently open from the first connection.
		provider.onStatus((isConnected) => {
			if (isConnected) {
				deps.setStatus('connected');
			} else {
				onDrop();
			}
		});
		return { cancelConnectTimer };
	}

	provider.onStatus((isConnected) => {
		if (isConnected) {
			cancelConnectTimer();
			deps.setStatus('connected');
		} else {
			onDrop();
		}
	});
	if (provider.connectedNow) {
		deps.setStatus('connected');
	} else {
		connectTimer = setTimeout(() => {
			connectTimer = null;
			deps.onConnectTimeout();
		}, CONNECTION_TIMEOUT_MS);
	}
	return { cancelConnectTimer };
}
