import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useComments } from './useComments';
import type { UseCommentsResult } from './useComments';

export interface UseCommentsWiringInput {
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	authorName: ComputedRef<string>;
	pushHistory: () => void;
}

export interface UseCommentsWiringResult {
	showComments: Ref<boolean>;
	activeComments: ComputedRef<PptxComment[]>;
	commentsApi: UseCommentsResult;
	onCommentMarkerClick: (id: string) => void;
	commitComments: (next: PptxComment[] | null) => void;
}

/**
 * useCommentsWiring: the comments panel, its numbered on-canvas markers, and
 * the history-aware commit path that writes a new comment array back onto the
 * active slide. Layered on top of the underlying `useComments` composable.
 * Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useCommentsWiring(input: UseCommentsWiringInput): UseCommentsWiringResult {
	const { activeSlide, activeSlideIndex, slides, authorName, pushHistory } = input;

	const showComments = ref(false);
	const activeComments = computed(() => activeSlide.value?.comments ?? []);
	const commentsApi = useComments({
		comments: activeComments,
		activeSlideIndex,
		authorName,
	});
	/** Open the comments panel and focus the deck on the marker's slide. */
	function onCommentMarkerClick(_id: string): void {
		showComments.value = true;
	}
	/** Commit a new comment array for the active slide (history-aware). */
	function commitComments(next: PptxComment[] | null): void {
		if (!next) {
			return;
		}
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, comments: next };
		slides.value = nextSlides;
	}

	return { showComments, activeComments, commentsApi, onCommentMarkerClick, commitComments };
}
