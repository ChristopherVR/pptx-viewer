/**
 * useViewerState — Barrel hook composing core + UI state.
 *
 * Delegates to useViewerCoreState and useViewerUIState so each stays
 * under ~250 lines while presenting a single unified API.
 */
import { useViewerCoreState, type ViewerCoreState } from "./useViewerCoreState";
import { useViewerUIState, type ViewerUIState } from "./useViewerUIState";

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseViewerStateInput {
  content: ArrayBuffer | Uint8Array | null | undefined;
  canEdit: boolean;
}

export type ViewerState = ViewerCoreState & ViewerUIState;

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useViewerState(input: UseViewerStateInput): ViewerState {
  const core = useViewerCoreState(input);
  const ui = useViewerUIState();
  return { ...core, ...ui };
}
