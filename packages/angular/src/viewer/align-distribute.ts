/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * The align/distribute geometry was consolidated into
 * `pptx-viewer-shared` (`render/element-align`), which now carries both the
 * inclusive `alignElements`/`distributeElements` (every element emitted) used
 * by Vue and the skip-unchanged `computeAlign`/`computeDistribute` variants
 * this binding has always used (entries omitted for elements already on the
 * target line). This shim preserves Angular's historical import surface so
 * `EditorStateService` and the colocated tests are unchanged.
 *
 * Naming note: shared aliases `AlignMode`/`DistributeMode`/`AlignBox`/
 * `PositionUpdate` to its canonical `AlignEdge`/`DistributeAxis`/
 * `BoundingBoxElement`/`ElementPosition` types; the Angular names come straight
 * through.
 */

export type { AlignMode, DistributeMode, AlignBox, PositionUpdate } from '../internal/shared';

export { computeAlign, computeDistribute } from '../internal/shared';
