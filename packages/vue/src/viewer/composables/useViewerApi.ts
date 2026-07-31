/**
 * useViewerApi: assemble the imperative handle the SFC hands to
 * `defineExpose`.
 *
 * `defineExpose` is a compiler macro and must stay in the SFC, but the object
 * it receives is a plain adapter from the viewer's internal state to the
 * framework-agnostic {@link PowerPointViewerExpose} contract, which is exactly
 * the kind of non-presentational code that does not belong in a template file.
 * Building it here also makes the contract diffable against the other bindings.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { clampZoomScale } from 'pptx-viewer-shared';
import type { ViewerMode } from 'pptx-viewer-shared';
import type { ComputedRef, Ref, ShallowRef } from 'vue';

import type { PowerPointViewerExpose } from '../types';

export interface UseViewerApiOptions {
	slides: ShallowRef<PptxSlide[]>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	slideCount: ComputedRef<number>;
	selectedElementIds: Ref<string[]>;
	zoom: Ref<number>;
	isDirty: Ref<boolean>;
	presenting: Ref<boolean>;
	showMasterView: Ref<boolean>;
	mode: Ref<ViewerMode> | ComputedRef<ViewerMode>;
	getContent: () => Promise<Uint8Array>;
	goTo: (index: number) => void;
	goPrev: () => void;
	goNext: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomReset: () => void;
	startPresenting: () => void;
	history: {
		undo: () => void;
		redo: () => void;
		canUndo: ComputedRef<boolean> | Ref<boolean>;
		canRedo: ComputedRef<boolean> | Ref<boolean>;
	};
	slideOps: {
		addSlide: () => void;
		deleteSlide: (index: number) => void;
		duplicateSlide: (index: number) => void;
		moveSlide: (from: number, to: number) => void;
	};
	toggleSlideHidden: (index: number) => void;
	elementOps: {
		updateElement: (id: string, updates: Partial<PptxElement>) => void;
		removeElement: (id: string) => void;
		duplicateElement: (id: string) => string | undefined;
	};
}

export function useViewerApi(options: UseViewerApiOptions): PowerPointViewerExpose {
	const {
		slides,
		activeSlide,
		activeSlideIndex,
		slideCount,
		selectedElementIds,
		zoom,
		history,
		slideOps,
		elementOps,
	} = options;

	/** Resolve a slide index argument, defaulting to the active slide. */
	const slideAt = (index?: number): PptxSlide | undefined =>
		slides.value[index ?? activeSlideIndex.value];

	return {
		getContent: options.getContent,
		goTo: options.goTo,
		goPrev: options.goPrev,
		goNext: options.goNext,
		undo: () => history.undo(),
		redo: () => history.redo(),
		canUndo: () => history.canUndo.value,
		canRedo: () => history.canRedo.value,
		getZoom: () => zoom.value,
		setZoom: (level: number) => {
			// Shared clamp, not a hand-rolled one, so every binding refuses the same
			// out-of-range zoom.
			zoom.value = clampZoomScale(level);
		},
		zoomIn: options.zoomIn,
		zoomOut: options.zoomOut,
		zoomReset: options.zoomReset,
		getMode: () => options.mode.value,
		setMode: (newMode) => {
			if (newMode === 'present') {
				options.startPresenting();
			} else if (newMode === 'master') {
				options.showMasterView.value = true;
			} else {
				options.presenting.value = false;
				options.showMasterView.value = false;
			}
		},
		getActiveSlideIndex: () => activeSlideIndex.value,
		setActiveSlideIndex: (index: number) => options.goTo(index),
		getSlideCount: () => slideCount.value,
		isDirty: () => options.isDirty.value,
		// -- Slide access --
		getSlides: () => slides.value,
		getSlide: (index: number) => slides.value[index],
		getActiveSlide: () => activeSlide.value,
		// -- Slide manipulation --
		addSlide: () => slideOps.addSlide(),
		deleteSlides: (indexes: number[]) => {
			// Descending, so each removal cannot shift the index of one still pending.
			for (const i of [...indexes].sort((a, b) => b - a)) {
				slideOps.deleteSlide(i);
			}
		},
		duplicateSlides: (indexes: number[]) => {
			for (const i of indexes) {
				slideOps.duplicateSlide(i);
			}
		},
		moveSlide: (from: number, to: number) => slideOps.moveSlide(from, to),
		toggleHideSlides: (indexes: number[]) => {
			for (const i of indexes) {
				options.toggleSlideHidden(i);
			}
		},
		// -- Element access --
		getElements: (slideIndex?: number) => slideAt(slideIndex)?.elements ?? [],
		getElementById: (elementId: string, slideIndex?: number) =>
			slideAt(slideIndex)?.elements.find((e) => e.id === elementId),
		// -- Element manipulation --
		updateElement: (elementId: string, updates: Partial<PptxElement>) => {
			elementOps.updateElement(elementId, updates);
		},
		deleteElements: (elementIds: string[]) => {
			for (const id of elementIds) {
				elementOps.removeElement(id);
			}
		},
		duplicateElement: (elementId: string) => elementOps.duplicateElement(elementId),
		// -- Selection --
		getSelectedElementIds: () => selectedElementIds.value,
		selectElements: (ids: string[]) => {
			selectedElementIds.value = ids;
		},
		clearSelection: () => {
			selectedElementIds.value = [];
		},
	};
}
