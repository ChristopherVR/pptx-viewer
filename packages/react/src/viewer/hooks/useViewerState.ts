/**
 * useViewerState — Barrel hook composing core + UI state.
 *
 * This is the top-level state hook for the PowerPoint Viewer. It delegates
 * to {@link useViewerCoreState} (slides, elements, refs, presentation data)
 * and {@link useViewerUIState} (panel toggles, drawing tools, grid/snap)
 * so each sub-hook stays under ~250 lines while presenting a single
 * unified API surface.
 *
 * @module useViewerState
 */
import { useViewerCoreState, type ViewerCoreState } from "./useViewerCoreState";
import { useViewerUIState, type ViewerUIState } from "./useViewerUIState";

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

/**
 * Input parameters for the {@link useViewerState} hook.
 *
 * @property content - Raw PPTX binary data, or null/undefined when no file is loaded.
 * @property canEdit - Whether the viewer should enable editing capabilities.
 */
export interface UseViewerStateInput {
  content: ArrayBuffer | Uint8Array | null | undefined;
  canEdit: boolean;
}

/**
 * The unified viewer state — intersection of core state (slides, elements,
 * refs, presentation metadata) and UI state (panel toggles, tools, grid/snap).
 */
export type ViewerState = ViewerCoreState & ViewerUIState;

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

/**
 * Composes core and UI state into a single unified state object.
 *
 * This hook is the entry point consumed by the main PowerPointViewer component.
 * It merges the results of two sub-hooks into one spread so downstream hooks
 * can accept a single `ViewerState` parameter.
 *
 * @param input - The binary content and edit-mode flag.
 * @returns The merged {@link ViewerState} containing every ref, state value, and setter.
 */
export function useViewerState(input: UseViewerStateInput): ViewerState {
  // Core state: slides, elements, selection, masters, theme, etc.
  const core = useViewerCoreState(input);
  // UI state: toolbar, panels, drawing tools, grid, snapping, etc.
  const ui = useViewerUIState();
  return { ...core, ...ui };
}
