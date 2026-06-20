import type { PptxElement, PptxElementWithText, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { getElementTextContent, hasTextProperties } from 'pptx-viewer-core';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

/**
 * A single find-and-replace match descriptor.
 *
 * The match is element-level (not per-occurrence): an element appears once in
 * the {@link UseFindReplaceResult.matches | matches} list regardless of how many
 * times the query occurs inside its text. This keeps navigation predictable:
 * `next()`/`prev()` cycle through matching elements/slides, while `replaceAll`
 * still rewrites every occurrence within each element.
 */
export interface FindMatch {
	/** Index of the slide containing the matched element. */
	slideIndex: number;
	/** Stable id of the matched element. */
	elementId: string;
	/** The element's full text content at the time of search (for previews). */
	text: string;
}

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
	matches: ComputedRef<FindMatch[]>;
	matchCount: ComputedRef<number>;
	currentMatch: Ref<number>;
	next: () => void;
	prev: () => void;
	replaceCurrent: () => void;
	replaceAll: () => void;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Build a global, optionally case-insensitive regex that matches literal
 * occurrences of `query`. Special regex characters are escaped so the query is
 * always treated as a plain string. The `u` (unicode) flag is always set.
 */
export function buildSearchRegex(query: string, matchCase: boolean): RegExp {
	const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(escaped, matchCase ? 'gu' : 'giu');
}

/**
 * Find every text-bearing element across all slides whose text contains the
 * query. Returns an empty list for an empty query.
 */
export function findMatches(slides: PptxSlide[], query: string, matchCase: boolean): FindMatch[] {
	if (query.length === 0) {
		return [];
	}
	const needle = matchCase ? query : query.toLowerCase();
	const results: FindMatch[] = [];

	slides.forEach((slide, slideIndex) => {
		for (const element of slide.elements ?? []) {
			if (!hasTextProperties(element)) {
				continue;
			}
			const text = getElementTextContent(element);
			const haystack = matchCase ? text : text.toLowerCase();
			if (haystack.includes(needle)) {
				results.push({ slideIndex, elementId: element.id, text });
			}
		}
	});

	return results;
}

/**
 * Rewrite a single text-bearing element, replacing every occurrence of `query`
 * with `replacement`. Both the flat `text` and each `textSegments[].text` are
 * updated so the rendered runs stay in sync. The element's identity, style, and
 * every other property are preserved.
 */
export function replaceInElement(
	element: PptxElementWithText,
	query: string,
	replacement: string,
	matchCase: boolean,
): PptxElementWithText {
	const regex = buildSearchRegex(query, matchCase);

	const nextSegments: TextSegment[] | undefined = element.textSegments?.map((segment) => ({
		...segment,
		text: (segment.text ?? '').replace(buildSearchRegex(query, matchCase), replacement),
	}));

	const nextText =
		typeof element.text === 'string' ? element.text.replace(regex, replacement) : element.text;

	return {
		...element,
		...(typeof nextText === 'string' ? { text: nextText } : {}),
		...(nextSegments ? { textSegments: nextSegments } : {}),
	};
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Find-and-replace logic for the Vue editor.
 *
 * Mirrors the React `useFindReplace` hook but in Vue idioms: state is exposed as
 * refs (so the bar can `v-model` them) and the match list is a `computed` over
 * the live slides. Replacements snapshot history first, then mutate the slide
 * elements in place, keeping `text` and `textSegments` consistent.
 */
export function useFindReplace({
	slides,
	activeSlideIndex,
	pushHistory,
}: UseFindReplaceInput): UseFindReplaceResult {
	const query = ref('');
	const replacement = ref('');
	const matchCase = ref(false);
	const currentMatch = ref(0);

	const matches = computed<FindMatch[]>(() =>
		findMatches(slides.value, query.value, matchCase.value),
	);
	const matchCount = computed(() => matches.value.length);

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

	/** Apply replacements to the elements identified by `targets`, in place. */
	function applyReplacements(targets: FindMatch[]): void {
		if (targets.length === 0 || query.value.length === 0) {
			return;
		}
		pushHistory();

		const bySlide = new Map<number, Set<string>>();
		for (const target of targets) {
			let ids = bySlide.get(target.slideIndex);
			if (!ids) {
				ids = new Set<string>();
				bySlide.set(target.slideIndex, ids);
			}
			ids.add(target.elementId);
		}

		for (const [slideIndex, ids] of bySlide) {
			const slide = slides.value[slideIndex];
			if (!slide?.elements) {
				continue;
			}
			slide.elements = slide.elements.map((element: PptxElement) => {
				if (!ids.has(element.id) || !hasTextProperties(element)) {
					return element;
				}
				return replaceInElement(element, query.value, replacement.value, matchCase.value);
			});
		}
	}

	function replaceCurrent(): void {
		clampCurrent();
		const match = matches.value[currentMatch.value];
		if (!match) {
			return;
		}
		applyReplacements([match]);
		clampCurrent();
		focusCurrent();
	}

	function replaceAll(): void {
		applyReplacements(matches.value);
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
