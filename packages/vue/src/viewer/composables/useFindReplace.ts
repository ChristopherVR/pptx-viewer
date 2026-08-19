import type { PptxSlide } from 'pptx-viewer-core';
import { applyFindReplacements, findInSlides, replaceMatch } from 'pptx-viewer-shared';
import type { FindResult } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

// The match descriptor and the search / replace implementations are shared with
// the other bindings; this composable is the Vue reactive state around them.
export type { FindResult } from 'pptx-viewer-shared';

export interface UseFindReplaceInput {
	/** Reactive list of slides being edited. */
	slides: Ref<PptxSlide[]>;
	/** The currently active slide index (mutated when navigating matches). */
	activeSlideIndex: Ref<number>;
	/** Snapshot the current document onto the undo/redo history stack. */
	pushHistory: () => void;
}

export interface UseFindReplaceResult {
	query: Ref<string>;
	replacement: Ref<string>;
	matchCase: Ref<boolean>;
	matches: ComputedRef<FindResult[]>;
	matchCount: ComputedRef<number>;
	currentMatch: Ref<number>;
	next: () => void;
	prev: () => void;
	replaceCurrent: () => void;
	replaceAll: () => void;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Find-and-replace logic for the Vue editor.
 *
 * Mirrors the React `useFindReplace` hook: the match descriptor and the
 * search/replace algorithms live in `pptx-viewer-shared` (`findInSlides`,
 * `applyFindReplacements`, `replaceMatch`), at segment-level, per-occurrence
 * precision, so the "N of M" match count and Replace All result count agree
 * with every other binding on the same document. This composable is only the
 * Vue idiom around that shared engine: state is exposed as refs (so the bar
 * can `v-model` them) and the match list is a `computed` over the live
 * slides. Replacements snapshot history first, then reassign `slides.value`
 * to the shared engine's immutable result.
 */
export function useFindReplace({
	slides,
	activeSlideIndex,
	pushHistory,
}: UseFindReplaceInput): UseFindReplaceResult {
	const query = ref(''),
		replacement = ref(''),
		matchCase = ref(false),
		currentMatch = ref(0),
		matches = computed<FindResult[]>(() =>
			findInSlides(slides.value, query.value, { matchCase: matchCase.value }),
		),
		matchCount = computed(() => matches.value.length);

	function clampCurrent(): void {
		if (matchCount.value === 0) {
			currentMatch.value = 0;
			return;
		}
		if (currentMatch.value >= matchCount.value) {
			currentMatch.value = matchCount.value - 1;
		}
		if (currentMatch.value < 0) {
			currentMatch.value = 0;
		}
	}

	function focusCurrent(): void {
		const match = matches.value[currentMatch.value];
		if (match) {
			activeSlideIndex.value = match.slideIndex;
		}
	}

	function next(): void {
		if (matchCount.value === 0) {
			return;
		}
		currentMatch.value = (currentMatch.value + 1) % matchCount.value;
		focusCurrent();
	}

	function prev(): void {
		if (matchCount.value === 0) {
			return;
		}
		currentMatch.value = (currentMatch.value - 1 + matchCount.value) % matchCount.value;
		focusCurrent();
	}

	function replaceCurrent(): void {
		clampCurrent();
		if (matches.value.length === 0 || query.value.length === 0) {
			return;
		}
		pushHistory();
		const result = replaceMatch(slides.value, matches.value, currentMatch.value, replacement.value);
		if (result.replacements > 0) {
			slides.value = result.slides as PptxSlide[];
		}
		clampCurrent();
		focusCurrent();
	}

	function replaceAll(): void {
		if (matches.value.length === 0 || query.value.length === 0) {
			return;
		}
		pushHistory();
		const result = applyFindReplacements(slides.value, matches.value, replacement.value);
		if (result.replacements > 0) {
			slides.value = result.slides as PptxSlide[];
		}
		clampCurrent();
	}

	return {
		query,
		replacement,
		matchCase,
		matches,
		matchCount,
		currentMatch,
		next,
		prev,
		replaceCurrent,
		replaceAll,
	};
}
