import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { filterInteractableIds, isTemplateElementId } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import { useConnectorReroute } from './connector-reroute-store';
import { setTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';

export interface UseNudgeSelectionInput {
	selectedElementIds: Ref<string[]>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	templateElementsBySlideId: Ref<TemplateElementMap>;
	pushHistory: () => void;
}

/**
 * The arrow-key nudge: move every selected, movable element by (dx, dy) px as
 * one history entry. Split out of `useEditorKeyboard.ts` to keep that file
 * under this repo's file-size limit.
 */
export function useNudgeSelection(input: UseNudgeSelectionInput): (dx: number, dy: number) => void {
	const { selectedElementIds, activeSlideIndex, slides, templateElementsBySlideId, pushHistory } =
		input;

	/** Recompute the connectors glued to shapes an arrow-key nudge just moved. */
	const rerouteConnectorsFor = useConnectorReroute({
		slides,
		activeSlideIndex,
		templateElementsBySlideId,
	});

	return function nudgeSelected(dx: number, dy: number): void {
		if (selectedElementIds.value.length === 0) {
			return;
		}
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		// `a:spLocks/@noMove` pins a shape, so the arrow keys must skip it exactly as
		// a drag does, and a multi-selection nudges only its movable members.
		const lookup = new Map<string, PptxElement>();
		for (const el of [...(templateElementsBySlideId.value[slide.id] ?? []), ...slide.elements]) {
			lookup.set(el.id, el);
		}
		const movableIds = filterInteractableIds(
			selectedElementIds.value,
			(id) => lookup.get(id),
			'move',
		);
		if (movableIds.length === 0) {
			return;
		}
		const ids = new Set(movableIds);
		// Partition into template ids (master-/layout- prefix) and normal slide ids so
		// the nudge routes through the correct store for each group. Without this split
		// a selected template element is silently skipped (it lives in the template
		// store, not in slide.elements) and the arrow-key move is lost.
		const templateIds = new Set([...ids].filter((id) => isTemplateElementId(id)));
		const slideIds = new Set([...ids].filter((id) => !isTemplateElementId(id)));
		pushHistory();
		if (templateIds.size > 0) {
			const current = templateElementsBySlideId.value[slide.id];
			if (current) {
				templateElementsBySlideId.value = setTemplateElements(
					templateElementsBySlideId.value,
					slide.id,
					current.map((el) =>
						templateIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
					),
				);
			}
		}
		if (slideIds.size > 0) {
			const nextSlides = slides.value.slice();
			nextSlides[index] = {
				...slide,
				elements: slide.elements.map((el) =>
					slideIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
				),
			};
			slides.value = nextSlides;
		}
		// The nudged shapes have landed: connectors glued to them follow, the same
		// as at the end of a pointer drag.
		rerouteConnectorsFor(ids);
	};
}
