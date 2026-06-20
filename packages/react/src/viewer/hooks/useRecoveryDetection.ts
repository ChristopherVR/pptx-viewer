/**
 * useRecoveryDetection: Checks for recent autosave recovery versions on mount
 * and opens the version-history panel if a recovery entry exists.
 */
import { useEffect, useRef } from 'react';

import { shouldCheckRecovery, hasRecentRecoveryVersion } from './useRecoveryDetection-helpers';

// ---------------------------------------------------------------------------
// IndexedDB access (mirrors the DB used by useAutosave)
// ---------------------------------------------------------------------------

const DB_NAME = 'pptx-viewer-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'recoveryVersions';

function openAutosaveDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function getRecoveryVersion(filePath: string): Promise<{ timestamp: number } | undefined> {
	try {
		const db = await openAutosaveDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const req = store.get(filePath);
			req.onsuccess = () => {
				db.close();
				resolve(req.result as { timestamp: number } | undefined);
			};
			req.onerror = () => {
				db.close();
				resolve(undefined);
			};
		});
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseRecoveryDetectionInput {
	filePath: string | undefined;
	loading: boolean;
	error: string | null;
	slideCount: number;
	openVersionHistory: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecoveryDetection(input: UseRecoveryDetectionInput): void {
	const { filePath, loading, error, slideCount, openVersionHistory } = input;
	const recoveryCheckedRef = useRef(false);

	useEffect(() => {
		if (
			!shouldCheckRecovery({
				alreadyChecked: recoveryCheckedRef.current,
				filePath,
				loading,
				error,
				slideCount,
			})
		) {
			return;
		}
		recoveryCheckedRef.current = true;

		if (typeof indexedDB === 'undefined') {
			return;
		}

		void (async () => {
			try {
				const version = await getRecoveryVersion(filePath!);
				if (version && hasRecentRecoveryVersion([version], Date.now())) {
					openVersionHistory();
				}
			} catch {
				// Silently ignore recovery check errors
			}
		})();
	}, [filePath, loading, error, slideCount, openVersionHistory]);
}
