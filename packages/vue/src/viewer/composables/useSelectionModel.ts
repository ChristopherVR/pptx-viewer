/**
 * useSelectionModel: which elements are selected, and how an id is resolved
 * across the TWO element stores the editor keeps.
 *
 * Slide content lives in `slides[i].elements`; the master/layout shapes a slide
 * inherits live in a separate `templateElementsBySlideId` layer keyed by slide
 * id and carrying `layout-`/`master-` prefixed ids. Every lookup here has to
 * consult both, which is why selection, resolution and the re-merged slide list
 * belong together rather than in three composables.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { isTemplateElementId } from 'pptx-viewer-shared';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { computed, ref } from 'vue';

import { buildSaveSlides, isElementIdInteractive } from './template-editing';
import type { TemplateElementMap } from './template-editing';

export interface UseSelectionModelOptions {
	slides: ShallowRef<PptxSlide[]>;
	templateElementsBySlideId: ShallowRef<TemplateElementMap>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
}

export interface UseSelectionModelResult {
	selectedElementIds: Ref<string[]>;
	/**
	 * View > Templates: when on, the master/layout shapes a slide inherits become
	 * selectable, draggable and editable on the canvas instead of being
	 * interaction-locked. Editing one mutates the shared template part, so all
	 * slides inheriting it change together.
	 */
	editTemplateMode: Ref<boolean>;
	hasSelection: ComputedRef<boolean>;
	/** The active slide's separate template (master/layout) element layer. */
	activeTemplateElements: ComputedRef<PptxElement[]>;
	/** Resolve an element by id across both stores (template ids first). */
	findActiveElement: (id: string) => PptxElement | undefined;
	selectedElements: ComputedRef<PptxElement[]>;
	/**
	 * Extent highlighted on the ruler strips: PowerPoint shades the selected
	 * shape's span on both rulers. Single selection only, matching React/Svelte.
	 */
	rulerSelectedBounds: ComputedRef<{ x: number; y: number; width: number; height: number } | null>;
	/**
	 * Slides re-merged with their template layer behind the slide content. The
	 * editable canvas renders the partitioned `slides` + the template layer
	 * separately; every other VISUAL surface (thumbnail rail, sorter,
	 * presentation, off-screen export stage) renders these merged slides so the
	 * inherited master/layout decorations still appear, matching the saved file.
	 */
	mergedSlides: ComputedRef<PptxSlide[]>;
	mergedSlideById: ComputedRef<Map<string, PptxSlide>>;
	selectElement: (id: string, additive: boolean) => void;
	clearSelection: () => void;
	/**
	 * Whether an element id may be selected / dragged / edited right now.
	 * Template-owned ids are interaction-locked outside `editTemplateMode`, and
	 * this reads the CURRENT mode, so callers cannot capture a stale answer.
	 */
	isInteractive: (id: string) => boolean;
}

export function useSelectionModel(options: UseSelectionModelOptions): UseSelectionModelResult {
	const { slides, templateElementsBySlideId, activeSlide } = options;

	const selectedElementIds = ref<string[]>([]);
	const editTemplateMode = ref(false);
	const hasSelection = computed(() => selectedElementIds.value.length > 0);

	const activeTemplateElements = computed<PptxElement[]>(
		() => templateElementsBySlideId.value[activeSlide.value?.id ?? ''] ?? [],
	);

	function findActiveElement(id: string): PptxElement | undefined {
		if (isTemplateElementId(id)) {
			return activeTemplateElements.value.find((el) => el.id === id);
		}
		return activeSlide.value?.elements.find((el) => el.id === id);
	}

	const selectedElements = computed<PptxElement[]>(() => {
		const ids = new Set(selectedElementIds.value);
		const slideHits = (activeSlide.value?.elements ?? []).filter((el) => ids.has(el.id));
		const templateHits = activeTemplateElements.value.filter((el) => ids.has(el.id));
		return [...templateHits, ...slideHits];
	});

	const rulerSelectedBounds = computed(() => {
		const el = selectedElements.value.length === 1 ? selectedElements.value[0] : undefined;
		return el ? { x: el.x, y: el.y, width: el.width, height: el.height } : null;
	});

	const mergedSlides = computed<PptxSlide[]>(() =>
		buildSaveSlides(slides.value, templateElementsBySlideId.value),
	);
	const mergedSlideById = computed(() => new Map(mergedSlides.value.map((s) => [s.id, s])));

	function selectElement(id: string, additive: boolean): void {
		if (additive) {
			selectedElementIds.value = selectedElementIds.value.includes(id)
				? selectedElementIds.value.filter((x) => x !== id)
				: [...selectedElementIds.value, id];
		} else {
			selectedElementIds.value = [id];
		}
	}

	function clearSelection(): void {
		selectedElementIds.value = [];
	}

	return {
		selectedElementIds,
		editTemplateMode,
		hasSelection,
		activeTemplateElements,
		findActiveElement,
		selectedElements,
		rulerSelectedBounds,
		mergedSlides,
		mergedSlideById,
		selectElement,
		clearSelection,
		isInteractive: (id) => isElementIdInteractive(id, editTemplateMode.value),
	};
}
