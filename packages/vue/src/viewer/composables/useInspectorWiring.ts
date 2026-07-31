/**
 * useInspectorWiring: what the right-hand property inspector sees, and where
 * its patches are written back to.
 *
 * The routing here is the whole point: animations are stored on the SLIDE
 * (`slide.animations`, keyed by `elementId`), not on the element, so the
 * inspector is handed an augmented element on the way in and an `animations`
 * patch is split back out to the slide on the way out. Getting that wrong
 * silently writes an `animations` array onto the element where nothing reads it.
 *
 * The motion-path overlay reads the same slide-level animation entry, so it
 * lives here too rather than duplicating the lookup.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { motionPathFor, setMotionPath } from 'pptx-viewer-shared';
import type { ComputedRef, ShallowRef, Ref } from 'vue';
import { computed } from 'vue';

import { mergeElementAnimations, replaceSlideAnimations } from './animation-persistence';

export interface UseInspectorWiringOptions {
	slides: ShallowRef<PptxSlide[]>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	selectedElements: ComputedRef<PptxElement[]>;
	pushHistory: () => void;
	updateElement: (id: string, patch: Partial<PptxElement>) => void;
}

export interface UseInspectorWiringResult {
	/** The single selected element the inspector targets; multi-select hides it. */
	inspectorElement: ComputedRef<PptxElement | undefined>;
	/** `inspectorElement` augmented with this element's slide-level animations. */
	inspectorElementForPanels: ComputedRef<PptxElement | undefined>;
	onInspectorUpdate: (patch: Partial<PptxElement>) => void;
	writeSlideAnimations: (animations: PptxSlide['animations']) => void;
	/** The selected element's motion path, when it has one. */
	selectedMotionPath: ComputedRef<string | undefined>;
	/** Commit a path retargeted by dragging its end handle on the canvas. */
	onMotionPathChange: (path: string) => void;
}

export function useInspectorWiring(options: UseInspectorWiringOptions): UseInspectorWiringResult {
	const { slides, activeSlide, activeSlideIndex, selectedElements, pushHistory } = options;

	const inspectorElement = computed<PptxElement | undefined>(() =>
		selectedElements.value.length === 1 ? selectedElements.value[0] : undefined,
	);

	const inspectorElementForPanels = computed<PptxElement | undefined>(() => {
		const el = inspectorElement.value;
		if (!el) {
			return undefined;
		}
		const animations = (activeSlide.value?.animations ?? []).filter((a) => a.elementId === el.id);
		return { ...el, animations } as unknown as PptxElement;
	});

	function writeElementAnimations(elementId: string, animations: PptxSlide['animations']): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = mergeElementAnimations(slide, elementId, animations ?? []);
		slides.value = nextSlides;
	}

	function writeSlideAnimations(animations: PptxSlide['animations']): void {
		const index = activeSlideIndex.value;
		if (!slides.value[index]) {
			return;
		}
		pushHistory();
		slides.value = replaceSlideAnimations(slides.value, index, animations ?? []);
	}

	function onInspectorUpdate(patch: Partial<PptxElement>): void {
		const el = inspectorElement.value;
		if (!el) {
			return;
		}
		// An `animations` patch belongs on the slide, not the element.
		if ('animations' in patch) {
			const { animations, ...rest } = patch as Partial<PptxElement> & {
				animations?: PptxSlide['animations'];
			};
			writeElementAnimations(el.id, animations ?? []);
			if (Object.keys(rest).length > 0) {
				options.updateElement(el.id, rest);
			}
			return;
		}
		options.updateElement(el.id, patch);
	}

	const selectedMotionPath = computed(() => {
		const el = inspectorElement.value;
		return el ? motionPathFor(activeSlide.value?.animations ?? [], el.id) : undefined;
	});

	function onMotionPathChange(path: string): void {
		const el = inspectorElement.value;
		if (!el) {
			return;
		}
		writeSlideAnimations(setMotionPath(activeSlide.value?.animations ?? [], el.id, path));
	}

	return {
		inspectorElement,
		inspectorElementForPanels,
		onInspectorUpdate,
		writeSlideAnimations,
		selectedMotionPath,
		onMotionPathChange,
	};
}
