/**
 * useYjsDocumentSync -- Syncs PptxSlide[] state with a Yjs Y.Doc using the
 * granular `pptx:slides` Y.Array structure (one Y.Map per slide, per-element
 * Y.Maps, and Y.Text for textSegments). This matches the schema defined by
 * PptxCodec in packages/tools so all bindings and the codec are interoperable.
 *
 * Write-back (Area 3): when the collaboration role is `'owner'`, the hook
 * debounces Y.Doc changes and calls `config.onWriteBack` with the serialized
 * PPTX bytes so the host can persist a durable snapshot.
 */

import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YjsFactories } from 'pptx-viewer-shared';
import { writeSlidesToYDoc, readSlidesFromYDoc, observeYDocSlides } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';
import type { Doc as YDoc } from 'yjs';

const WRITE_BACK_DEBOUNCE_DEFAULT_MS = 5_000;

export interface UseYjsDocumentSyncInput {
	/** The Yjs document (from useYjsProvider). null when not collaborating. */
	doc: YDoc | null;
	/** Current slides state. */
	slides: PptxSlide[];
	/** React state setter for slides. */
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	/** Whether collaboration is active (status === 'connected'). */
	isConnected: boolean;
	/** Collaboration config (for role and write-back). */
	config?: Pick<CollaborationConfig, 'role' | 'onWriteBack' | 'writeBackDebounceMs'>;
	/**
	 * Return the source PPTX bytes for write-back serialization. Only called
	 * when role === 'owner' and onWriteBack is set.
	 */
	getSourceBytes?: () => Uint8Array | null;
}

export function useYjsDocumentSync({
	doc,
	slides,
	setSlides,
	isConnected,
	config,
	getSourceBytes,
}: UseYjsDocumentSyncInput): void {
	const isApplyingRemoteRef = useRef(false);
	const lastSyncedRef = useRef('');
	const hasInitializedRef = useRef(false);
	const writeBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const factoriesRef = useRef<YjsFactories | null>(null);

	// Lazily build the factories once we have a live Yjs import.
	const getFactories = useCallback(async (): Promise<YjsFactories> => {
		if (factoriesRef.current) {
			return factoriesRef.current;
		}
		const Y = await import('yjs');
		const factories: YjsFactories = {
			createMap: () => new Y.Map(),
			createArray: () => new Y.Array(),
			createText: () => new Y.Text(),
		};
		factoriesRef.current = factories;
		return factories;
	}, []);

	// Schedule a debounced write-back for the elected writer (role === 'owner').
	const scheduleWriteBack = useCallback(() => {
		if (!config?.onWriteBack || config.role !== 'owner' || !doc) {
			return;
		}
		if (writeBackTimerRef.current !== null) {
			clearTimeout(writeBackTimerRef.current);
		}
		const debounceMs = config.writeBackDebounceMs ?? WRITE_BACK_DEBOUNCE_DEFAULT_MS;
		writeBackTimerRef.current = setTimeout(async () => {
			writeBackTimerRef.current = null;
			if (!doc || !config.onWriteBack) {
				return;
			}
			const sourceBytes = getSourceBytes?.();
			if (!sourceBytes) {
				return;
			}
			try {
				const { PptxHandler } = await import('pptx-viewer-core');
				const handler = new PptxHandler();
				await handler.load(sourceBytes.buffer as ArrayBuffer);
				const currentSlides = readSlidesFromYDoc(
					doc as unknown as Parameters<typeof readSlidesFromYDoc>[0],
				);
				const bytes = await handler.save(currentSlides);
				config.onWriteBack(bytes);
			} catch {
				/* write-back failures are non-fatal */
			}
		}, debounceMs);
	}, [doc, config, getSourceBytes]);

	// Sync local slide changes -> Y.Doc
	useEffect(() => {
		if (!isConnected || !doc || isApplyingRemoteRef.current || slides.length === 0) {
			return;
		}

		const serialized = JSON.stringify(slides);
		if (serialized === lastSyncedRef.current) {
			return;
		}
		lastSyncedRef.current = serialized;

		void (async () => {
			const factories = await getFactories();
			writeSlidesToYDoc(
				slides,
				doc as unknown as Parameters<typeof writeSlidesToYDoc>[1],
				factories,
			);
			scheduleWriteBack();
		})();
	}, [doc, slides, isConnected, getFactories, scheduleWriteBack]);

	// Sync remote Y.Doc changes -> local state
	useEffect(() => {
		if (!isConnected || !doc) {
			return;
		}

		const handleChange = () => {
			const remoteSlides = readSlidesFromYDoc(
				doc as unknown as Parameters<typeof readSlidesFromYDoc>[0],
			);
			if (remoteSlides.length === 0) {
				return;
			}

			const serialized = JSON.stringify(remoteSlides);
			if (serialized === lastSyncedRef.current) {
				return;
			}
			lastSyncedRef.current = serialized;

			isApplyingRemoteRef.current = true;
			setSlides(remoteSlides);
			requestAnimationFrame(() => {
				isApplyingRemoteRef.current = false;
			});
			scheduleWriteBack();
		};

		const unobserve = observeYDocSlides(
			doc as unknown as Parameters<typeof observeYDocSlides>[0],
			handleChange,
		);

		// Late-joiner: if the Y.Doc already has slides, load them immediately.
		if (!hasInitializedRef.current) {
			hasInitializedRef.current = true;
			const arr = (doc as unknown as { getArray: (k: string) => { length: number } }).getArray(
				'pptx:slides',
			);
			if (arr.length > 0) {
				handleChange();
			}
		}

		return () => {
			unobserve();
			if (writeBackTimerRef.current !== null) {
				clearTimeout(writeBackTimerRef.current);
				writeBackTimerRef.current = null;
			}
		};
	}, [doc, isConnected, setSlides, scheduleWriteBack]);
}
