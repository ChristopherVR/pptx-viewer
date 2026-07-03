/**
 * collaboration-provider.ts: create the Yjs transport provider (y-websocket or
 * y-webrtc) for a collaboration session and normalise it into a small handle.
 *
 * The two providers differ in their constructor, status events and teardown, so
 * this helper hides those differences behind {@link CollabProviderHandle}:
 *
 *  - `websocket`: `new WebsocketProvider(serverUrl, roomId, doc, { params })`;
 *    status events carry `{ status }`; `wsconnected` reports the live state.
 *  - `webrtc`: `new WebrtcProvider(roomId, doc, { signaling, password })`; needs
 *    no document server. Same-browser tabs meet over BroadcastChannel
 *    immediately, so the handle reports `connectedNow: true`.
 *
 * Both expose `.awareness` and `.destroy()`; no `any` leaks out.
 */
import type { CollaborationConfig, CollaborationTransport } from 'pptx-viewer-shared';

import type { AwarenessLike } from './collaboration-types';

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
		return {
			awareness: provider.awareness as unknown as AwarenessLike,
			onStatus: (cb) => provider.on('status', (event) => cb(Boolean(event.connected))),
			connectedNow: true,
			destroy: () => provider.destroy(),
		};
	}

	const { WebsocketProvider } = await import('y-websocket');
	const provider = new WebsocketProvider(config.serverUrl, config.roomId, doc, {
		params: config.authToken ? { token: config.authToken } : undefined,
	});
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
		destroy: () => {
			provider.disconnect();
			provider.destroy();
		},
	};
}
