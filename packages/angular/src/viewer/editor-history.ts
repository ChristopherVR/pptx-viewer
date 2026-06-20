/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The generic `EditorHistory<T>` undo/redo command stack was extracted to
 * `pptx-viewer-shared` (`render/editor-history`) and is consumed by every
 * binding. This shim preserves the historical Angular import surface so
 * `editor-state.service`, the viewer barrel, the colocated test, and any
 * future importers are unchanged.
 */

export { EditorHistory } from '../internal/shared';
export type { EditorHistoryOptions, UndoRedoResult } from '../internal/shared';
