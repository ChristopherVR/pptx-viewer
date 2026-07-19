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

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YjsFactories, YTransactionLike } from 'pptx-viewer-shared';
import {
	reconcileSlidesInYDoc,
	LOCAL_SYNC_ORIGIN,
	readSlidesFromYDoc,
	observeYDocSlides,
} from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';
import type { Doc as YDoc } from 'yjs';

import { buildSaveSlides } from '../../utils/template-editing';

const WRITE_BACK_DEBOUNCE_DEFAULT_MS = 5_000;

export interface UseYjsDocumentSyncInput {
	/** The Yjs document (from useYjsProvider). null when not collaborating. */
	doc: YDoc | null;
	/** Current slides state. */
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back on write-back. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	/** React state setter for slides. */
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	/** Whether collaboration is active (status === 'connected'). */
	isConnected: boolean;
	/**
	 * Whether the provider completed its initial document sync. Local -> doc
	 * writes are gated on this so a late joiner never seeds its bootstrap deck
	 * into a room whose real content has not arrived yet. Defaults to true for
	 * callers that manage sync readiness themselves.
	 */
	isSynced?: boolean;
	/** Collaboration config (for role and write-back). */
	config?: Pick<CollaborationConfig, 'role' | 'onWriteBack' | 'writeBackDebounceMs'>;
	/**
	 * Return the source PPTX bytes for write-back serialization. Only called
	 * when role === 'owner' and onWriteBack is set.
	 */
	getSourceBytes?: () => Uint8Array | null;
	/**
	 * Monotonic counter bumped each time the content-load pipeline finishes
	 * applying a parsed deck to viewer state. A local load that lands while the
	 * shared doc already holds slides (a late joiner's bootstrap deck parsing
	 * after the room state arrived) would silently clobber the synced slides;
	 * each bump re-adopts the doc's slides when the room has content.
	 */
	loadVersion?: number;
}

export function useYjsDocumentSync({
	doc,
	slides,
	templateElementsBySlideId,
	setSlides,
	isConnected,
	isSynced = true,
	config,
	getSourceBytes,
	loadVersion = 0,
}: UseYjsDocumentSyncInput): void {
	const isApplyingRemoteRef = useRef(false);
	const lastSyncedRef = useRef('');
	const hasInitializedRef = useRef(false);
	const writeBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const factoriesRef = useRef<YjsFactories | null>(null);
	const lastLoadVersionRef = useRef(loadVersion);

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
				// Merge the separated template (master/layout) elements back so any
				// edit-template-mode changes persist into the write-back snapshot.
				const slidesToSave = buildSaveSlides(currentSlides, templateElementsBySlideId);
				const bytes = await handler.save(slidesToSave);
				config.onWriteBack(bytes);
			} catch {
				/* write-back failures are non-fatal */
			}
		}, debounceMs);
	}, [doc, config, getSourceBytes, templateElementsBySlideId]);

	// Re-adopt the shared doc after a local content load. The load pipeline
	// applies its parsed slides unconditionally, so when a load finishes AFTER
	// the room's slides were already applied (a late joiner's bootstrap deck
	// parses slower than the doc sync), the synced state would be silently
	// clobbered and, with the doc unchanged, never re-applied. On each load
	// bump: if the room already has slides, they win; an empty room means this
	// client is the seeder and the loaded deck stands.
	useEffect(() => {
		if (loadVersion === lastLoadVersionRef.current) {
			return;
		}
		lastLoadVersionRef.current = loadVersion;
		if (!doc || !isConnected) {
			return;
		}
		const docSlides = readSlidesFromYDoc(
			doc as unknown as Parameters<typeof readSlidesFromYDoc>[0],
		);
		if (docSlides.length === 0) {
			return;
		}
		// Unconditional re-apply: the freshly loaded slides differ from the doc
		// even when the doc matches what we last synced, so the usual JSON dedupe
		// must not skip this application.
		lastSyncedRef.current = JSON.stringify(docSlides);
		isApplyingRemoteRef.current = true;
		setSlides(docSlides);
		// Clear synchronously (matching Vue). A frame-gated
		// `requestAnimationFrame` clear never runs in a backgrounded tab, so the
		// flag would stay true and the local -> doc write effect would stall all
		// outbound edits until refocus. The `lastSyncedRef` JSON dedupe already
		// suppresses the echo, so no deferral is needed.
		isApplyingRemoteRef.current = false;
	}, [loadVersion, doc, isConnected, setSlides]);

	// Sync local slide changes -> Y.Doc. Gated on isSynced: until the provider
	// confirms its initial sync (or the grace period lifts the gate), local
	// state must not seed the doc, or a late joiner's bootstrap deck would
	// merge into the room's real content. When the gate opens this effect
	// re-runs and performs the (possibly first) write.
	useEffect(() => {
		if (!isConnected || !isSynced || !doc || isApplyingRemoteRef.current || slides.length === 0) {
			return;
		}

		const serialized = JSON.stringify(slides);
		if (serialized === lastSyncedRef.current) {
			return;
		}
		lastSyncedRef.current = serialized;

		void (async () => {
			const factories = await getFactories();
			// Granular reconcile: mutate only what changed, tagged with
			// LOCAL_SYNC_ORIGIN so our own remote-observer skips the echo.
			reconcileSlidesInYDoc(
				slides,
				doc as unknown as Parameters<typeof reconcileSlidesInYDoc>[1],
				factories,
				LOCAL_SYNC_ORIGIN,
			);
			scheduleWriteBack();
		})();
	}, [doc, slides, isConnected, isSynced, getFactories, scheduleWriteBack]);

	// Reset per-session sync state whenever the Y.Doc identity changes (a
	// stop/restart or provider re-init hands us a new doc). Without this the
	// long-lived sync component keeps `hasInitializedRef`/`lastSyncedRef` from
	// the previous deck, so the late-joiner catch-up read never re-runs and the
	// dedupe could wrongly skip applying the new room's slides. Keyed on `doc`
	// (not the observer effect's cleanup) so unrelated config churn does not
	// clear the dedupe. Vue resets its `lastSynced` in stop() for the same
	// reason.
	useEffect(() => {
		hasInitializedRef.current = false;
		lastSyncedRef.current = '';
	}, [doc]);

	// Sync remote Y.Doc changes -> local state
	useEffect(() => {
		if (!isConnected || !doc) {
			return;
		}

		const handleChange = (_events?: unknown, transaction?: YTransactionLike) => {
			// Skip our own local-sync writes: the reconcile pass tags its
			// transaction with LOCAL_SYNC_ORIGIN, so echoing it back into React
			// state would be redundant (the JSON dedupe below is a secondary
			// guard for any untagged writes).
			if (transaction?.origin === LOCAL_SYNC_ORIGIN) {
				return;
			}
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
			// Clear synchronously (matching Vue): a `requestAnimationFrame` clear
			// is frozen in a backgrounded tab, leaving the flag stuck true so no
			// local edit reaches the doc until refocus. The `lastSyncedRef` JSON
			// dedupe already prevents the write effect from echoing this apply.
			isApplyingRemoteRef.current = false;
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
