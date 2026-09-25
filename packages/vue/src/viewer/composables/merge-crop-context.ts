/**
 * The Merge Shapes + picture Crop controller, handed to the ribbon's Arrange
 * group and to the canvas overlays through provide/inject.
 *
 * Both controls need the ordered selection, the history stack and the live
 * slide list, none of which the flat `RibbonProps` contract carries; threading
 * them through the four ribbon-props files (all already at the size budget)
 * would add a dozen fields for two buttons. A missing provider (isolated unit
 * tests of a ribbon section) simply renders both controls disabled.
 */
import type { MergeShapeOperation, PptxElement } from 'pptx-viewer-core';
import type { CropElementUpdate, NaturalImageSize } from 'pptx-viewer-shared';
import type { ComputedRef, InjectionKey } from 'vue';

/** Merge Shapes: the ribbon dropdown and the context-menu entries. */
export interface MergeShapesController {
	/** Editable deck and two or more mergeable shapes selected. */
	canMerge: ComputedRef<boolean>;
	/** Run `op` over the selection (in selection order) as one undo step. */
	merge: (op: MergeShapeOperation) => void;
}

/** On-canvas picture crop mode. */
export interface PictureCropController {
	/** Editable deck and a single croppable picture selected. */
	canCrop: ComputedRef<boolean>;
	/** Whether crop mode is active. */
	cropActive: ComputedRef<boolean>;
	/** The picture being cropped (live), or null outside crop mode. */
	cropElement: ComputedRef<PptxElement | null>;
	/** The image source the picture renders, for the overlay's ghost. */
	cropImageSrc: ComputedRef<string | undefined>;
	/** Enter crop mode on `id` (defaults to the single selected picture). */
	enterCrop: (id?: string) => void;
	/** Ribbon Crop button: enter, or commit when already cropping. */
	toggleCrop: () => void;
	/** Commit the session (one undo step when anything changed). */
	commitCrop: () => void;
	/** Cancel the session, restoring the pre-crop picture with no undo step. */
	cancelCrop: () => void;
	/** Apply a live (history-free) update to the picture being cropped. */
	applyLive: (update: CropElementUpdate) => void;
	/** Crop to Aspect Ratio, Fill and Fit (one undoable update each). */
	applyAspect: (presetId: string) => void;
	applyFill: () => void;
	applyFit: () => void;
}

export type MergeCropController = MergeShapesController & PictureCropController;

export const MergeCropKey: InjectionKey<MergeCropController> = Symbol('pptx-vue-merge-crop');

/** The `<img>` natural size of a rendered picture, when it is cheaply available. */
export function readNaturalImageSize(elementId: string): NaturalImageSize | undefined {
	if (typeof document === 'undefined') {
		return undefined;
	}
	const safeId =
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(elementId)
			: elementId.replace(/["\\]/g, '\\$&');
	const img = document.querySelector<HTMLImageElement>(`[data-element-id="${safeId}"] img`);
	if (!img || !img.naturalWidth || !img.naturalHeight) {
		return undefined;
	}
	return { width: img.naturalWidth, height: img.naturalHeight };
}
