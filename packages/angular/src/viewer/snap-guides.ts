/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * The pure snap-and-alignment-guide geometry was consolidated into
 * `pptx-viewer-shared` (`render/snap-guides`), which carries the superset of
 * all three bindings' snap maths. Angular's closest-per-axis span-guide model
 * (`computeSnap` → `{ x, y, guides }` with `SnapBox`/`SnapGuide`/`SnapResult`)
 * and `snapToGridStep` come straight through here, so `SlideCanvasComponent`
 * and the colocated tests are unchanged.
 *
 * The pointer/drag driver (pointer events, live CSS transform, guide overlay
 * rendering, clearing on pointerup) stays in `SlideCanvasComponent`.
 */

export type { SnapBox, SnapGuide, SnapResult } from '../internal/shared';

export { computeGridSpacingPx, computeSnap, snapToGridStep } from '../internal/shared';
