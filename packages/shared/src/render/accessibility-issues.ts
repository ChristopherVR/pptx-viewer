/**
 * Pure WCAG / PowerPoint-style accessibility aggregation for the PPTX viewer,
 * shared by every binding. No framework imports.
 *
 * Mirrors `pptx-viewer-core`'s `checkPresentation` entry point, but
 * `checkPresentation` consumes a full `PptxData` object (it reads
 * `data.slides`). The viewer only has the slide array to hand, so
 * {@link collectAccessibilityIssues} re-implements the same aggregation by
 * calling the individual exported `check*` functions over the slides and
 * sorting the result identically (by slide index, then severity:
 * error -> warning -> tip).
 */

import type {
	AccessibilityCheckOptions,
	AccessibilityIssue,
	AccessibilityIssueSeverity,
	AccessibilityIssueType,
	PptxSlide,
} from 'pptx-viewer-core';
import {
	checkBlankSlide,
	checkComplexTables,
	checkDuplicateTitles,
	checkLowContrast,
	checkMissingAltText,
	checkMissingSlideTitle,
} from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Severity ordering / display
// ---------------------------------------------------------------------------

/** Display / sort weight for each severity (lower sorts first). */
const SEVERITY_ORDER: Record<AccessibilityIssueSeverity, number> = {
	error: 0,
	warning: 1,
	tip: 2,
};

/** Severity groups in display order (errors first, then warnings, then tips). */
export const SEVERITY_GROUPS: readonly AccessibilityIssueSeverity[] = ['error', 'warning', 'tip'];

/**
 * English headings for each severity group.
 *
 * The fallback, not the source of truth: {@link SEVERITY_LABEL_KEYS} is what a
 * binding should feed its translator. These stay exported because they are the
 * text a caller with no translator gets, and because they are part of the
 * historical public surface of this module.
 */
export const SEVERITY_LABELS: Record<AccessibilityIssueSeverity, string> = {
	error: 'Errors',
	warning: 'Warnings',
	tip: 'Tips',
};

/** English label for each issue type; see {@link TYPE_LABEL_KEYS}. */
export const TYPE_LABELS: Record<AccessibilityIssueType, string> = {
	missingAltText: 'Missing alt text',
	missingSlideTitle: 'Missing slide title',
	lowContrast: 'Low contrast',
	complexTable: 'Complex table',
	duplicateTitle: 'Duplicate title',
	blankSlide: 'Blank slide',
};

/**
 * `pptx.*` translation key for each severity heading.
 *
 * Vue kept a private copy of this map (and of {@link TYPE_LABEL_KEYS}) inside
 * its panel while Angular, Svelte and Vanilla rendered the English constants
 * above, so the same checker spoke two languages depending on which binding
 * you opened it in. The keys live here now, next to the aggregation they
 * label.
 */
export const SEVERITY_LABEL_KEYS: Record<AccessibilityIssueSeverity, string> = {
	error: 'pptx.accessibility.severityErrors',
	warning: 'pptx.accessibility.severityWarnings',
	tip: 'pptx.accessibility.severityTips',
};

/** `pptx.*` translation key for each issue type. */
export const TYPE_LABEL_KEYS: Record<AccessibilityIssueType, string> = {
	missingAltText: 'pptx.accessibility.typeMissingAltText',
	missingSlideTitle: 'pptx.accessibility.typeMissingSlideTitle',
	lowContrast: 'pptx.accessibility.typeLowContrast',
	complexTable: 'pptx.accessibility.typeComplexTable',
	duplicateTitle: 'pptx.accessibility.typeDuplicateTitle',
	blankSlide: 'pptx.accessibility.typeBlankSlide',
};

/** Resolves a `pptx.*` key to display text. */
export type AccessibilityTranslate = (key: string) => string;

/** A severity group with its (non-empty) issues, used for rendering. */
export interface AccessibilityIssueGroup {
	severity: AccessibilityIssueSeverity;
	label: string;
	issues: AccessibilityIssue[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all accessibility checks over the supplied slides and return the issues
 * sorted by slide index, then severity (error -> warning -> tip).
 *
 * Equivalent to core's `checkPresentation`, but operates on a slide array
 * rather than a full `PptxData` object.
 *
 * @param slides - Parsed slides for the current presentation.
 * @param options - Optional check configuration mirroring
 *   {@link AccessibilityCheckOptions}.
 */
export function collectAccessibilityIssues(
	slides: readonly PptxSlide[],
	options: AccessibilityCheckOptions = {},
): AccessibilityIssue[] {
	const minContrastRatio = options.minContrastRatio ?? 4.5;
	const skipContrast = options.skipContrast ?? false;
	const skipBlankSlide = options.skipBlankSlide ?? false;

	const collected: AccessibilityIssue[] = [];

	for (let i = 0; i < slides.length; i++) {
		const slide = slides[i];
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

	collected.push(...checkDuplicateTitles([...slides]));

	collected.sort(
		(a, b) =>
			a.slideIndex - b.slideIndex || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
	);

	return collected;
}

/** Total number of issues in a collected list. */
export function countAccessibilityIssues(issues: readonly AccessibilityIssue[]): number {
	return issues.length;
}

/**
 * Partition issues into non-empty severity groups in display order
 * (errors -> warnings -> tips).
 *
 * @param translate - The binding's translator. Omit it to get English, which
 *   is what every existing caller did before the keys moved here.
 */
export function groupIssuesBySeverity(
	issues: readonly AccessibilityIssue[],
	translate?: AccessibilityTranslate,
): AccessibilityIssueGroup[] {
	return SEVERITY_GROUPS.map((severity) => ({
		severity,
		label: translate ? translate(SEVERITY_LABEL_KEYS[severity]) : SEVERITY_LABELS[severity],
		issues: issues.filter((issue) => issue.severity === severity),
	})).filter((group) => group.issues.length > 0);
}

/** Human-readable label for an issue type, translated when a translator is given. */
export function issueTypeLabel(
	type: AccessibilityIssueType,
	translate?: AccessibilityTranslate,
): string {
	return translate ? translate(TYPE_LABEL_KEYS[type]) : TYPE_LABELS[type];
}

/**
 * Stable-ish track key for an issue (issues have no id of their own).
 */
export function issueTrackKey(issue: AccessibilityIssue, index: number): string {
	return `${issue.slideIndex}-${issue.type}-${issue.elementId ?? 'slide'}-${index}`;
}
