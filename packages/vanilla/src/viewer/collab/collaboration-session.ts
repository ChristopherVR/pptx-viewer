import type {
	AwarenessLike,
	CollaborationConfig,
	CollaborationTransport,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import { borrowExternalCollaborationAwareness } from 'pptx-viewer-shared';

import type { CollabProviderHandle } from './collaboration-provider';
import { createCollabProvider } from './collaboration-provider';

export interface CollaborationSession {
	doc: YDocLike;
	factories: YjsFactories;
	awareness: AwarenessLike;
	provider?: CollabProviderHandle;
	dispose(): void;
}

/** Lazy creation keeps transport ownership distinct from borrowed host resources. */
export async function createCollaborationSession(
	config: CollaborationConfig,
	transport: CollaborationTransport,
): Promise<CollaborationSession> {
	const Y = await import('yjs');
	const factories: YjsFactories = {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};
	if (config.externalSession) {
		const borrowed = borrowExternalCollaborationAwareness(config.externalSession.awareness);
		return {
			doc: config.externalSession.doc,
			factories,
			awareness: borrowed.awareness,
			dispose: borrowed.dispose,
		};
	}
	const doc = new Y.Doc();
	try {
		const provider = await createCollabProvider(transport, config, doc);
		return {
			doc,
			factories,
			awareness: provider.awareness,
			provider,
			dispose() {
				provider.destroy();
				doc.destroy();
			},
		};
	} catch (error) {
		doc.destroy();
		throw error;
	}
}
