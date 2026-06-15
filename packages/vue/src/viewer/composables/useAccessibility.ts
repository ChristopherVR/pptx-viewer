import type { AccessibilityCheckOptions, AccessibilityIssue, PptxSlide } from 'pptx-viewer-core';
import {
	checkBlankSlide,
	checkComplexTables,
	checkDuplicateTitles,
	checkLowContrast,
	checkMissingAltText,
	checkMissingSlideTitle,
} from 'pptx-viewer-core';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';

/**
 * `useAccessibility` — reactive WCAG / PowerPoint-style accessibility checker
 * for the Vue viewer/editor.
 *
 * Mirrors `pptx-viewer-core`'s {@link checkPresentation} entry point, but
 * `checkPresentation` consumes a full `PptxData` object (it reads
 * `data.slides`). The composable only has the slide array to hand, so it
 * re-implements the same aggregation by calling the individual exported
 * `check*` functions over the slides and sorting the result identically
 * (by slide index, then severity: error → warning → tip).
 *
 * The result is fully reactive: whenever the `slides` source changes the
 * issue list and count recompute.
 *
 * @param slides - Reactive source of parsed slides (ref, getter, or value).
 * @param options - Optional check configuration mirroring
 *   {@link AccessibilityCheckOptions}.
 */
export interface UseAccessibilityResult {
	/** All detected issues, sorted by slide index then severity. */
	issues: ComputedRef<AccessibilityIssue[]>;
	/** Total number of detected issues. */
	issueCount: ComputedRef<number>;
}

const SEVERITY_ORDER: Record<AccessibilityIssue['severity'], number> = {
	error: 0,
	warning: 1,
	tip: 2,
};

export function useAccessibility(
	slides: MaybeRefOrGetter<PptxSlide[]>,
	options: MaybeRefOrGetter<AccessibilityCheckOptions> = {},
): UseAccessibilityResult {
	const issues = computed<AccessibilityIssue[]>(() => {
		const slideList = toValue(slides);
		const opts = toValue(options);
		const minContrastRatio = opts.minContrastRatio ?? 4.5;
		const skipContrast = opts.skipContrast ?? false;
		const skipBlankSlide = opts.skipBlankSlide ?? false;

		const collected: AccessibilityIssue[] = [];

		for (let i = 0; i < slideList.length; i++) {
			const slide = slideList[i];
			collected.push(...checkMissingAltText(slide, i));
			collected.push(...checkMissingSlideTitle(slide, i));
			if (!skipContrast) {
				collected.push(...checkLowContrast(slide, i, minContrastRatio, slide.backgroundColor));
			}
			collected.push(...checkComplexTables(slide, i));
			if (!skipBlankSlide) {
				collected.push(...checkBlankSlide(slide, i));
			}
		}

		collected.push(...checkDuplicateTitles(slideList));

		collected.sort(
			(a, b) =>
				a.slideIndex - b.slideIndex || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
		);

		return collected;
	});

	const issueCount = computed<number>(() => issues.value.length);

	return { issues, issueCount };
}
