/**
 * useYjsProvider: Manages the Yjs document and provider lifecycle.
 *
 * Creates a Y.Doc and connects via one of two transports:
 *  - `websocket` (default): WebSocketProvider against `config.serverUrl`.
 *  - `webrtc`: peer-to-peer WebrtcProvider (no document server); usable from
 *    static hosting. Same-browser tabs sync over BroadcastChannel.
 * Exposes connection status and cleanup on unmount.
 *
 * This hook is intentionally thin: it only manages the transport layer.
 * Application-level collaboration logic lives in useCollaborativeState
 * and usePresenceTracking.
 *
 * @module collaboration/useYjsProvider
 */
import {
	CONNECTION_TIMEOUT_MS,
	clearLocalAwareness,
	createDepartureChannel,
	createSyncGate,
	isMixedContentBlocked,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';
import type { DepartureChannel, SyncGate } from 'pptx-viewer-shared';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { WebrtcProvider } from 'y-webrtc';
import type { WebsocketProvider } from 'y-websocket';
import type { Doc as YDoc } from 'yjs';

import type { CollaborationConfig, ConnectionStatus } from './types';

/**
 * The two provider transports share only the surface this hook relies on:
 * an `awareness` instance and a `destroy()` teardown method.
 */
type CollabProvider = WebsocketProvider | WebrtcProvider;

// Re-export the upstream type aliases for downstream consumers.
export type { YDoc, Awareness };

// Re-export the shared mixed-content guard so existing importers (and the
// colocated test) keep their `./useYjsProvider` import path.
export { isMixedContentBlocked };

// ---------------------------------------------------------------------------
// Hook input / output
// ---------------------------------------------------------------------------

export interface UseYjsProviderInput {
	/**
	 * Collaboration config, or `undefined` when collaboration is inactive. The
	 * hook is always called (React hook rules) but stays fully dormant, never
	 * opening a transport, while config is absent.
	 */
	config?: CollaborationConfig;
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
	/**
	 * Whether the provider completed its initial document sync. Local doc
	 * writes should be gated on this so a late joiner never seeds its
	 * bootstrap deck into a room whose content has not arrived yet. Websocket
	 * flips it on the provider's 'synced' event; webrtc flips it on peer sync
	 * or after {@link INITIAL_SYNC_GRACE_MS} (a lone fresh-room peer never
	 * receives a sync event).
	 */
	synced: boolean;
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
	const [synced, setSynced] = useState(false);

	// Keep a ref to cleanup functions so we can teardown on unmount or config change
	const cleanupRef = useRef<(() => void) | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Synchronous departure announcement (see the shared collaboration-departure
	// module): the provider's own awareness removal is broadcast a microtask
	// later and never escapes a document that is already being destroyed.
	const departureRef = useRef<DepartureChannel | null>(null);

	// First-write gate: created once per hook instance (its `onOpen` closes
	// over the stable `setSynced` setter, so it never needs to be rebuilt).
	// `arm()` on (re)connect, `open()` on the provider's sync confirmation,
	// `reset()` on disconnect/teardown so a later reconnect re-gates writes
	// instead of leaving `synced` permanently true from the first connection.
	const gateRef = useRef<SyncGate | null>(null);
	if (!gateRef.current) {
		gateRef.current = createSyncGate(() => setSynced(true));
	}

	const teardown = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		gateRef.current?.reset();
		setSynced(false);
		cleanupRef.current?.();
		cleanupRef.current = null;
	}, []);

	/** Announce our exit to same-browser peers, then close the channel. */
	const announceDeparture = useCallback(() => {
		departureRef.current?.announce();
		departureRef.current?.dispose();
		departureRef.current = null;
	}, []);

	// Build the teardown closure shared by both transports: announce the
	// departure, withdraw the local awareness entry (so peers drop us at once
	// instead of waiting out the awareness timeout), destroy the provider + doc
	// and reset all published state.
	const buildCleanup = useCallback(
		(provider: CollabProvider, yDoc: YDoc) => () => {
			announceDeparture();
			clearLocalAwareness(provider.awareness);
			provider.destroy();
			yDoc.destroy();
			setDoc(null);
			setAwareness(null);
			setClientId(null);
			setStatus('disconnected');
		},
		[announceDeparture],
	);

	const initWebrtc = useCallback(async () => {
		if (!config) {
			return;
		}
		setStatus('connecting');
		try {
			// Dynamic imports: zero bundle cost when unused.
			const [Y, { WebrtcProvider }] = await Promise.all([import('yjs'), import('y-webrtc')]);

			const yDoc: YDoc = new Y.Doc();
			// Only pass options that are actually set; y-webrtc applies its own
			// defaults (public signaling list, no password) when a key is absent.
			const opts: { signaling?: string[]; password?: string } = {};
			if (config.signaling && config.signaling.length > 0) {
				opts.signaling = config.signaling;
			}
			if (config.authToken) {
				opts.password = config.authToken;
			}
			const roomId = validateRoomId(config.roomId);
			const provider = new WebrtcProvider(roomId, yDoc, opts);
			departureRef.current = createDepartureChannel(roomId, provider.awareness);

			setDoc(yDoc);
			setAwareness(provider.awareness);
			setClientId(provider.awareness.clientID);
			// P2P has no server handshake to await: same-browser tabs meet over
			// BroadcastChannel immediately, so treat the provider as connected
			// once created. Late-joiner Y.Doc sync fills in the document.
			setStatus('connected');

			// y-webrtc only emits 'synced' when a peer syncs with us; a lone
			// fresh-room peer never gets one, so the grace timer lifts the
			// first-write gate for that case.
			const handleSynced = (event: { synced?: boolean }) => {
				if (event?.synced !== false) {
					gateRef.current?.open();
				}
			};
			provider.on('synced', handleSynced);
			gateRef.current?.arm();

			// y-webrtc reports peer connectivity via `status`; re-arm the gate on a
			// disconnect so a later reconnect re-gates writes instead of leaving
			// `synced` permanently true from the first connection.
			const handleStatus = (event: { connected?: boolean }) => {
				if (event.connected === false) {
					setStatus('disconnected');
					gateRef.current?.reset();
					setSynced(false);
					gateRef.current?.arm();
				} else if (event.connected) {
					setStatus('connected');
				}
			};
			provider.on('status', handleStatus);

			const baseCleanup = buildCleanup(provider, yDoc);
			cleanupRef.current = () => {
				provider.off('synced', handleSynced);
				provider.off('status', handleStatus);
				baseCleanup();
			};
		} catch (err) {
			console.warn(
				'[pptx-viewer] WebRTC collaboration packages not available:',
				err instanceof Error ? err.message : err,
			);
			setStatus('error');
		}
		// The bare `config` is read only as a presence guard (bail when inactive);
		// reconnection is intentionally keyed on the transport-affecting fields
		// only, so identity-only changes (e.g. userName) never drop the peer link.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [config?.roomId, config?.authToken, config?.signaling, buildCleanup]);

	const init = useCallback(async () => {
		// Clean up any previous connection before starting a new one.
		// y-webrtc throws if the same room is opened twice in one page, so the
		// previous provider must be destroyed before creating the next.
		teardown();

		// Collaboration inactive: stay dormant, do not open any transport. This
		// keeps the provider (and thus the surrounding React tree) mounted with a
		// stable shape whether or not a session is running.
		if (!config) {
			return;
		}

		// Validate room ID before connecting
		const roomId = validateRoomId(config.roomId);

		// Serverless peer-to-peer transport: no server URL, no mixed-content
		// concern (WebRTC signaling is wss://), no connection timeout. Falls
		// back from a blank serverUrl the same way Vue's session layer already
		// does, so a bare CollaborationConfig behaves identically regardless of
		// which binding's session layer receives it directly (not just via the
		// Share/Broadcast dialogs, which already pre-resolve `transport`).
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		if (transport === 'webrtc') {
			await initWebrtc();
			return;
		}

		// Fail fast on mixed content: an https page cannot open a ws:// socket.
		// Surface the error immediately rather than hanging until the timeout.
		if (isMixedContentBlocked(config.serverUrl)) {
			console.warn(
				`[pptx-viewer] Refusing to connect: insecure ws:// server "${config.serverUrl}" is blocked from a secure (https) page. Use a wss:// URL.`,
			);
			setStatus('error');
			return;
		}

		setStatus('connecting');

		try {
			// Dynamic imports: zero bundle cost when unused
			const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);

			const yDoc: YDoc = new Y.Doc();
			const provider: WebsocketProvider = new WebsocketProvider(config.serverUrl, roomId, yDoc, {
				params: config.authToken ? { token: config.authToken } : undefined,
			});
			departureRef.current = createDepartureChannel(roomId, provider.awareness);

			let connected = false;

			const handleStatus = (event: { status: string }) => {
				if (event.status === 'connected') {
					connected = true;
					// Clear timeout: we connected successfully
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
						timeoutRef.current = null;
					}
					setStatus('connected');
					// Defensive: if the server never sends the initial sync
					// confirmation, lift the first-write gate after the grace period.
					gateRef.current?.arm();
				} else if (event.status === 'disconnected') {
					setStatus('disconnected');
					// Re-arm on (re)connect: without this, a peer that drops and
					// rejoins keeps `synced` permanently true from the first
					// connection and can clobber the room with a stale local doc.
					gateRef.current?.reset();
					setSynced(false);
					gateRef.current?.arm();
				}
			};

			// y-websocket confirms the initial server sync via its 'sync' event.
			const handleSynced = (isSynced: boolean) => {
				if (isSynced) {
					gateRef.current?.open();
				}
			};

			provider.on('status', handleStatus);
			provider.on('sync', handleSynced);

			if (provider.wsconnected) {
				connected = true;
				setStatus('connected');
				gateRef.current?.arm();
			}
			if (provider.synced) {
				gateRef.current?.open();
			}

			// Start connection timeout: if we don't connect within the limit,
			// tear down the provider and surface an error so the user can retry.
			if (!connected) {
				timeoutRef.current = setTimeout(() => {
					timeoutRef.current = null;
					if (!connected) {
						provider.off('status', handleStatus);
						provider.off('sync', handleSynced);
						announceDeparture();
						clearLocalAwareness(provider.awareness);
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
				provider.off('sync', handleSynced);
				announceDeparture();
				clearLocalAwareness(provider.awareness);
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
		// See initWebrtc: the bare `config` is only a presence guard; the transport
		// is (re)opened solely on the connection-affecting fields listed below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		config?.roomId,
		config?.serverUrl,
		config?.authToken,
		config?.transport,
		announceDeparture,
		initWebrtc,
		teardown,
	]);

	useEffect(() => {
		init();
		// Unmount is not the only way a session ends: a tab close, a navigation,
		// or an embedding page detaching the viewer's iframe destroys the
		// document without ever running React cleanup, leaving a ghost peer in
		// everyone else's presence list. Leave the room from `pagehide` too.
		const disposeTeardown = registerCollaborationTeardown({
			leave: teardown,
			rejoin: init,
		});
		return () => {
			disposeTeardown();
			teardown();
		};
	}, [init, teardown]);

	const retry = useCallback(() => {
		init();
	}, [init]);

	return { status, awareness, doc, clientId, synced, retry };
}
