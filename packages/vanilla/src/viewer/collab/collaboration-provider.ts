/**
 * collaboration-provider.ts: create the Yjs transport provider (y-websocket or
 * y-webrtc) for a collaboration session and normalise it into a small handle.
 *
 * Ported verbatim from the Vue binding's `collaboration-provider.ts` (the
 * transport plumbing is framework-agnostic). The two providers differ in their
 * constructor, status events and teardown, so this helper hides those behind
 * {@link CollabProviderHandle}:
 *
 *  - `websocket`: `new WebsocketProvider(serverUrl, roomId, doc, { params })`;
 *    status events carry `{ status }`; `wsconnected` reports the live state.
 *  - `webrtc`: `new WebrtcProvider(roomId, doc, { signaling, password })`; needs
 *    no document server. Same-browser tabs meet over BroadcastChannel
 *    immediately, so the handle reports `connectedNow: true`.
 *
 * `yjs` / `y-webrtc` / `y-websocket` are optional peer dependencies, imported
 * lazily here so a host that never collaborates never loads them.
 */
import type {
	AwarenessLike,
	CollaborationConfig,
	CollaborationTransport,
} from 'pptx-viewer-shared';
import { clearLocalAwareness, createDepartureChannel } from 'pptx-viewer-shared';

export type { AwarenessLike };

/** A transport-agnostic view of a live Yjs provider. */
export interface CollabProviderHandle {
	/** The provider's awareness instance. */
	awareness: AwarenessLike;
	/**
	 * Subscribe to connection-status changes. The callback receives whether the
	 * transport currently reports a connection. Only meaningful for websocket;
	 * webrtc callers rely on {@link connectedNow} instead.
	 */
	onStatus: (cb: (connected: boolean) => void) => void;
	/** Whether the transport reports a connection immediately after creation. */
	connectedNow: boolean;
	/**
	 * Subscribe to the provider's initial-document-sync confirmation. Websocket
	 * fires reliably once the server sync completes; webrtc only fires when a
	 * peer syncs with us (a lone fresh-room peer never receives one, so callers
	 * pair this with a grace timer, see the shared createSyncGate).
	 */
	onSynced: (cb: () => void) => void;
	/** Whether the provider already reports its initial sync as complete. */
	syncedNow: boolean;
	/** Tear the provider down (disconnect + destroy). */
	destroy: () => void;
}

/** The minimal Y.Doc surface both providers accept. */
type YDocInput = ConstructorParameters<typeof import('y-websocket').WebsocketProvider>[2];

/**
 * Create and return a normalised provider handle for the requested transport.
 * Callers must destroy any previous provider first: y-webrtc throws when the
 * same room is joined twice within one page.
 */
export async function createCollabProvider(
	transport: CollaborationTransport,
	config: CollaborationConfig,
	doc: YDocInput,
): Promise<CollabProviderHandle> {
	if (transport === 'webrtc') {
		const { WebrtcProvider } = await import('y-webrtc');
		const provider = new WebrtcProvider(config.roomId, doc, {
			signaling: config.signaling?.length ? config.signaling : undefined,
			password: config.authToken || undefined,
		});
		const departure = createDepartureChannel(config.roomId, provider.awareness);
		return {
			awareness: provider.awareness as unknown as AwarenessLike,
			onStatus: (cb) => provider.on('status', (event) => cb(Boolean(event.connected))),
			connectedNow: true,
			onSynced: (cb) =>
				provider.on('synced', (event: { synced?: boolean }) => {
					if (event?.synced !== false) {
						cb();
					}
				}),
			syncedNow: false,
			destroy: () => {
				// Announce first: it is synchronous, so it still reaches same-browser
				// peers when this runs from a document that is being destroyed. The
				// provider's own awareness removal is broadcast a microtask later and
				// would be dropped, leaving us a ghost collaborator until the 30s
				// awareness timeout.
				departure.announce();
				departure.dispose();
				clearLocalAwareness(provider.awareness);
				provider.destroy();
			},
		};
	}

	const { WebsocketProvider } = await import('y-websocket');
	const provider = new WebsocketProvider(config.serverUrl, config.roomId, doc, {
		params: config.authToken ? { token: config.authToken } : undefined,
	});
	const departure = createDepartureChannel(config.roomId, provider.awareness);
	return {
		awareness: provider.awareness as unknown as AwarenessLike,
		onStatus: (cb) =>
			provider.on('status', (event: { status?: string }) => {
				if (event.status === 'connected') {
					cb(true);
				} else if (event.status === 'disconnected') {
					cb(false);
				}
			}),
		connectedNow: provider.wsconnected,
		onSynced: (cb) =>
			provider.on('sync', (isSynced: boolean) => {
				if (isSynced) {
					cb();
				}
			}),
		syncedNow: provider.synced,
		destroy: () => {
			departure.announce();
			departure.dispose();
			clearLocalAwareness(provider.awareness);
			provider.disconnect();
			provider.destroy();
		},
	};
}
