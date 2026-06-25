import { formatVersionTimestamp as formatTimestamp, formatRelativeTime } from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClock, LuDownload, LuTrash2, LuX } from 'react-icons/lu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecoveryVersion {
	key: string;
	timestamp: number;
	size: number;
	data: Uint8Array;
}

export interface VersionHistoryPanelProps {
	isOpen: boolean;
	filePath: string | undefined;
	onClose: () => void;
	onRestore: (versionData: Uint8Array) => void;
}

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

async function getVersions(filePath: string): Promise<RecoveryVersion[]> {
	try {
		const db = await openAutosaveDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const req = store.get(filePath);
			req.onsuccess = () => {
				db.close();
				const result = req.result as RecoveryVersion | undefined;
				resolve(result ? [result] : []);
			};
			req.onerror = () => {
				db.close();
				resolve([]);
			};
		});
	} catch {
		return [];
	}
}

async function deleteVersion(filePath: string): Promise<void> {
	try {
		const db = await openAutosaveDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.delete(filePath);
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				resolve();
			};
		});
	} catch {
		// ignore
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionHistoryPanel({
	isOpen,
	filePath,
	onClose,
	onRestore,
}: VersionHistoryPanelProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [versions, setVersions] = useState<RecoveryVersion[]>([]);
	const [loading, setLoading] = useState(false);
	const [restoringKey, setRestoringKey] = useState<string | null>(null);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);

	// ── Fetch versions ──────────────────────────────────────────────
	const fetchVersions = useCallback(async () => {
		if (!filePath) {
			return;
		}
		setLoading(true);
		try {
			const result = await getVersions(filePath);
			setVersions(result);
		} catch {
			setVersions([]);
		} finally {
			setLoading(false);
		}
	}, [filePath]);

	useEffect(() => {
		if (isOpen) {
			void fetchVersions();
		}
	}, [isOpen, fetchVersions]);

	// ── Restore ─────────────────────────────────────────────────────
	const handleRestore = useCallback(
		async (version: RecoveryVersion) => {
			setRestoringKey(version.key);
			try {
				if (version.data) {
					onRestore(version.data);
					onClose();
				}
			} finally {
				setRestoringKey(null);
			}
		},
		[onRestore, onClose],
	);

	// ── Delete ──────────────────────────────────────────────────────
	const handleDelete = useCallback(
		async (version: RecoveryVersion) => {
			setDeletingKey(version.key);
			try {
				await deleteVersion(version.key);
				await fetchVersions();
			} finally {
				setDeletingKey(null);
			}
		},
		[fetchVersions],
	);

	if (!isOpen) {
		return null;
	}

	return (
		<div className='absolute inset-y-0 right-0 w-80 bg-background border-l border-border z-50 flex flex-col shadow-xl'>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-border'>
				<div className='flex items-center gap-2 text-sm font-medium text-foreground'>
					<LuClock className='w-4 h-4' />
					{t('pptx.versionHistory.title')}
				</div>
				<button
					onClick={onClose}
					className='p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground'
				>
					<LuX className='w-4 h-4' />
				</button>
			</div>

			{/* Content */}
			<div className='flex-1 overflow-y-auto'>
				{loading && (
					<div className='px-3 py-8 text-center text-xs text-muted-foreground'>
						{t('common.loading')}
					</div>
				)}

				{!loading && versions.length === 0 && (
					<div className='px-3 py-8 text-center text-xs text-muted-foreground'>
						{t('pptx.versionHistory.noVersions')}
					</div>
				)}

				{!loading &&
					versions.map((version) => (
						<div
							key={version.key}
							className='px-3 py-2.5 border-b border-border hover:bg-muted/50 group'
						>
							<div className='flex items-center justify-between'>
								<div className='text-xs text-foreground'>{formatTimestamp(version.timestamp)}</div>
								<div className='text-[10px] text-muted-foreground'>
									{formatRelativeTime(version.timestamp)}
								</div>
							</div>
							<div className='text-[10px] text-muted-foreground mt-0.5'>
								{formatFileSize(version.size)}
							</div>
							<div className='flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
								<button
									onClick={() => void handleRestore(version)}
									disabled={restoringKey === version.key}
									className='inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40'
								>
									<LuDownload className='w-3 h-3' />
									{restoringKey === version.key
										? t('common.loading')
										: t('pptx.versionHistory.restore')}
								</button>
								<button
									onClick={() => void handleDelete(version)}
									disabled={deletingKey === version.key}
									className='inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-40'
								>
									<LuTrash2 className='w-3 h-3' />
									{t('common.delete')}
								</button>
							</div>
						</div>
					))}
			</div>
		</div>
	);
}
