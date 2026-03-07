import { useRef, useState, useCallback, useEffect } from "react";

import type {
  PptxElement,
  PptxHeaderFooter,
  PptxSlide,
} from "../../core";
import type { CanvasSize, EditorHistorySnapshot } from "../types";
import {
  cloneHistorySnapshot,
  cloneSlide,
  cloneTemplateElementsBySlideId,
} from "../utils/clone";

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

export interface EditorHistoryInput {
  slides: PptxSlide[];
  canvasSize: CanvasSize;
  activeSlideIndex: number;
  templateElementsBySlideId: Record<string, PptxElement[]>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  editTemplateMode: boolean;
  headerFooter: PptxHeaderFooter;
  loading: boolean;
  error: string | null;
  hasActivePointerInteraction: () => boolean;
  pointerCommitNonce: number;
  // Setters for applying snapshots
  setSlides: (slides: PptxSlide[]) => void;
  setCanvasSize: (size: CanvasSize) => void;
  setActiveSlideIndex: (index: number) => void;
  setTemplateElementsBySlideId: (map: Record<string, PptxElement[]>) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setEditTemplateMode: (mode: boolean) => void;
  setHeaderFooter: (hf: PptxHeaderFooter) => void;
}

export interface EditorHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | undefined;
  redoLabel: string | undefined;
  handleUndo: () => void;
  handleRedo: () => void;
  resetHistory: () => void;
  markDirty: () => void;
  buildHistorySnapshot: (actionLabel?: string) => EditorHistorySnapshot;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY_ENTRIES = 120;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorHistory(
  input: EditorHistoryInput,
): EditorHistoryResult {
  const {
    slides,
    canvasSize,
    activeSlideIndex,
    templateElementsBySlideId,
    loading,
    error,
    hasActivePointerInteraction,
    pointerCommitNonce,
    setSlides,
    setCanvasSize,
    setActiveSlideIndex,
    setTemplateElementsBySlideId,
    setSelectedElementId,
    setSelectedElementIds,
  } = input;

  // -- Refs ---------------------------------------------------------------

  const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
  const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
  const lastHistorySnapshotRef = useRef<EditorHistorySnapshot | null>(null);
  const lastHistorySerializedRef = useRef<string>("");
  const isApplyingHistoryRef = useRef(false);
  const unlockHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // -- State --------------------------------------------------------------

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoLabel, setUndoLabel] = useState<string | undefined>(undefined);
  const [redoLabel, setRedoLabel] = useState<string | undefined>(undefined);
  const [_isDirty, setIsDirty] = useState(false);

  // -- Helpers ------------------------------------------------------------

  const updateHistoryAvailability = useCallback(() => {
    setCanUndo(historyPastRef.current.length > 0);
    setCanRedo(historyFutureRef.current.length > 0);
    const pastTop = historyPastRef.current[historyPastRef.current.length - 1];
    setUndoLabel(pastTop?.actionLabel);
    const futureTop =
      historyFutureRef.current[historyFutureRef.current.length - 1];
    setRedoLabel(futureTop?.actionLabel);
  }, []);

  const buildHistorySnapshot = useCallback(
    (actionLabel?: string): EditorHistorySnapshot => {
      return {
        width: canvasSize.width,
        height: canvasSize.height,
        activeSlideIndex,
        slides: slides.map(cloneSlide),
        templateElementsBySlideId: cloneTemplateElementsBySlideId(
          templateElementsBySlideId,
        ),
        ...(actionLabel ? { actionLabel } : {}),
      };
    },
    [activeSlideIndex, canvasSize, slides, templateElementsBySlideId],
  );

  const applyHistorySnapshot = useCallback(
    (snapshot: EditorHistorySnapshot) => {
      const maxSlideIndex = Math.max(snapshot.slides.length - 1, 0);
      setCanvasSize({
        width: snapshot.width,
        height: snapshot.height,
      });
      setSlides(snapshot.slides.map(cloneSlide));
      setTemplateElementsBySlideId(
        cloneTemplateElementsBySlideId(snapshot.templateElementsBySlideId),
      );
      setActiveSlideIndex(Math.min(snapshot.activeSlideIndex, maxSlideIndex));
      setSelectedElementIds([]);
      setSelectedElementId(null);
    },
    [
      setActiveSlideIndex,
      setCanvasSize,
      setSelectedElementId,
      setSelectedElementIds,
      setSlides,
      setTemplateElementsBySlideId,
    ],
  );

  const unlockHistoryTracking = useCallback(() => {
    if (unlockHistoryTimerRef.current) {
      clearTimeout(unlockHistoryTimerRef.current);
    }
    unlockHistoryTimerRef.current = setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty((previous) => (previous ? previous : true));
  }, []);

  // -- Stack navigation ---------------------------------------------------

  const handleUndo = useCallback(() => {
    const previousSnapshot = historyPastRef.current.pop();
    if (!previousSnapshot) return;

    const currentSnapshot = buildHistorySnapshot();
    historyFutureRef.current.push(currentSnapshot);
    isApplyingHistoryRef.current = true;
    const nextSnapshot = cloneHistorySnapshot(previousSnapshot);
    lastHistorySnapshotRef.current = cloneHistorySnapshot(nextSnapshot);
    lastHistorySerializedRef.current = JSON.stringify(nextSnapshot);
    applyHistorySnapshot(nextSnapshot);
    updateHistoryAvailability();
    unlockHistoryTracking();
    markDirty();
  }, [
    applyHistorySnapshot,
    buildHistorySnapshot,
    markDirty,
    unlockHistoryTracking,
    updateHistoryAvailability,
  ]);

  const handleRedo = useCallback(() => {
    const nextSnapshot = historyFutureRef.current.pop();
    if (!nextSnapshot) return;

    const currentSnapshot = buildHistorySnapshot();
    historyPastRef.current.push(currentSnapshot);
    isApplyingHistoryRef.current = true;
    const targetSnapshot = cloneHistorySnapshot(nextSnapshot);
    lastHistorySnapshotRef.current = cloneHistorySnapshot(targetSnapshot);
    lastHistorySerializedRef.current = JSON.stringify(targetSnapshot);
    applyHistorySnapshot(targetSnapshot);
    updateHistoryAvailability();
    unlockHistoryTracking();
    markDirty();
  }, [
    applyHistorySnapshot,
    buildHistorySnapshot,
    markDirty,
    unlockHistoryTracking,
    updateHistoryAvailability,
  ]);

  // -- Reset --------------------------------------------------------------

  const resetHistory = useCallback(
    (initialSnapshot?: EditorHistorySnapshot | null) => {
      historyPastRef.current = [];
      historyFutureRef.current = [];
      if (initialSnapshot) {
        const clonedInitial = cloneHistorySnapshot(initialSnapshot);
        lastHistorySnapshotRef.current = clonedInitial;
        lastHistorySerializedRef.current = JSON.stringify(clonedInitial);
      } else {
        lastHistorySnapshotRef.current = null;
        lastHistorySerializedRef.current = "";
      }
      updateHistoryAvailability();
    },
    [updateHistoryAvailability],
  );

  // -- Cleanup timer on unmount -------------------------------------------

  useEffect(() => {
    return () => {
      if (unlockHistoryTimerRef.current) {
        clearTimeout(unlockHistoryTimerRef.current);
        unlockHistoryTimerRef.current = null;
      }
    };
  }, []);

  // -- History tracking effect --------------------------------------------

  useEffect(() => {
    if (loading || error) return;
    if (isApplyingHistoryRef.current) return;
    if (hasActivePointerInteraction()) return;

    const snapshot = buildHistorySnapshot();
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastHistorySerializedRef.current) {
      return;
    }

    const previousSnapshot = lastHistorySnapshotRef.current;
    if (!previousSnapshot) {
      lastHistorySnapshotRef.current = cloneHistorySnapshot(snapshot);
      lastHistorySerializedRef.current = serialized;
      updateHistoryAvailability();
      return;
    }

    historyPastRef.current.push(cloneHistorySnapshot(previousSnapshot));
    if (historyPastRef.current.length > MAX_HISTORY_ENTRIES) {
      historyPastRef.current.shift();
    }
    historyFutureRef.current = [];
    lastHistorySnapshotRef.current = cloneHistorySnapshot(snapshot);
    lastHistorySerializedRef.current = serialized;
    updateHistoryAvailability();
  }, [
    buildHistorySnapshot,
    error,
    hasActivePointerInteraction,
    loading,
    pointerCommitNonce,
    updateHistoryAvailability,
  ]);

  // -- Public API ---------------------------------------------------------

  return {
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    handleUndo,
    handleRedo,
    resetHistory,
    markDirty,
    buildHistorySnapshot,
  };
}
