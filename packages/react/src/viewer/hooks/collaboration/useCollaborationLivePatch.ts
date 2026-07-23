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

import type { CollaborationLivePatcher, YjsFactories } from 'pptx-viewer-shared';
import { useEffect } from 'react';
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
}

export function useCollaborationLivePatch({
	patcher,
	doc,
	isConnected,
	isSynced = true,
}: UseCollaborationLivePatchInput): void {
	useEffect(() => {
		if (!doc || !isConnected || !isSynced) {
			patcher.configure(null, null);
			return;
		}
		let cancelled = false;
		void (async () => {
			const Y = await import('yjs');
			if (cancelled) {
				return;
			}
			const factories: YjsFactories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};
			patcher.configure(doc as unknown as Parameters<typeof patcher.configure>[0], factories);
		})();
		return () => {
			cancelled = true;
			patcher.configure(null, null);
		};
	}, [patcher, doc, isConnected, isSynced]);
}
