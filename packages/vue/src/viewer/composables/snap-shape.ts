/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The snap-to-shape alignment maths (View ▸ Snap to Shape) was consolidated
 * into `pptx-viewer-shared` (`render/snap-guides`). This shim preserves the
 * historical Vue import surface so `PowerPointViewer.vue` and the colocated
 * test are unchanged.
 *
 * Naming note: shared calls the return type `SnapToShapeResult` (its
 * `SnapResult` is the Angular span-guide model); it is aliased back to Vue's
 * `SnapResult` here. `computeSnapToShape` accepts Vue's `Guide[]` structurally
 * via shared's `SnapGuideInput`.
 */

export { computeSnapToShape, SNAP_THRESHOLD } from 'pptx-viewer-shared';

export type { SnapSibling, SnapLine, SnapToShapeResult as SnapResult } from 'pptx-viewer-shared';
