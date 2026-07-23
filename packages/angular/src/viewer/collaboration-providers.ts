/**
 * collaboration-providers.ts: transport factories for the Angular
 * collaboration service.
 *
 * Isolates the dynamic `yjs` / `y-websocket` / `y-webrtc` imports and provider
 * construction so the service focuses on lifecycle + reactive state. The Yjs
 * packages are dynamically imported (plain string-literal specifiers, matching
 * React/Vue) so they are fully tree-shaken when collaboration is unused, while
 * still resolving correctly under a consuming app's Vite dev server: an
 * `@vite-ignore`d or variable specifier skips Vite's dev-time bare-specifier
 * rewrite, which then fails to resolve natively in the browser.
 */

import type {
	CollaborationConfig,
	DepartureChannel,
	YjsFactories,
	YDocLike,
	YMapLike,
	YArrayLike,
	YTextLike,
} from '../internal/shared';
import { createDepartureChannel } from '../internal/shared';

/** Minimal awareness surface used by the service. */
export interface AwarenessLike {
	clientID?: number;
	/** Passing `null` withdraws the local presence (see `clearLocalAwareness`). */
	setLocalState?: (state: null) => void;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

/** Y.Doc plus a `destroy()` handle. */
export interface DestroyableYDoc extends YDocLike {
	destroy: () => void;
}

/** Minimal provider surface used by the service. */
export interface ProviderLike {
	awareness: AwarenessLike;
	disconnect: () => void;
	destroy: () => void;
	on: (event: string, cb: (payload: Record<string, unknown>) => void) => void;
	/** y-websocket only: true once the socket is open. */
	wsconnected?: boolean;
	/** y-websocket only: true once the initial server document sync completed. */
	synced?: boolean;
}

/** Everything a freshly-created transport hands back to the service. */
export interface ProviderBundle {
	doc: DestroyableYDoc;
	provider: ProviderLike;
	awareness: AwarenessLike;
	factories: YjsFactories;
	/**
	 * Synchronous "I am leaving" announcement. The provider's own awareness
	 * removal is broadcast a microtask later, which never escapes a document
	 * that is already being destroyed (see the shared collaboration-departure
	 * module), so `disconnect()` announces through this first.
	 */
	departure: DepartureChannel;
}

interface YModule {
	Doc: new () => DestroyableYDoc;
	Map: new () => YMapLike;
	Array: new () => YArrayLike;
	Text: new () => YTextLike;
}

interface WebsocketProviderModule {
	WebsocketProvider: new (
		serverUrl: string,
		roomId: string,
		doc: unknown,
		opts?: { params?: Record<string, string> },
	) => unknown;
}

interface WebrtcProviderModule {
	WebrtcProvider: new (
		roomId: string,
		doc: unknown,
		opts?: { signaling?: string[]; password?: string },
	) => unknown;
}

async function createDoc(): Promise<{ doc: DestroyableYDoc; factories: YjsFactories; Y: YModule }> {
	const Y = (await import('yjs')) as unknown as YModule;
	const doc = new Y.Doc();
	const factories: YjsFactories = {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};
	return { doc, factories, Y };
}

/** Create a y-websocket transport bundle for `config`. */
export async function createWebsocketBundle(config: CollaborationConfig): Promise<ProviderBundle> {
	const [{ doc, factories }, yws] = await Promise.all([
		createDoc(),
		import('y-websocket') as Promise<WebsocketProviderModule>,
	]);
	const provider = new yws.WebsocketProvider(
		config.serverUrl,
		config.roomId,
		doc,
		config.authToken ? { params: { token: config.authToken } } : undefined,
	) as unknown as ProviderLike;
	return {
		doc,
		provider,
		awareness: provider.awareness,
		factories,
		departure: createDepartureChannel(config.roomId, provider.awareness),
	};
}

/**
 * Create a y-webrtc (peer-to-peer, serverless) transport bundle for `config`.
 * Peers rendezvous through the configured `signaling` servers (or y-webrtc's
 * public default) and same-browser tabs additionally sync via BroadcastChannel.
 * `authToken` is passed as the room `password`.
 */
export async function createWebrtcBundle(config: CollaborationConfig): Promise<ProviderBundle> {
	const [{ doc, factories }, yrtc] = await Promise.all([
		createDoc(),
		import('y-webrtc') as Promise<WebrtcProviderModule>,
	]);
	const provider = new yrtc.WebrtcProvider(config.roomId, doc, {
		signaling: config.signaling?.length ? config.signaling : undefined,
		password: config.authToken || undefined,
	}) as unknown as ProviderLike;
	return {
		doc,
		provider,
		awareness: provider.awareness,
		factories,
		departure: createDepartureChannel(config.roomId, provider.awareness),
	};
}
