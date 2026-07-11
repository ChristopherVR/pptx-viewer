/**
 * collaboration-session.ts: the live Yjs document + transport for one
 * collaboration session, plus the default factory that builds it.
 *
 * Kept separate from the runes controller (`collaboration.svelte.ts`) so the
 * controller can accept a fake {@link CollabSessionFactory} in tests without
 * pulling in the real `yjs` / `y-webrtc` / `y-websocket` modules (which are
 * dynamically imported here on demand and only optional peer dependencies).
 */
import type {
	CollaborationConfig,
	CollaborationTransport,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';

import type { CollabProviderHandle } from './collaboration-provider';
import { createCollabProvider } from './collaboration-provider';

/** A fully-wired collaboration session: the doc, its factories, and transport. */
export interface CollabSession {
	/** The live Y.Doc (structural view used by the shared reconcile helpers). */
	ydoc: YDocLike;
	/** Factories the shared reconcile helpers use to build Y.Map/Array/Text. */
	factories: YjsFactories;
	/** The normalised transport provider handle. */
	provider: CollabProviderHandle;
	/** Tear down the provider and destroy the doc. */
	destroy: () => void;
}

/**
 * Build a live session for the given transport + config. Injectable so tests
 * can substitute an in-memory fake (see `collaboration.svelte.ts`).
 */
export type CollabSessionFactory = (
	transport: CollaborationTransport,
	config: CollaborationConfig,
) => Promise<CollabSession>;

/**
 * Default factory: dynamically import `yjs`, build a `Y.Doc` plus the
 * `YjsFactories`, and attach the requested transport provider.
 */
export const createDefaultSession: CollabSessionFactory = async (transport, config) => {
	const Y = await import('yjs');
	const doc = new Y.Doc();
	const factories: YjsFactories = {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};
	const provider = await createCollabProvider(transport, config, doc);
	return {
		ydoc: doc as unknown as YDocLike,
		factories,
		provider,
		destroy: () => {
			provider.destroy();
			doc.destroy();
		},
	};
};
