import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import type {
	EditPointsElementPatch,
	FreeformToolKind,
	ResolvedCustomization,
} from 'pptx-viewer-shared';
import { canEditElementPoints, isEditPointsEnabled } from 'pptx-viewer-shared';
import { inject, provide, ref } from 'vue';
import type { InjectionKey, Ref } from 'vue';

/**
 * The two outline-authoring modes (Edit Points on one shape, and the armed
 * Freeform: Shape / Curve drawing tool) as one viewer-scoped store. At most one
 * is active: arming a tool ends Edit Points and starting Edit Points disarms
 * the tool. Provided by `PowerPointViewer` and injected by the ribbon buttons
 * and the stage overlay, so no prop is threaded through the ribbon.
 */
export interface OutlineAuthoringStore {
	/** The shape in Edit Points mode, or null. */
	editPointsElementId: Ref<string | null>;
	/** The armed drawing tool, or null. */
	activeFreeformTool: Ref<FreeformToolKind | null>;
	/** Start Edit Points on `element` (no-op when locked or unsupported). */
	startEditPoints: (element: PptxElement | undefined) => void;
	exitEditPoints: () => void;
	/** Arm (or, with null, disarm) a drawing tool. */
	armFreeformTool: (tool: FreeformToolKind | null) => void;
	/** Apply one Edit Points edit (one undo step). */
	commitEditPoints: (elementId: string, patch: EditPointsElementPatch) => void;
	/** Insert a drawn freeform (selected) and disarm the tool. */
	commitFreeform: (shape: ShapePptxElement) => void;
}

export interface OutlineAuthoringOps {
	updateElement: (elementId: string, updates: Partial<PptxElement>) => void;
	addElement: (element: PptxElement) => void;
}

export const OutlineAuthoringKey: InjectionKey<OutlineAuthoringStore> =
	Symbol('pptx-outline-authoring');

/** Build the store over the editor's update / insert paths (no provide). */
export function createOutlineAuthoringStore(
	ops: OutlineAuthoringOps,
	enabled: () => boolean = () => true,
): OutlineAuthoringStore {
	const editPointsElementId = ref<string | null>(null);
	const activeFreeformTool = ref<FreeformToolKind | null>(null);
	return {
		editPointsElementId,
		activeFreeformTool,
		startEditPoints: (element) => {
			if (!enabled() || !element || !canEditElementPoints(element)) {
				return;
			}
			activeFreeformTool.value = null;
			editPointsElementId.value = element.id;
		},
		exitEditPoints: () => {
			editPointsElementId.value = null;
		},
		armFreeformTool: (tool) => {
			activeFreeformTool.value = tool;
			if (tool) {
				editPointsElementId.value = null;
			}
		},
		commitEditPoints: (elementId, patch) => ops.updateElement(elementId, patch),
		commitFreeform: (shape) => {
			activeFreeformTool.value = null;
			ops.addElement(shape);
		},
	};
}

/** Create the store, gated on the host's customisation, and provide it. */
export function provideOutlineAuthoring(
	ops: OutlineAuthoringOps,
	customization: () => ResolvedCustomization,
): OutlineAuthoringStore {
	const store = createOutlineAuthoringStore(ops, () => isEditPointsEnabled(customization()));
	provide(OutlineAuthoringKey, store);
	return store;
}

/** The viewer's store, or null when rendered outside `PowerPointViewer`. */
export function useOutlineAuthoring(): OutlineAuthoringStore | null {
	return inject(OutlineAuthoringKey, null);
}
