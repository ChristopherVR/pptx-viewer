/**
 * collaboration-providers.ts: transport factories for the Angular
 * collaboration service.
 *
 * Isolates the dynamic `yjs` / `y-websocket` / `y-webrtc` imports and provider
 * construction so the service focuses on lifecycle + reactive state. The Yjs
 * packages are dynamically imported so they are fully tree-shaken when
 * collaboration is unused; each specifier is read from a variable so bundlers
 * do not eagerly follow it (mirrors the historical `/* @vite-ignore *\/`
 * pattern).
 */

import type {
	CollaborationConfig,
	YjsFactories,
	YDocLike,
	YMapLike,
	YArrayLike,
	YTextLike,
} from '../internal/shared';

/** Minimal awareness surface used by the service. */
export interface AwarenessLike {
	clientID?: number;
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
}

/** Everything a freshly-created transport hands back to the service. */
export interface ProviderBundle {
	doc: DestroyableYDoc;
	provider: ProviderLike;
	awareness: AwarenessLike;
	factories: YjsFactories;
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
	const yModule = 'yjs';
	const Y = (await import(/* @vite-ignore */ yModule)) as unknown as YModule;
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
	const wsSpecifier = 'y-websocket';
	const [{ doc, factories }, yws] = await Promise.all([
		createDoc(),
		import(/* @vite-ignore */ wsSpecifier) as Promise<WebsocketProviderModule>,
	]);
	const provider = new yws.WebsocketProvider(
		config.serverUrl,
		config.roomId,
		doc,
		config.authToken ? { params: { token: config.authToken } } : undefined,
	) as unknown as ProviderLike;
	return { doc, provider, awareness: provider.awareness, factories };
}

/**
 * Create a y-webrtc (peer-to-peer, serverless) transport bundle for `config`.
 * Peers rendezvous through the configured `signaling` servers (or y-webrtc's
 * public default) and same-browser tabs additionally sync via BroadcastChannel.
 * `authToken` is passed as the room `password`.
 */
export async function createWebrtcBundle(config: CollaborationConfig): Promise<ProviderBundle> {
	const rtcSpecifier = 'y-webrtc';
	const [{ doc, factories }, yrtc] = await Promise.all([
		createDoc(),
		import(/* @vite-ignore */ rtcSpecifier) as Promise<WebrtcProviderModule>,
	]);
	const provider = new yrtc.WebrtcProvider(config.roomId, doc, {
		signaling: config.signaling?.length ? config.signaling : undefined,
		password: config.authToken || undefined,
	}) as unknown as ProviderLike;
	return { doc, provider, awareness: provider.awareness, factories };
}
