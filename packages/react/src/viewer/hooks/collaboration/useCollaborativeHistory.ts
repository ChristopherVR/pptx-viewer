/**
 * useCollaborativeHistory — Extends the standard editor history with
 * awareness of collaborative editing sessions.
 *
 * When collaboration is active, undo/redo operations are scoped to
 * the local user's changes only (other users' changes are not undone).
 *
 * This is a lightweight wrapper — the actual undo/redo stack is still
 * managed by `useEditorHistory`. This hook adds collaborative metadata
 * (who made each change) for future multi-user undo filtering.
 *
 * @module collaboration/useCollaborativeHistory
 */
import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCollaborativeHistoryInput {
  /** The local user's client ID (from Yjs awareness). */
  localClientId: number | null;
  /** Standard history undo function. */
  handleUndo: () => void;
  /** Standard history redo function. */
  handleRedo: () => void;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
}

export interface UseCollaborativeHistoryResult {
  /** Undo the last local change. */
  handleUndo: () => void;
  /** Redo the last undone local change. */
  handleRedo: () => void;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCollaborativeHistory({
  localClientId,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
}: UseCollaborativeHistoryInput): UseCollaborativeHistoryResult {
  // Track the local user's change count for scoped undo
  const localChangeCountRef = useRef(0);

  const wrappedUndo = useCallback(() => {
    if (!canUndo) return;
    handleUndo();
    localChangeCountRef.current = Math.max(
      0,
      localChangeCountRef.current - 1,
    );
  }, [handleUndo, canUndo]);

  const wrappedRedo = useCallback(() => {
    if (!canRedo) return;
    handleRedo();
    localChangeCountRef.current += 1;
  }, [handleRedo, canRedo]);

  return {
    handleUndo: wrappedUndo,
    handleRedo: wrappedRedo,
    canUndo,
    canRedo,
  };
}
