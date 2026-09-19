/**
 * useCollaborationLivePatch: attach the shared live-patch channel to the
 * session's Y.Doc.
 *
 * The channel (see `createCollaborationLivePatcher` in `pptx-viewer-shared`)
 * publishes INTERIM state: drag/resize geometry and inline-editor text that
 * has not yet reached `slides`, and therefore has not reached
 * `useYjsDocumentSync`'s reconcile pass. This hook only owns its lifecycle:
 * hand it the doc while the session is connected and synced, detach otherwise
 * so every `patch*` call becomes a no-op.
 */

import type {
	CollaborationLivePatcher,
	ExternalCollaborationSession,
	YjsFactories,
} from 'pptx-viewer-shared';
import { createSnapshotTextPositions } from 'pptx-viewer-shared';
import { useEffect, useRef, useState } from 'react';
import type { Doc as YDoc } from 'yjs';

export interface UseCollaborationLivePatchInput {
	/** The per-viewer channel instance (from `useViewerState`). */
	patcher: CollaborationLivePatcher;
	/** The Yjs document, or null when not collaborating. */
	doc: YDoc | null;
	/** Whether the session is connected. */
	isConnected: boolean;
	/**
	 * Whether the provider finished its initial sync. Interim writes are gated
	 * on it for the same reason the reconcile pass is: a late joiner must not
	 * push local state into a room whose real content has not arrived.
	 */
	isSynced?: boolean;
	externalSession?: ExternalCollaborationSession;
	/** Preserve accepted native edits before this owned channel goes dormant. */
	onBeforeDetach?: (doc: YDoc) => void;
}

export function useCollaborationLivePatch({
	patcher,
	doc,
	isConnected,
	isSynced = true,
	externalSession,
	onBeforeDetach,
}: UseCollaborationLivePatchInput): boolean {
	const latestDetach = useRef(onBeforeDetach);
	latestDetach.current = onBeforeDetach;
	const [initialized, setInitialized] = useState<{
		doc: YDoc;
		patcher: CollaborationLivePatcher;
	} | null>(null);
	useEffect(() => {
		// Host-owned channels are configured by the shared document readiness
		// controller, including its empty-join adoption gate.
		if (externalSession) {
			return;
		}
		if (!doc || !isConnected || !isSynced) {
			patcher.configure(null, null);
			return;
		}
		let cancelled = false;
		let factories: YjsFactories | null = null;
		const configure = (): void => {
			const ready = isSynced;
			patcher.configure(ready && factories ? doc : null, ready ? factories : null);
		};
		void (async () => {
			const Y = await import('yjs');
			if (cancelled) {
				return;
			}
			factories = {
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
			};
			configure();
			setInitialized({ doc, patcher });
		})();
		return () => {
			cancelled = true;
			if (factories) {
				latestDetach.current?.(doc);
			}
			patcher.configure(null, null);
		};
	}, [patcher, doc, isConnected, isSynced, externalSession]);
	// Retain the existing local/offline editing policy after initial setup, but
	// never let a new document enter a local-only editor during its first sync.
	return initialized?.doc === doc && initialized?.patcher === patcher;
}
