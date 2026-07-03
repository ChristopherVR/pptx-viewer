import { createEditorId } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	alignElements,
	distributeElements,
	groupElements,
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

	const canGroup = computed(() => selectedElements.value.length >= 2);
	const canUngroup = computed(
		() => selectedElements.value.length === 1 && selectedElements.value[0]?.type === 'group',
	);
	const canDistribute = computed(() => selectedElements.value.length >= 3);

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
		// Keep the existing child ids (pass them through as the new ids).
		const childIds = (g.children ?? []).map((c) => c.id);
		const { elements, childIds: appliedIds } = ungroupElements(slide.elements, g.id, childIds);
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements };
		slides.value = nextSlides;
		selectedElementIds.value = appliedIds;
	}

	return { canGroup, canUngroup, canDistribute, onAlign, onDistribute, onGroup, onUngroup };
}
