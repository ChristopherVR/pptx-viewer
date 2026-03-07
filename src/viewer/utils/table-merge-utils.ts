/**
 * Barrel re-export - table merge/split utilities.
 *
 * Implementation split into:
 * - `table-merge-core` (types, merge/split operations)
 * - `table-selection-utils` (selection helpers)
 */
export type { CellCoord, CellRect } from "./table-merge-core";

export {
  computeBoundingRect,
  expandRectForExistingMerges,
  canMergeCells,
  canSplitCell,
  mergeCells,
  splitCell,
} from "./table-merge-core";

export {
  computeSelectionRect,
  rectToCells,
  isCellInRect,
} from "./table-selection-utils";
