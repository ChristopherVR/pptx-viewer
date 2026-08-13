/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Round-rect adjustment-handle math, its scalar constants, and the
 * handle/drag descriptor types were consolidated into `pptx-viewer-shared`
 * (`render/shape-adjustment.ts`), shared by every binding. This shim preserves
 * the historical Vue import surface so `SelectionOverlay.vue` and the colocated
 * tests keep importing the same names unchanged.
 */
export type { ShapeAdjustmentHandleDescriptor, ShapeAdjustmentDragState } from 'pptx-viewer-shared';
export {
	beginShapeAdjustment,
	getShapeAdjustmentHandleDescriptors,
	getDraggedShapeAdjustments,
	SHAPE_ADJUSTMENT_MIN,
	SHAPE_ADJUSTMENT_MAX,
	DEFAULT_ROUND_RECT_ADJUSTMENT,
	clampShapeAdjustmentValue,
	getRoundRectAdjustmentValue,
	getRoundRectRadiusPx,
	getShapeAdjustmentHandleDescriptor,
	getDraggedShapeAdjustmentValue,
} from 'pptx-viewer-shared';
