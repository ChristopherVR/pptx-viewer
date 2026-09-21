import type { ViewerOptions } from 'pptx-viewer-shared';
import {
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	resolveExpiredAutosaveSnapshots,
	shouldClearAutosaveCacheOnClose,
} from 'pptx-viewer-shared';
import { useEffect } from 'react';

// Keep this callback outside the viewer's render scope: browser listeners must
// not retain a render's full slide state through a shared lexical context.
function handleClearOptionsCache(): void {
	void (async () => {
		try {
			const snapshots = await listAutosaveSnapshots();
			await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
		} catch {
			// Browser lifecycle cleanup cannot report an IndexedDB failure.
		}
	})();
}

/** Full-viewer cache maintenance, separate from the headless options store. */
export function useAutosaveCacheMaintenance(viewerOptions: ViewerOptions): () => void {
	// File > Options > Save > "cache retention": a one-time sweep per mount is
	// enough, since a fresh snapshot only ever lands with a fresh timestamp.
	useEffect(() => {
		void (async () => {
			try {
				const snapshots = await listAutosaveSnapshots();
				const expired = resolveExpiredAutosaveSnapshots(snapshots, viewerOptions);
				await Promise.all(expired.map((key) => deleteAutosaveSnapshot(key)));
			} catch {
				// Best-effort background maintenance; a blocked IndexedDB skips it.
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one sweep per mount, not per option edit
	}, []);

	// File > Options > Save > "clear cache on close": wipe recovery snapshots
	// when the tab closes/navigates away, and when this viewer unmounts.
	useEffect(() => {
		const clearIfRequested = (): void => {
			if (shouldClearAutosaveCacheOnClose(viewerOptions)) {
				handleClearOptionsCache();
			}
		};
		window.addEventListener('beforeunload', clearIfRequested);
		return () => {
			window.removeEventListener('beforeunload', clearIfRequested);
			clearIfRequested();
		};
	}, [viewerOptions]);

	return handleClearOptionsCache;
}
