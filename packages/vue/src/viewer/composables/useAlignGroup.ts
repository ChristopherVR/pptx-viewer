import { createEditorId } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	alignElements,
	canInteractWithElement,
	distributeElements,
	groupElements,
	isTemplateElementId,
	ungroupElements,
} from 'pptx-viewer-shared';
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface UseAlignGroupInput {
	selectedElements: ComputedRef<PptxElement[]>;
	selectedElementIds: Ref<string[]>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	pushHistory: () => void;
}

/**
 * useAlignGroup: multi-selection alignment / distribution and group / ungroup
 * for the Vue editor. Each change is a single history entry. Extracted verbatim
 * from `PowerPointViewer.vue`.
 */
export function useAlignGroup(input: UseAlignGroupInput) {
	const { selectedElements, selectedElementIds, activeSlideIndex, slides, pushHistory } = input;

	const canGroup = computed(
		() =>
			selectedElements.value.length >= 2 &&
			selectedElements.value.every((el) => canInteractWithElement(el, 'group')),
	);
	const canUngroup = computed(
		() =>
			selectedElements.value.length === 1 &&
			selectedElements.value[0]?.type === 'group' &&
			canInteractWithElement(selectedElements.value[0], 'group'),
	);
	const canDistribute = computed(() => selectedElements.value.length >= 3);
	/**
	 * Lock-only half of `canGroup`/`canUngroup`, with no selection-count or
	 * element-type condition. Drives the context menu's Group/Ungroup disabled
	 * state (`context-menu-commands.ts`'s `selectionGroupable`), which needs to
	 * disable Ungroup on a locked SINGLE group, where `canGroup` alone would
	 * read false purely for having fewer than two selected elements.
	 */
	const selectionGroupable = computed(() =>
		selectedElements.value.every((el) => canInteractWithElement(el, 'group')),
	);

	/** Apply a {id → {x?,y?}} position map to the active slide as one history entry. */
	function applyPositionMap(map: Map<string, { x?: number; y?: number }>): void {
		if (map.size === 0) {
			return;
		}
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextElements = slide.elements.map((el) => {
			const pos = map.get(el.id);
			if (!pos) {
				return el;
			}
			return {
				...el,
				...(pos.x === undefined ? {} : { x: pos.x }),
				...(pos.y === undefined ? {} : { y: pos.y }),
			};
		});
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements: nextElements };
		slides.value = nextSlides;
	}
	function onAlign(edge: AlignEdge): void {
		applyPositionMap(alignElements(selectedElements.value, edge));
	}
	function onDistribute(axis: DistributeAxis): void {
		applyPositionMap(distributeElements(selectedElements.value, axis));
	}
	function onGroup(): void {
		const sel = selectedElements.value;
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (sel.length < 2 || !slide) {
			return;
		}
		// G10: a:spLocks/@noGrouping rejects the whole attempt if it involves a
		// locked shape, not just that one shape.
		if (!sel.every((el) => canInteractWithElement(el, 'group'))) {
			return;
		}
		const { elements, groupId } = groupElements(
			slide.elements,
			sel.map((e) => e.id),
			createEditorId('grp'),
		);
		if (groupId === null) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements };
		slides.value = nextSlides;
		selectedElementIds.value = [groupId];
	}
	function onUngroup(): void {
		const g = selectedElements.value[0];
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!g || g.type !== 'group' || !slide) {
			return;
		}
		// G10: a:grpSpLocks/@noGrouping forbids ungrouping this specific group.
		if (!canInteractWithElement(g, 'group')) {
			return;
		}
		// Keep the existing child ids (pass them through as the new ids). The
		// shared op still re-ids a promoted NESTED group's descendants when they
		// route to the other (template vs slide) store, which no binding did.
		const childIds = (g.children ?? []).map((c) => c.id);
		const { elements, childIds: appliedIds } = ungroupElements(slide.elements, g.id, childIds, {
			intoTemplate: isTemplateElementId(g.id),
		});
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements };
		slides.value = nextSlides;
		selectedElementIds.value = appliedIds;
	}

	return {
		canGroup,
		canUngroup,
		canDistribute,
		selectionGroupable,
		onAlign,
		onDistribute,
		onGroup,
		onUngroup,
	};
}
