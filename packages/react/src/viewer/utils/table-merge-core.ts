/**
 * table-merge-core.ts: thin re-export shim.
 *
 * The cell merge / split / bounding-rect math now lives in
 * `pptx-viewer-shared` (`render/table-merge.ts`) so React, Vue and Angular
 * share one copy. This module preserves the original public symbol surface so
 * colocated consumers (and their tests) keep importing the same names.
 */
export type { CellCoord, CellRect } from 'pptx-viewer-shared';

export {
	computeBoundingRect,
	expandRectForExistingMerges,
	canMergeCells,
	canSplitCell,
	mergeCells,
	splitCell,
} from 'pptx-viewer-shared';
