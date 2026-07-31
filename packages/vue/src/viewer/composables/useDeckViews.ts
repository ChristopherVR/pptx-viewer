/**
 * useDeckViews: the three full-deck overlays that temporarily replace the
 * editing canvas (Slide Sorter, Outline View, Reading View).
 *
 * They are grouped because they share one rule: leaving any of them returns the
 * editor to the slide that was on screen, exactly as leaving PowerPoint's
 * Reading View does.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { Ref, ShallowRef } from 'vue';
import { ref } from 'vue';

export interface UseDeckViewsOptions {
	slides: ShallowRef<PptxSlide[]>;
	goTo: (index: number) => void;
	moveSlide: (from: number, to: number) => void;
	pushHistory: () => void;
}

export interface UseDeckViewsResult {
	showSorter: Ref<boolean>;
	showOutlineView: Ref<boolean>;
	showReadingView: Ref<boolean>;
	onSorterSelect: (index: number) => void;
	onSorterReorder: (from: number, to: number) => void;
	onOutlineCommit: (next: PptxSlide[], activeIndex: number) => void;
	onReadingViewExit: (index: number) => void;
}

export function useDeckViews(options: UseDeckViewsOptions): UseDeckViewsResult {
	const showSorter = ref(false);
	const showOutlineView = ref(false);
	const showReadingView = ref(false);

	function onSorterSelect(index: number): void {
		options.goTo(index);
		showSorter.value = false;
	}

	/**
	 * Commit an outline edit. `pushHistory()` runs BEFORE the deck is replaced,
	 * which is this binding's contract for an undoable change: the snapshot has to
	 * be of the state being replaced, not of the replacement.
	 */
	function onOutlineCommit(next: PptxSlide[], activeIndex: number): void {
		options.pushHistory();
		options.slides.value = next;
		options.goTo(activeIndex);
	}

	function onReadingViewExit(index: number): void {
		showReadingView.value = false;
		options.goTo(index);
	}

	return {
		showSorter,
		showOutlineView,
		showReadingView,
		onSorterSelect,
		onSorterReorder: (from, to) => options.moveSlide(from, to),
		onOutlineCommit,
		onReadingViewExit,
	};
}
