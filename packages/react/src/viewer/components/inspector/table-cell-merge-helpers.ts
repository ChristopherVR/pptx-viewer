/**
 * table-cell-merge-helpers.ts: thin re-export shim.
 *
 * The cursor-anchored cell merge / split math now lives in `pptx-viewer-shared`
 * (`render/table-cell-merge.ts`) so React, Vue and Angular share one copy. This
 * module preserves the original public symbol surface so colocated consumers
 * (and their tests) keep importing the same names.
 */
export { computeMergeCellRight, computeMergeCellDown, computeSplitCell } from 'pptx-viewer-shared';
