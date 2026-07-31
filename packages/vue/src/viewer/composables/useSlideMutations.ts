import type {
	PptxAnimationPreset,
	PptxElement,
	PptxElementAnimation,
	PptxSlide,
	PptxSlideTransition,
} from 'pptx-viewer-core';
import { applyMotionPathPreset } from 'pptx-viewer-shared';
import type { AnimationApplyGroup } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';

import { applyAnimationPreset, removeElementAnimation } from './element-animation';

export interface UseSlideMutationsInput {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	pushHistory: () => void;
	selectedElements: ComputedRef<PptxElement[]>;
}

/**
 * useSlideMutations: history-tracked mutations that live on the slide rather
 * than an element (speaker notes, hidden flag, transition, background patch,
 * per-slide animation list). Each rebuilds a fresh `slides` array after
 * snapshotting history. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useSlideMutations(input: UseSlideMutationsInput) {
	const { slides, activeSlideIndex, activeSlide, pushHistory, selectedElements } = input;

	function onNotesUpdate(notes: string): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, notes };
		slides.value = nextSlides;
	}

	/** Toggle the hidden flag on the slide at `index` (from the rail context menu). */
	function toggleSlideHidden(index: number): void {
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, hidden: !slide.hidden };
		slides.value = nextSlides;
	}

	/** Apply a transition (or clear it) on the active slide, from the SlideInspector. */
	function applySlideTransition(transition: PptxSlideTransition | undefined): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, transition };
		slides.value = nextSlides;
	}

	/** Merge a partial patch (e.g. background colour/image) into the active slide. */
	function applySlideBackgroundPatch(patch: Partial<PptxSlide>): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, ...patch };
		slides.value = nextSlides;
	}

	/** Merge a partial transition patch into the active slide (Transitions ribbon). */
	function onTransitionChange(updates: Partial<PptxSlideTransition>): void {
		const current = (activeSlide.value?.transition ?? {}) as PptxSlideTransition;
		applySlideTransition({ ...current, ...updates });
	}

	/** Copy the active slide's transition onto every slide (Apply To All). */
	function onApplyTransitionToAll(): void {
		const transition = activeSlide.value?.transition;
		pushHistory();
		slides.value = slides.value.map((slide) => ({ ...slide, transition }));
	}

	/** Replace the active slide's animation list (history-aware). */
	function writeActiveSlideAnimations(animations: PptxElementAnimation[]): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, animations };
		slides.value = nextSlides;
	}

	/**
	 * Apply an animation to the selected element (Animations tab).
	 *
	 * The `motionPath` bucket is not a preset name but a catalogue id whose path
	 * geometry is what gets stored on the entry, so it takes its own branch
	 * rather than being cast into `PptxAnimationPreset`.
	 */
	function onAddAnimation(preset: string, group: AnimationApplyGroup): void {
		const el = selectedElements.value[0];
		const slide = activeSlide.value;
		if (!el || !slide) {
			return;
		}
		const current = slide.animations ?? [];
		writeActiveSlideAnimations(
			group === 'motionPath'
				? applyMotionPathPreset(current, el.id, preset)
				: applyAnimationPreset(current, el.id, group, preset as PptxAnimationPreset),
		);
	}

	/** Remove the selected element's animation entry (Animations tab). */
	function onRemoveAnimation(): void {
		const el = selectedElements.value[0];
		const slide = activeSlide.value;
		if (!el || !slide) {
			return;
		}
		writeActiveSlideAnimations(removeElementAnimation(slide.animations ?? [], el.id));
	}

	return {
		onNotesUpdate,
		toggleSlideHidden,
		applySlideTransition,
		applySlideBackgroundPatch,
		onTransitionChange,
		onApplyTransitionToAll,
		onAddAnimation,
		onRemoveAnimation,
	};
}
