/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure array-transformation operations (update/move/resize/delete/
 * duplicate + z-order) were extracted to `pptx-viewer-shared`
 * (`render/element-operations`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so `editor-state.service`,
 * the viewer barrel, the colocated tests, and any future importers are
 * unchanged.
 */

export {
	updateElementById,
	moveElementBy,
	setElementPosition,
	resizeElement,
	deleteElementsByIds,
	duplicateElementById,
	bringToFront,
	sendToBack,
	bringForward,
	sendBackward,
} from '../internal/shared';
