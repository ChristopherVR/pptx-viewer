import type { PptxSlide } from 'pptx-viewer-core';
/**
 * useYjsDocumentSync -- Syncs PptxSlide[] state with a Yjs Y.Map for
 * real-time collaboration. Each slide is stored as a JSON-serialized
 * entry keyed by its index in the Y.Map.
 *
 * - Local changes: detects diffs in slides array and writes changed slides to Y.Map
 * - Remote changes: observes Y.Map updates and applies them to local state via setSlides
 * - Uses a flag to prevent infinite update loops
 *
 * @module collaboration/useYjsDocumentSync
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Doc as YDoc, Map as YMap } from 'yjs';

// The Y.Map stores `count` as a number and `slide-<i>` keys as JSON strings.
type SlidesDataMap = YMap<number | string>;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseYjsDocumentSyncInput {
	/** The Yjs document (from useCollaboration). null when not collaborating. */
	doc: YDoc | null;
	/** Current slides state. */
	slides: PptxSlide[];
	/** React state setter for slides. */
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	/** Whether collaboration is active (status === 'connected'). */
	isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYjsDocumentSync({
	doc,
	slides,
	setSlides,
	isConnected,
}: UseYjsDocumentSyncInput): void {
	// Flag to prevent sync loops: when we're applying a remote update,
	// don't re-sync it back to Y.Doc
	const isApplyingRemoteRef = useRef(false);
	// Track last synced slide data to detect actual changes
	const lastSyncedRef = useRef<string>('');
	// Track if we're the initial loader (host vs joiner)
	const hasInitializedRef = useRef(false);

	// Get the Y.Map from the doc
	const getDocMap = useCallback((): SlidesDataMap | null => {
		if (!doc) {
			return null;
		}
		return doc.getMap<number | string>('slides-data');
	}, [doc]);

	// --- Sync local changes TO Y.Doc ---
	useEffect(() => {
		if (!isConnected || !doc) {
			return;
		}
		if (isApplyingRemoteRef.current) {
			return;
		}
		if (slides.length === 0) {
			return;
		}

		const map = getDocMap();
		if (!map) {
			return;
		}

		// Serialize current slides
		const serialized = JSON.stringify(slides);

		// Skip if nothing changed
		if (serialized === lastSyncedRef.current) {
			return;
		}
		lastSyncedRef.current = serialized;

		// Write to Y.Doc inside a transaction
		doc.transact(() => {
			// Clear extra entries if slide count decreased
			const currentCount = map.get('count');
			if (typeof currentCount === 'number' && currentCount > slides.length) {
				for (let i = slides.length; i < currentCount; i++) {
					map.delete(`slide-${i}`);
				}
			}
			map.set('count', slides.length);
			for (let i = 0; i < slides.length; i++) {
				const slideJson = JSON.stringify(slides[i]);
				const existing = map.get(`slide-${i}`);
				if (existing !== slideJson) {
					map.set(`slide-${i}`, slideJson);
				}
			}
		});
	}, [doc, slides, isConnected, getDocMap]);

	// --- Sync remote changes FROM Y.Doc ---
	useEffect(() => {
		if (!isConnected || !doc) {
			return;
		}

		const map = getDocMap();
		if (!map) {
			return;
		}

		const handleUpdate = () => {
			const count = map.get('count');
			if (typeof count !== 'number' || count === 0) {
				return;
			}

			// Reconstruct slides from Y.Map
			const remoteSlides: PptxSlide[] = [];
			for (let i = 0; i < count; i++) {
				const slideJson = map.get(`slide-${i}`);
				if (typeof slideJson === 'string') {
					try {
						remoteSlides.push(JSON.parse(slideJson));
					} catch {
						// Skip malformed entries
					}
				}
			}

			if (remoteSlides.length === 0) {
				return;
			}

			const serialized = JSON.stringify(remoteSlides);
			if (serialized === lastSyncedRef.current) {
				return;
			}
			lastSyncedRef.current = serialized;

			// Apply remote changes to local state
			isApplyingRemoteRef.current = true;
			setSlides(remoteSlides);
			// Reset flag after React processes the update
			requestAnimationFrame(() => {
				isApplyingRemoteRef.current = false;
			});
		};

		map.observe(handleUpdate);

		// On first connect, if the Y.Map already has data (we're a joiner),
		// load it
		if (!hasInitializedRef.current) {
			hasInitializedRef.current = true;
			const count = map.get('count');
			if (typeof count === 'number' && count > 0) {
				handleUpdate();
			}
		}

		return () => {
			map.unobserve(handleUpdate);
		};
	}, [doc, isConnected, getDocMap, setSlides]);
}
