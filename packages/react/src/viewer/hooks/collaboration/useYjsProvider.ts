/**
 * useYjsProvider — Manages the Yjs document and WebSocket provider lifecycle.
 *
 * Creates a Y.Doc and connects via WebSocketProvider to the collaboration
 * server. Exposes connection status and cleanup on unmount.
 *
 * This hook is intentionally thin — it only manages the transport layer.
 * Application-level collaboration logic lives in useCollaborativeState
 * and usePresenceTracking.
 *
 * @module collaboration/useYjsProvider
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { WebsocketProvider } from 'y-websocket';
import type { Doc as YDoc } from 'yjs';

import { validateRoomId } from './sanitize';
import type { CollaborationConfig, ConnectionStatus } from './types';

// Re-export the upstream type aliases for downstream consumers.
export type { YDoc, Awareness };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time (ms) to wait for an initial WebSocket connection before giving up. */
const CONNECTION_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook input / output
// ---------------------------------------------------------------------------

export interface UseYjsProviderInput {
	config: CollaborationConfig;
}

export interface UseYjsProviderResult {
	/** Current WebSocket connection status. */
	status: ConnectionStatus;
	/** The Yjs awareness instance (null until connected). */
	awareness: Awareness | null;
	/** The Yjs document (null until initialised). */
	doc: YDoc | null;
	/** Local awareness client ID. */
	clientId: number | null;
	/** Manually retry the connection after a timeout or error. */
	retry: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Lazily loads `yjs` and `y-websocket`, creates a Y.Doc and
 * WebSocketProvider, and tracks the connection lifecycle.
 *
 * If the connection does not succeed within {@link CONNECTION_TIMEOUT_MS},
 * the provider is torn down and status moves to `'error'`. The consumer
 * can call `retry()` to attempt a fresh connection.
 *
 * The Yjs packages are dynamically imported so they are fully
 * tree-shaken when collaboration is not enabled.
 */
export function useYjsProvider({ config }: UseYjsProviderInput): UseYjsProviderResult {
	const [status, setStatus] = useState<ConnectionStatus>('disconnected');
	const [awareness, setAwareness] = useState<Awareness | null>(null);
	const [doc, setDoc] = useState<YDoc | null>(null);
	const [clientId, setClientId] = useState<number | null>(null);

	// Keep a ref to cleanup functions so we can teardown on unmount or config change
	const cleanupRef = useRef<(() => void) | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const teardown = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		cleanupRef.current?.();
		cleanupRef.current = null;
	}, []);

	const init = useCallback(async () => {
		// Clean up any previous connection before starting a new one
		teardown();

		// Validate room ID before connecting
		const roomId = validateRoomId(config.roomId);

		setStatus('connecting');

		try {
			// Dynamic imports — zero bundle cost when unused
			const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);

			const yDoc: YDoc = new Y.Doc();
			const provider: WebsocketProvider = new WebsocketProvider(config.serverUrl, roomId, yDoc, {
				params: config.authToken ? { token: config.authToken } : undefined,
			});

			let connected = false;

			const handleStatus = (event: { status: string }) => {
				if (event.status === 'connected') {
					connected = true;
					// Clear timeout — we connected successfully
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
						timeoutRef.current = null;
					}
					setStatus('connected');
				} else if (event.status === 'disconnected') {
					setStatus('disconnected');
				}
			};

			provider.on('status', handleStatus);

			if (provider.wsconnected) {
				connected = true;
				setStatus('connected');
			}

			// Start connection timeout — if we don't connect within the limit,
			// tear down the provider and surface an error so the user can retry.
			if (!connected) {
				timeoutRef.current = setTimeout(() => {
					timeoutRef.current = null;
					if (!connected) {
						provider.off('status', handleStatus);
						provider.destroy();
						yDoc.destroy();
						setDoc(null);
						setAwareness(null);
						setClientId(null);
						cleanupRef.current = null;
						setStatus('error');
					}
				}, CONNECTION_TIMEOUT_MS);
			}

			setDoc(yDoc);
			setAwareness(provider.awareness);
			setClientId(provider.awareness.clientID);

			// Store cleanup
			cleanupRef.current = () => {
				provider.off('status', handleStatus);
				provider.destroy();
				yDoc.destroy();
				setDoc(null);
				setAwareness(null);
				setClientId(null);
				setStatus('disconnected');
			};
		} catch (err) {
			// If yjs or y-websocket are not installed, degrade gracefully
			console.warn(
				'[pptx-viewer] Collaboration packages not available:',
				err instanceof Error ? err.message : err,
			);
			setStatus('error');
		}
	}, [config.roomId, config.serverUrl, config.authToken, teardown]);

	useEffect(() => {
		init();
		return teardown;
	}, [init, teardown]);

	const retry = useCallback(() => {
		init();
	}, [init]);

	return { status, awareness, doc, clientId, retry };
}
