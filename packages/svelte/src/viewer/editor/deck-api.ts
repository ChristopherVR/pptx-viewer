import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { cloneSlide } from 'pptx-viewer-core';
import { clampZoomScale, createBlankSlide, makeSlideId } from 'pptx-viewer-shared';
import type { PowerPointViewerAPI, ViewerMode } from 'pptx-viewer-shared';

import type { ViewerState } from '../state/viewer-state.svelte';
import type { EditorState } from './editor-state.svelte';

/**
 * The navigation / zoom / mode / slide / element half of the imperative
 * `PowerPointViewer` instance API. The undo/redo/save half lives in
 * `editing-api.ts` and the export half in `export/exporting-api.ts`.
 */
export type DeckApi = Omit<
	PowerPointViewerAPI,
	'getContent' | 'undo' | 'redo' | 'canUndo' | 'canRedo'
>;

/** Live viewer accessors the deck API closes over (all read from viewer runes). */
export interface DeckApiDeps {
	editor: EditorState;
	viewer: ViewerState;
	/** User-facing zoom percent (rounded), the base every zoom step works from. */
	getZoomPercent(): number;
	/** The viewer's resolved mode, so `getMode()` matches what the chrome shows. */
	getMode(): ViewerMode;
	/** Enter/leave presentation mode (the same handler the ribbon button uses). */
	toggleFullscreen(): void;
	/** Flip the host-facing `editable` flag (`setMode('edit' | 'master')`). */
	setEditable(editable: boolean): void;
}

/** Renumber a slide array so `slideNumber` matches its 1-based position. */
function renumbered(slides: readonly PptxSlide[]): PptxSlide[] {
	return slides.map((slide, index) => ({ ...slide, slideNumber: index + 1 }));
}

/**
 * Build the deck-level imperative API bound to live `EditorState` /
 * `ViewerState` runes. Extracted from `PowerPointViewer.svelte` so the
 * component only re-exports thin, one-line bindings (Svelte requires the
 * component's own `export`s for its instance API, but the bodies can live
 * elsewhere), matching `createEditingApi` / `createExportingApi`.
 */
export function createDeckApi(deps: DeckApiDeps): DeckApi {
	const { editor, viewer } = deps;

	const goTo = (index: number): void => viewer.goTo(index);
	const getElements = (slideIndex = viewer.current): readonly PptxElement[] =>
		editor.renderedSlides[slideIndex]?.elements ?? [];

	return {
		goTo,
		goPrev: () => viewer.prev(),
		goNext: () => viewer.next(),

		getZoom: () => deps.getZoomPercent() / 100,
		// The shared clamp, not a hand-rolled one, so every binding refuses the
		// same out-of-range zoom.
		setZoom: (level) => {
			viewer.zoomPercent = clampZoomScale(level) * 100;
		},
		zoomIn: () => viewer.zoomIn(deps.getZoomPercent()),
		zoomOut: () => viewer.zoomOut(deps.getZoomPercent()),
		zoomReset: () => {
			viewer.zoomPercent = 100;
		},

		getMode: () => deps.getMode(),
		setMode: (mode) => {
			if (mode === 'present') {
				if (!viewer.isFullscreen) {
					deps.toggleFullscreen();
				}
				return;
			}
			if (viewer.isFullscreen) {
				deps.toggleFullscreen();
			}
			deps.setEditable(mode === 'edit' || mode === 'master');
			if (mode === 'master') {
				editor.masterOps.enter();
			} else if (editor.masterViewTarget) {
				editor.masterOps.exit();
			}
		},

		getActiveSlideIndex: () => viewer.current,
		setActiveSlideIndex: goTo,
		getSlideCount: () => editor.renderedSlides.length,
		isDirty: () => editor.dirty,

		getSlides: () => editor.renderedSlides,
		getSlide: (index) => editor.renderedSlides[index],
		getActiveSlide: () => editor.renderedSlides[viewer.current],

		addSlide: (afterIndex = editor.slides.length - 1) => {
			const next = [...editor.slides];
			const index = Math.min(Math.max(afterIndex + 1, 0), next.length);
			next.splice(index, 0, createBlankSlide(index + 1, makeSlideId));
			editor.commitSlides(renumbered(next));
			viewer.goTo(index);
		},
		deleteSlides: (indexes) => {
			if (editor.slides.length <= 1) {
				return;
			}
			const remove = new Set(indexes);
			const next = editor.slides.filter((_, index) => !remove.has(index));
			if (next.length === 0) {
				return;
			}
			editor.commitSlides(renumbered(next));
			viewer.goTo(Math.min(viewer.current, next.length - 1));
		},
		duplicateSlides: (indexes) => {
			const selected = new Set(indexes);
			const next = editor.slides.flatMap((slide, index) =>
				selected.has(index) ? [slide, { ...cloneSlide(slide), id: makeSlideId() }] : [slide],
			);
			editor.commitSlides(renumbered(next));
		},
		moveSlide: (fromIndex, toIndex) => {
			const next = [...editor.slides];
			if (!next[fromIndex] || toIndex < 0 || toIndex >= next.length || fromIndex === toIndex) {
				return;
			}
			const [slide] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, slide);
			editor.commitSlides(renumbered(next));
			viewer.goTo(toIndex);
		},
		toggleHideSlides: (indexes) => {
			const selected = new Set(indexes);
			editor.commitSlides(
				editor.slides.map((slide, index) =>
					selected.has(index) ? { ...slide, hidden: !slide.hidden } : slide,
				),
			);
		},

		getElements,
		getElementById: (id, slideIndex = viewer.current) =>
			getElements(slideIndex).find((element) => element.id === id),

		updateElement: (id, updates) => editor.applyElementPatch(id, updates),
		deleteElements: (ids) => {
			editor.selection.setAll(ids);
			editor.deleteSelected();
		},
		duplicateElement: (id) => {
			editor.selection.set(id);
			return editor.duplicateSelected() ?? undefined;
		},

		getSelectedElementIds: () => [...editor.selection.ids],
		selectElements: (ids) => editor.selection.setAll(ids),
		clearSelection: () => editor.selection.clear(),
	};
}
