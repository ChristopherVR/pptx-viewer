import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CollabLoadOrigin, CollaborationLivePatcher, DeckSaveState } from 'pptx-viewer-shared';
import { buildDeckSaveOptions } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';

import type { CollaborationContextValue } from './types';
import { useCollaborationLivePatch } from './useCollaborationLivePatch';
import { useYjsDocumentSync } from './useYjsDocumentSync';

export interface CollaborationDocumentSyncInput {
	collaboration: CollaborationContextValue | null;
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	content: ArrayBuffer | Uint8Array | null;
	loadVersion: number;
	loadOrigin: CollabLoadOrigin;
	livePatcher: CollaborationLivePatcher;
	deckSaveState: DeckSaveState;
	onReadOnlyChange?: (readOnly: boolean) => void;
}

/** Shared wiring for the bundled editor and custom toolbar/canvas hosts. */
export function useCollaborationDocumentSync(input: CollaborationDocumentSyncInput): void {
	const { collaboration, ...state } = input;
	const latest = useRef(input);
	latest.current = input;
	const getSourceBytes = useCallback(() => {
		const bytes = latest.current.content;
		return bytes instanceof Uint8Array ? bytes : bytes ? new Uint8Array(bytes) : null;
	}, []);
	const getSaveOptions = useCallback(() => buildDeckSaveOptions(latest.current.deckSaveState), []);
	const config = collaboration?.config;
	const doc = collaboration?.doc;
	const status = collaboration?.status;
	useEffect(() => {
		if (!config?.externalSession || !doc) {
			latest.current.onReadOnlyChange?.(
				config?.externalSession ? status !== 'error' : Boolean(doc) && config?.role === 'viewer',
			);
		}
	}, [doc, config?.externalSession, config?.role, status]);
	// The host can keep a synchronized document editable while offline.
	const isConnected = config?.externalSession
		? Boolean(collaboration?.doc)
		: collaboration?.status === 'connected';
	useYjsDocumentSync({
		...state,
		doc: collaboration?.doc ?? null,
		isConnected,
		isSynced: collaboration?.synced ?? false,
		config,
		livePatcher: state.livePatcher,
		getSourceBytes,
		getSaveOptions,
	});
	useCollaborationLivePatch({
		patcher: state.livePatcher,
		externalSession: config?.externalSession,
		doc: collaboration?.doc ?? null,
		isConnected: isConnected && config?.role !== 'viewer',
		isSynced: collaboration?.synced ?? false,
	});
}
