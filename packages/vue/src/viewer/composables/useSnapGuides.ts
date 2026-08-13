/**
 * useSnapGuides.ts: the View-tab snap toggles, the transient snap lines and the
 * draggable alignment guides.
 *
 * Split out of `useElementDrag`, which owns the pointer gestures that CONSUME
 * this state; keeping the two together pushed that file past the repo's 300-LOC
 * budget and mixed "where may this element land" with "how is it being
 * dragged". The state is still surfaced through `useElementDrag`'s return, so
 * the ribbon wiring is unchanged.
 *
 * @module composables/useSnapGuides
 */
import { createEditorId } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

import { createGuide, moveGuide, removeGuide } from './guides';
import type { Guide } from './guides';

/** One transient red alignment line drawn while a snap is active. */
export interface SnapLine {
	axis: 'x' | 'y';
	position: number;
}

export interface UseSnapGuidesResult {
	/** View ▸ Snap to Shape: snap dragged elements to other elements' edges/centres. */
	snapToShape: Ref<boolean>;
	/** View ▸ Snap to Grid: round position + size to the grid during drag/resize. */
	snapToGrid: Ref<boolean>;
	/** Transient red snap-alignment lines shown during a snap-to-shape drag. */
	snapLines: Ref<SnapLine[]>;
	/** View ▸ H/V Guides: draggable alignment guides (authored slide px). */
	guides: Ref<Guide[]>;
	addGuide: (axis: 'h' | 'v', position?: number) => void;
	onMoveGuide: (payload: { id: string; position: number }) => void;
	onRemoveGuide: (id: string) => void;
}

export function useSnapGuides(
	canvasSize: Ref<{ width: number; height: number }>,
): UseSnapGuidesResult {
	const snapToShape = ref(false);
	const snapToGrid = ref(false);
	const snapLines = ref<SnapLine[]>([]);
	const guides = ref<Guide[]>([]);

	/**
	 * Add a horizontal/vertical guide. Centred by default (View ▸ H/V Guide
	 * buttons); `position` is supplied when the guide was dragged off a ruler
	 * strip, where the drop point has already been resolved by the shared
	 * `rulerDragToGuidePosition`.
	 */
	function addGuide(axis: 'h' | 'v', position?: number): void {
		const guide = createGuide(createEditorId('guide'), axis, canvasSize.value);
		guides.value = [...guides.value, position === undefined ? guide : { ...guide, position }];
	}
	/** Drag a guide to a new (clamped) position. */
	function onMoveGuide(payload: { id: string; position: number }): void {
		guides.value = moveGuide(guides.value, payload.id, payload.position, canvasSize.value);
	}
	/** Double-click removes a guide. */
	function onRemoveGuide(id: string): void {
		guides.value = removeGuide(guides.value, id);
	}

	return { snapToShape, snapToGrid, snapLines, guides, addGuide, onMoveGuide, onRemoveGuide };
}
