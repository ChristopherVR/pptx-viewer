/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Round-rect adjustment-handle math was consolidated into `pptx-viewer-shared`
 * (`render/shape-adjustment.ts`), shared by every binding. This shim preserves
 * the historical React import surface. The `ShapeAdjustmentDragState` /
 * `ShapeAdjustmentHandleDescriptor` types remain declared in `../types-core`
 * (structurally identical) for the broad set of React consumers that import
 * them from there.
 */
export {
	beginShapeAdjustment,
	clampShapeAdjustmentValue,
	getRoundRectAdjustmentValue,
	getRoundRectRadiusPx,
	getShapeAdjustmentHandleDescriptor,
	getShapeAdjustmentHandleDescriptors,
	getDraggedShapeAdjustmentValue,
	getDraggedShapeAdjustments,
} from 'pptx-viewer-shared';
