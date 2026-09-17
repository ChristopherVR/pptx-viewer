/** Synchronize viewer slides with the shared granular Yjs slide schema. */
import type { PptxElement, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	YjsFactories,
	YTransactionLike,
} from 'pptx-viewer-shared';
import {
	reconcileSlidesInYDoc,
	LOCAL_SYNC_ORIGIN,
	readSlidesFromYDoc,
	observeYDocSlides,
	shouldRoomSlidesReplaceLoad,
} from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';
import type { Doc as YDoc } from 'yjs';

import { useCollaborationWriteBack } from './useCollaborationWriteBack';

export interface UseYjsDocumentSyncInput {
	/** The live document, or null when not collaborating. */
	doc: YDoc | null;
	slides: PptxSlide[];
	/** Separated template elements, merged back on write-back. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	/** Built-in connection status, or presence of a host-owned session. */
	isConnected: boolean;
	/** Local writes wait for initial sync. External hosts control this explicitly. */
	isSynced?: boolean;
	config?: Pick<
		CollaborationConfig,
		'role' | 'onWriteBack' | 'writeBackDebounceMs' | 'externalSession' | 'sessionIntent'
	>;
	/** Original PPTX bytes used by the elected writer to preserve package data. */
	getSourceBytes?: () => Uint8Array | null;
	/** Include session-level edits outside the slides in durable snapshots. */
	getSaveOptions?: () => PptxHandlerSaveOptions;
	/** Bumped after each parsed deck is applied to viewer state. */
	loadVersion?: number;
	/** Bootstrap content yields to the room; explicit File > Open replaces it. */
	loadOrigin?: CollabLoadOrigin;
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
	getSaveOptions,
	loadVersion = 0,
	loadOrigin = 'user',
}: UseYjsDocumentSyncInput): void {
	const external = Boolean(config?.externalSession);
	const sessionIntent = useRef(config?.sessionIntent);
	sessionIntent.current = config?.sessionIntent;
	const lastSynced = useRef('');
	const initialized = useRef(false);
	const established = useRef(false);
	const awaitingJoin = useRef(false);
	const lastLoadVersion = useRef(loadVersion);
	const latestSlides = useRef(slides);
	latestSlides.current = slides;
	// Adoption schedules React state. Do not publish the superseded render
	// while it is pending; subsequent immutable local edits remain writable.
	const supersededSlides = useRef<PptxSlide[] | null>(null);
	const writeRevision = useRef(0);
	const factories = useRef<YjsFactories | null>(null);
	const scheduleWriteBack = useCollaborationWriteBack({
		doc,
		config,
		isSynced,
		getSourceBytes,
		getSaveOptions,
		templateElementsBySlideId,
	});
	const getFactories = useCallback(async (): Promise<YjsFactories> => {
		if (!factories.current) {
			const Y = await import('yjs');
			factories.current = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};
		}
		return factories.current;
	}, []);

	// Reset before either observer adoption or outbound writes for a new room.
	useEffect(() => {
		initialized.current = false;
		established.current = false;
		lastSynced.current = '';
		supersededSlides.current = null;
		awaitingJoin.current = Boolean(doc) && external && sessionIntent.current === 'join';
		writeRevision.current += 1;
	}, [doc, external]);

	const adopt = useCallback(
		(remoteSlides: PptxSlide[]) => {
			lastSynced.current = JSON.stringify(remoteSlides);
			supersededSlides.current = latestSlides.current;
			writeRevision.current += 1;
			awaitingJoin.current = false;
			established.current = true;
			setSlides(remoteSlides);
		},
		[setSlides],
	);

	// Observe and adopt BEFORE local writes. An already synchronized host
	// document must never be replaced with the local bootstrap deck.
	useEffect(() => {
		if (!doc || !isConnected) {
			return;
		}
		if (external && !isSynced) {
			initialized.current = false;
			return;
		}
		const handleChange = (_events?: unknown, transaction?: YTransactionLike): void => {
			if (transaction?.origin === LOCAL_SYNC_ORIGIN) {
				return;
			}
			const remoteSlides = readSlidesFromYDoc(doc);
			// After adoption, deleting the last slide must also propagate.
			if (
				remoteSlides.length === 0 &&
				(!external || awaitingJoin.current || !initialized.current)
			) {
				return;
			}
			if (JSON.stringify(remoteSlides) === lastSynced.current) {
				return;
			}
			adopt(remoteSlides);
			scheduleWriteBack();
		};
		const unobserve = observeYDocSlides(doc, handleChange);
		if (!initialized.current) {
			const remoteSlides = readSlidesFromYDoc(doc);
			if (remoteSlides.length > 0 || (external && established.current)) {
				adopt(remoteSlides);
			}
			initialized.current = true;
		}
		return unobserve;
	}, [doc, isConnected, isSynced, external, adopt, scheduleWriteBack]);

	// A late bootstrap parse yields to the room. Explicit File > Open clears
	// only the initial join latch and intentionally replaces the shared slides.
	useEffect(() => {
		if (loadVersion === lastLoadVersion.current) {
			return;
		}
		lastLoadVersion.current = loadVersion;
		if (loadOrigin === 'user') {
			awaitingJoin.current = false;
		}
		if (!doc || !isConnected || (external && !isSynced)) {
			return;
		}
		const roomSlides = readSlidesFromYDoc(doc);
		if (shouldRoomSlidesReplaceLoad(loadOrigin, roomSlides.length)) {
			adopt(roomSlides);
		}
	}, [loadVersion, loadOrigin, doc, isConnected, isSynced, external, adopt]);

	useEffect(() => {
		if (
			!doc ||
			!isConnected ||
			!isSynced ||
			config?.role === 'viewer' ||
			awaitingJoin.current ||
			slides === supersededSlides.current ||
			(!external && slides.length === 0)
		) {
			return;
		}
		const serialized = JSON.stringify(slides);
		if (serialized === lastSynced.current) {
			return;
		}
		const revision = writeRevision.current;
		let cancelled = false;
		void (async () => {
			const availableFactories = await getFactories();
			// A remote transaction or replaced session may arrive during import.
			if (
				cancelled ||
				revision !== writeRevision.current ||
				loadVersion !== lastLoadVersion.current
			) {
				return;
			}
			reconcileSlidesInYDoc(slides, doc, availableFactories, LOCAL_SYNC_ORIGIN);
			established.current = true;
			lastSynced.current = serialized;
			scheduleWriteBack();
		})();
		return () => {
			cancelled = true;
		};
	}, [
		doc,
		slides,
		isConnected,
		isSynced,
		external,
		config?.role,
		getFactories,
		scheduleWriteBack,
		loadVersion,
	]);
}
