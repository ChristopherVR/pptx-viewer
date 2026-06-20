/**
 * table-selection-utils.ts: thin re-export shim.
 *
 * Table cell selection helpers now live in `pptx-viewer-shared`
 * (`render/table-merge.ts`). Re-exported here so existing imports keep working.
 */
export { computeSelectionRect, rectToCells, isCellInRect } from 'pptx-viewer-shared';
