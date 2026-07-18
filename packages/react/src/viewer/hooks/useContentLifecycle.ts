import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
/**
 * useContentLifecycle: Composes content loading, font injection,
 * serialisation, and autosave into a single hook.
 */
import { useEffect } from 'react';
import type React from 'react';

import { useAutosave } from './useAutosave';
import type { AutosaveStatus } from './useAutosave';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import { useFontInjection } from './useFontInjection';
import { useLoadContent } from './useLoadContent';
import { useSerialize } from './useSerialize';
import type { ViewerState } from './useViewerState';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseContentLifecycleInput {
	content: ArrayBuffer | Uint8Array | null;
	filePath: string | undefined;
	/** AutoSave toggle state; when false the recovery autosave timer is off. */
	autosaveEnabled?: boolean;
	slides: PptxSlide[];
	state: ViewerState;
	history: EditorHistoryResult;
	ops: ElementOperations;
	actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
	setIsEncryptedDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
	password?: string;
	/** Forwarded to {@link useLoadContent}: fires after a parse applies. */
	onContentApplied?: () => void;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ContentLifecycleResult {
	handlerRef: React.RefObject<PptxHandler | null>;
	serializeSlides: () => Promise<Uint8Array | null>;
	autosaveStatus: AutosaveStatus;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContentLifecycle(input: UseContentLifecycleInput): ContentLifecycleResult {
	const {
		content,
		filePath,
		autosaveEnabled = true,
		slides,
		state,
		history,
		ops,
		actionSoundHandlerRef,
		setIsEncryptedDialogOpen,
		password,
		onContentApplied,
	} = input;

	const { handlerRef } = useLoadContent({
		content,
		clearSelection: ops.clearSelection,
		history,
		setSlides: state.setSlides,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		mediaDataUrls: state.mediaDataUrls,
		setCanvasSize: state.setCanvasSize,
		setHeaderFooter: state.setHeaderFooter,
		setLayoutOptions: state.setLayoutOptions,
		setSlideMasters: state.setSlideMasters,
		setTheme: state.setTheme,
		setTableStyleMap: state.setTableStyleMap,
		setThemeOptions: state.setThemeOptions,
		setCustomShows: state.setCustomShows,
		setSections: state.setSections,
		setPresentationProperties: state.setPresentationProperties,
		setNotesMaster: state.setNotesMaster,
		setHandoutMaster: state.setHandoutMaster,
		setNotesCanvasSize: state.setNotesCanvasSize,
		setCustomProperties: state.setCustomProperties,
		setTagCollections: state.setTagCollections,
		setCoreProperties: state.setCoreProperties,
		setAppProperties: state.setAppProperties,
		setEmbeddedFonts: state.setEmbeddedFonts,
		setActiveSlideIndex: state.setActiveSlideIndex,
		setHasMacros: state.setHasMacros,
		setHasDigitalSignatures: state.setHasDigitalSignatures,
		setDigitalSignatureCount: state.setDigitalSignatureCount,
		setGuides: state.setGuides,
		setLoading: state.setLoading,
		setError: state.setError,
		setIsDirty: state.setIsDirty,
		setIsEncrypted: setIsEncryptedDialogOpen,
		onContentApplied,
	});

	// Sync the shared handler ref for action sounds
	useEffect(() => {
		actionSoundHandlerRef.current = handlerRef.current;
	}, [handlerRef, actionSoundHandlerRef, state.loading]);

	useFontInjection({ embeddedFonts: state.embeddedFonts, slides });

	const serializeSlides = useSerialize({
		slides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		activeSlideIndex: state.activeSlideIndex,
		guides: state.guides,
		headerFooter: state.headerFooter,
		presentationProperties: state.presentationProperties,
		customShows: state.customShows,
		sections: state.sections,
		coreProperties: state.coreProperties,
		appProperties: state.appProperties,
		customProperties: state.customProperties,
		tagCollections: state.tagCollections,
		notesMaster: state.notesMaster,
		handoutMaster: state.handoutMaster,
		handlerRef,
		inlineEditingElementIdRef: state.inlineEditingElementIdRef,
		inlineEditingTextRef: state.inlineEditingTextRef,
		password,
	});

	const { autosaveStatus } = useAutosave({
		isDirty: state.isDirty,
		filePath,
		serializeSlides,
		enabled: autosaveEnabled,
	});

	return { handlerRef, serializeSlides, autosaveStatus };
}
