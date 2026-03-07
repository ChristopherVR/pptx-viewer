/**
 * useContentLifecycle — Composes content loading, font injection,
 * serialisation, and autosave into a single hook.
 */
import { useEffect } from "react";
import type React from "react";

import type { PptxHandler, PptxSlide } from "pptx-viewer-core";
import type { ViewerState } from "./useViewerState";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";
import { useLoadContent } from "./useLoadContent";
import { useFontInjection } from "./useFontInjection";
import { useSerialize } from "./useSerialize";
import { useAutosave, type AutosaveStatus } from "./useAutosave";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseContentLifecycleInput {
  content: ArrayBuffer | Uint8Array | null;
  filePath: string | undefined;
  slides: PptxSlide[];
  state: ViewerState;
  history: EditorHistoryResult;
  ops: ElementOperations;
  actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
  setIsEncryptedDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
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

export function useContentLifecycle(
  input: UseContentLifecycleInput,
): ContentLifecycleResult {
  const {
    content,
    filePath,
    slides,
    state,
    history,
    ops,
    actionSoundHandlerRef,
    setIsEncryptedDialogOpen,
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
  });

  // Sync the shared handler ref for action sounds
  useEffect(() => {
    actionSoundHandlerRef.current = handlerRef.current;
  }, [handlerRef, actionSoundHandlerRef, state.loading]);

  useFontInjection({ embeddedFonts: state.embeddedFonts, slides });

  const serializeSlides = useSerialize({
    slides,
    activeSlideIndex: state.activeSlideIndex,
    guides: state.guides,
    headerFooter: state.headerFooter,
    presentationProperties: state.presentationProperties,
    customShows: state.customShows,
    sections: state.sections,
    coreProperties: state.coreProperties,
    appProperties: state.appProperties,
    customProperties: state.customProperties,
    notesMaster: state.notesMaster,
    handoutMaster: state.handoutMaster,
    handlerRef,
  });

  const { autosaveStatus } = useAutosave({
    isDirty: state.isDirty,
    filePath,
    serializeSlides,
  });

  return { handlerRef, serializeSlides, autosaveStatus };
}
