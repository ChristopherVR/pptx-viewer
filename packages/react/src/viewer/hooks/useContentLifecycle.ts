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
	/**
	 * Whether autosave actually runs: the resolved `active` from the shared
	 * `resolveAutosaveActivation` (host `autosave` prop as a ceiling, title-bar
	 * toggle as the preference inside it), not the raw toggle.
	 */
	autosaveEnabled?: boolean;
	/**
	 * The resolved cadence in milliseconds, from the shared
	 * `resolveAutosaveIntervalMs` (host `autosaveIntervalMs` prop > File >
	 * Options > Save AutoRecover cadence > 120s default).
	 */
	autosaveIntervalMs?: number;
	/**
	 * File > Fonts > "Embed fonts in the file". Forwarded to `useSerialize`, so
	 * turning it off actually strips the embedded font data on the next save.
	 */
	embedFonts?: boolean;
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
	/** Serialise for the user: honours "Encrypt with Password". */
	serializeSlides: () => Promise<Uint8Array | null>;
	/**
	 * Serialise for bytes the viewer reads back itself (autosave snapshot,
	 * re-serialise-then-reload). Always plaintext, so recovery - which has no
	 * password to offer - can actually open them.
	 */
	serializeForRecovery: () => Promise<Uint8Array | null>;
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
		autosaveIntervalMs,
		embedFonts = true,
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
		setSlideSizeEmu: state.setSlideSizeEmu,
		setHeaderFooter: state.setHeaderFooter,
		setLayoutOptions: state.setLayoutOptions,
		setSlideMasters: state.setSlideMasters,
		setTheme: state.setTheme,
		setTableStyleMap: state.setTableStyleMap,
		setThemeOptions: state.setThemeOptions,
		setCustomShows: state.setCustomShows,
		setActiveCustomShowId: state.setActiveCustomShowId,
		setSections: state.setSections,
		setPresentationProperties: state.setPresentationProperties,
		setViewProperties: state.setViewProperties,
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

	// Sync the shared handler ref for action sounds. `state.loading` is not read
	// in the body; it's a re-run trigger so the ref re-points to the freshly
	// loaded handler once loading finishes.
	useEffect(() => {
		actionSoundHandlerRef.current = handlerRef.current;
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- see comment above
	}, [handlerRef, actionSoundHandlerRef, state.loading]);

	useFontInjection({ embeddedFonts: state.embeddedFonts, slides });

	const serializeInput = {
		slides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		activeSlideIndex: state.activeSlideIndex,
		canvasSize: state.canvasSize,
		slideSizeEmu: state.slideSizeEmu,
		guides: state.guides,
		headerFooter: state.headerFooter,
		presentationProperties: state.presentationProperties,
		customShows: state.customShows,
		sections: state.sections,
		coreProperties: state.coreProperties,
		appProperties: state.appProperties,
		customProperties: state.customProperties,
		tagCollections: state.tagCollections,
		slideMasters: state.slideMasters,
		notesMaster: state.notesMaster,
		handoutMaster: state.handoutMaster,
		handlerRef,
		inlineEditingElementIdRef: state.inlineEditingElementIdRef,
		inlineEditingTextRef: state.inlineEditingTextRef,
		password,
		embedFonts,
	};

	const serializeSlides = useSerialize(serializeInput);

	// The same deck, serialised for the viewer's own eyes only. Autosave used to
	// reuse `serializeSlides`, so protecting a deck wrote an ENCRYPTED recovery
	// snapshot that recovery (which never has the password) could not reopen -
	// the crash-recovery data was destroyed the moment protection was enabled.
	const serializeForRecovery = useSerialize({ ...serializeInput, purpose: 'recovery-snapshot' });

	const { autosaveStatus } = useAutosave({
		isDirty: state.isDirty,
		filePath,
		serializeSlides: serializeForRecovery,
		enabled: autosaveEnabled,
		...(autosaveIntervalMs === undefined ? {} : { intervalMs: autosaveIntervalMs }),
		// Everything `serializeForRecovery` reads that changes by REASSIGNMENT,
		// so a poll that finds all of them unchanged can skip re-serializing a
		// deck it has already snapshotted. The two refs are read by `.current`
		// because an inline edit in progress lives there and nowhere else yet.
		getChangeSources: () => [
			slides,
			state.templateElementsBySlideId,
			state.guides,
			state.headerFooter,
			state.presentationProperties,
			state.customShows,
			state.sections,
			state.coreProperties,
			state.appProperties,
			state.customProperties,
			state.tagCollections,
			state.notesMaster,
			state.handoutMaster,
			state.embeddedFonts,
			embedFonts,
			password,
			state.inlineEditingElementIdRef.current,
			state.inlineEditingTextRef.current,
		],
	});

	return { handlerRef, serializeSlides, serializeForRecovery, autosaveStatus };
}
