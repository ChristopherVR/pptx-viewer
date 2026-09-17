import type { CollaborationConfig, CollaborationTransport } from '../internal/shared';
import { createSnapshotTextPositions } from '../internal/shared';
import { activateExternalSession } from './collaboration-external-session';
import { createWebrtcBundle, createWebsocketBundle } from './collaboration-providers';
import type { ActiveSession, ActivateSessionDeps } from './collaboration-session-setup';
import { activateSession } from './collaboration-session-setup';

/** Finish lazy imports only while the requesting connection still owns the service. */
export async function connectSession(
	config: CollaborationConfig,
	transport: CollaborationTransport,
	deps: ActivateSessionDeps,
	isCurrent: () => boolean,
): Promise<ActiveSession | null> {
	if (config.externalSession) {
		const Y = await import('yjs');
		if (!isCurrent()) {
			return null;
		}
		const doc = config.externalSession.doc as import('yjs').Doc;
		return activateExternalSession(
			config.externalSession,
			config,
			{
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
				createTextPositions: (text) =>
					createSnapshotTextPositions(text, {
						read: () => Y.snapshot(doc),
						equal: Y.equalSnapshots,
						subscribeBeforeObservers: (listener) => {
							doc.on('beforeObserverCalls', listener);
							return () => doc.off('beforeObserverCalls', listener);
						},
					}),
			},
			deps,
		);
	}
	const bundle =
		transport === 'webrtc' ? await createWebrtcBundle(config) : await createWebsocketBundle(config);
	if (!isCurrent()) {
		bundle.departure.dispose();
		bundle.provider.disconnect();
		bundle.provider.destroy();
		bundle.doc.destroy();
		return null;
	}
	return activateSession(bundle, config, transport, deps);
}
