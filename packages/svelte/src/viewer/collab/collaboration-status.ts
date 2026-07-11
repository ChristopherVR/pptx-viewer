/**
 * collaboration-status.ts: wires a live provider's connection-status events
 * (plus the websocket-only connection timeout and sync-gate reconnect
 * re-arm) into the collaboration controller's reactive `status`. Extracted
 * from `collaboration.svelte.ts` to keep that class within the file-size
 * budget; this module holds no state of its own, only callbacks into the
 * controller's fields.
 */
import type { ConnectionStatus, SyncGate } from 'pptx-viewer-shared';
import { CONNECTION_TIMEOUT_MS } from 'pptx-viewer-shared';

import type { CollabProviderHandle } from './collaboration-provider';

export interface WireStatusDeps {
	setStatus: (status: ConnectionStatus) => void;
	getStatus: () => ConnectionStatus;
	isActive: () => boolean;
	stop: () => void;
	gate: SyncGate;
	setConnectTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
	getConnectTimer: () => ReturnType<typeof setTimeout> | null;
}

/** Wire the provider status events + (websocket-only) connection timeout. */
export function wireProviderStatus(
	provider: CollabProviderHandle,
	transport: string,
	deps: WireStatusDeps,
): void {
	if (transport === 'webrtc') {
		// Same-browser tabs meet over BroadcastChannel at once (no server wait).
		deps.setStatus('connected');
		// y-webrtc reports peer connectivity via the same onStatus surface;
		// re-arm the gate on a drop so a reconnect re-gates writes instead of
		// leaving it permanently open from the first connection.
		provider.onStatus((isConnected) => {
			if (isConnected) {
				deps.setStatus('connected');
			} else if (deps.isActive()) {
				deps.setStatus('disconnected');
				deps.gate.reset();
				deps.gate.arm();
			}
		});
		return;
	}
	provider.onStatus((isConnected) => {
		if (isConnected) {
			const timer = deps.getConnectTimer();
			if (timer !== null) {
				clearTimeout(timer);
				deps.setConnectTimer(null);
			}
			deps.setStatus('connected');
		} else if (deps.isActive()) {
			deps.setStatus('disconnected');
			// Re-arm on (re)connect: without this, a peer that drops and rejoins
			// keeps the gate permanently open from the first connection and can
			// clobber the room with a stale local doc.
			deps.gate.reset();
			deps.gate.arm();
		}
	});
	if (provider.connectedNow) {
		deps.setStatus('connected');
	} else {
		deps.setConnectTimer(
			setTimeout(() => {
				deps.setConnectTimer(null);
				if (deps.getStatus() !== 'connected') {
					deps.stop();
					deps.setStatus('error');
				}
			}, CONNECTION_TIMEOUT_MS),
		);
	}
}
