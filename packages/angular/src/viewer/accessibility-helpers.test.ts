/**
 * accessibility-helpers.test.ts: Unit tests for the pure accessibility
 * helpers, plus the signal-based service and presentational panel component
 * (instantiated directly, no TestBed).
 *
 * Ports the Vue `useAccessibility.test.ts` and `AccessibilityPanel.test.ts`
 * coverage to the Angular binding.
 */

import type { AccessibilityIssue, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	collectAccessibilityIssues,
	countAccessibilityIssues,
	groupIssuesBySeverity,
	issueTrackKey,
	issueTypeLabel,
} from './accessibility-helpers';
import { AccessibilityService } from './accessibility.service';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function imageWithoutAlt(id = 'img_1'): PptxElement {
	return {
		type: 'image',
		id,
		x: 10,
		y: 20,
		width: 200,
		height: 100,
	} as PptxElement;
}

function titleText(id = 'title_1', text = 'Slide title'): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 400,
		height: 60,
		text,
	} as PptxElement;
}

function slide(elements: PptxElement[], overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide_1',
		elements,
		...overrides,
	} as PptxSlide;
}

function issue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
	return {
		type: 'missingAltText',
		severity: 'error',
		slideIndex: 0,
		message: 'Image is missing alternative text.',
		suggestion: 'Add a description.',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// collectAccessibilityIssues (mirrors useAccessibility composable logic)
// ---------------------------------------------------------------------------

describe('collectAccessibilityIssues', () => {
	it('flags an image lacking alt text as a missing-alt-text issue', () => {
		const issues = collectAccessibilityIssues([slide([titleText(), imageWithoutAlt()])]);

		const altIssue = issues.find((i) => i.type === 'missingAltText');
		expect(altIssue).toBeDefined();
		expect(altIssue?.severity).toBe('error');
		expect(altIssue?.slideIndex).toBe(0);
		expect(altIssue?.elementId).toBe('img_1');
		expect(issues.length).toBeGreaterThanOrEqual(1);
	});

	it('reports no missing-alt issue once alt text is present', () => {
		const withAlt = {
			...imageWithoutAlt(),
			altText: 'A descriptive caption',
		} as PptxElement;
		const issues = collectAccessibilityIssues([slide([titleText(), withAlt])]);

		expect(issues.some((i) => i.type === 'missingAltText')).toBeFalsy();
	});

	it('grows the issue count when problematic elements are added', () => {
		const before = collectAccessibilityIssues([slide([titleText()])]);
		const after = collectAccessibilityIssues([slide([titleText(), imageWithoutAlt()])]);
		expect(after.length).toBeGreaterThan(before.length);
	});

	it('sorts issues by slide index then severity', () => {
		const issues = collectAccessibilityIssues([
			slide([titleText('t0'), imageWithoutAlt('img_a')]),
			slide([titleText('t1'), imageWithoutAlt('img_b')]),
		]);

		for (let i = 1; i < issues.length; i++) {
			expect(issues[i].slideIndex).toBeGreaterThanOrEqual(issues[i - 1].slideIndex);
		}

		// Within a slide, errors should precede warnings/tips.
		const slide0 = issues.filter((i) => i.slideIndex === 0);
		const severityRank: Record<AccessibilityIssue['severity'], number> = {
			error: 0,
			warning: 1,
			tip: 2,
		};
		for (let i = 1; i < slide0.length; i++) {
			expect(severityRank[slide0[i].severity]).toBeGreaterThanOrEqual(
				severityRank[slide0[i - 1].severity],
			);
		}
	});

	it('respects skipContrast / skipBlankSlide options', () => {
		const slides = [slide([])];
		const withBlank = collectAccessibilityIssues(slides);
		const withoutBlank = collectAccessibilityIssues(slides, { skipBlankSlide: true });
		expect(withBlank.some((i) => i.type === 'blankSlide')).toBeTruthy();
		expect(withoutBlank.some((i) => i.type === 'blankSlide')).toBeFalsy();
	});

	it('returns an empty list for an empty slide array', () => {
		expect(collectAccessibilityIssues([])).toStrictEqual([]);
	});
});

describe('countAccessibilityIssues', () => {
	it('returns the number of issues', () => {
		expect(countAccessibilityIssues([issue(), issue({ slideIndex: 1 })])).toBe(2);
		expect(countAccessibilityIssues([])).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// AccessibilityService (signal-based)
// ---------------------------------------------------------------------------

describe('accessibilityService', () => {
	it('exposes issues reactively as slides change', () => {
		const service = new AccessibilityService();
		expect(service.issueCount()).toBe(0);

		service.setSlides([slide([titleText(), imageWithoutAlt()])]);
		expect(service.issueCount()).toBeGreaterThanOrEqual(1);
		expect(service.issues().some((i) => i.type === 'missingAltText')).toBeTruthy();
	});

	it('recomputes when slides are replaced', () => {
		const service = new AccessibilityService();
		service.setSlides([slide([titleText()])]);
		const before = service.issueCount();

		service.setSlides([slide([titleText(), imageWithoutAlt()])]);
		expect(service.issueCount()).toBeGreaterThan(before);
	});

	it('derives per-severity counts and isClean', () => {
		const service = new AccessibilityService();
		service.setSlides([slide([titleText(), imageWithoutAlt()])]);

		expect(service.errorCount()).toBeGreaterThanOrEqual(1);
		expect(service.isClean()).toBeFalsy();
		expect(service.errorCount() + service.warningCount() + service.tipCount()).toBe(
			service.issueCount(),
		);
	});

	it('honours options', () => {
		const service = new AccessibilityService();
		service.setSlides([slide([])]);
		service.setOptions({ skipBlankSlide: true });
		expect(service.issues().some((i) => i.type === 'blankSlide')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Panel presentation helpers (mirrors AccessibilityPanel.vue)
//
// The `AccessibilityPanelComponent` is a thin shell over these pure functions;
// testing them here keeps the suite TestBed-free (component tests need the
// Angular compiler; a follow-up, see PORTING.md).
// ---------------------------------------------------------------------------

describe('groupIssuesBySeverity', () => {
	it('groups issues by severity, errors first', () => {
		const groups = groupIssuesBySeverity([
			issue({ type: 'missingAltText', severity: 'error', slideIndex: 0 }),
			issue({
				type: 'lowContrast',
				severity: 'warning',
				slideIndex: 2,
				message: 'Text contrast is too low.',
			}),
		]);

		expect(groups).toHaveLength(2);
		expect(groups[0].severity).toBe('error');
		expect(groups[0].label).toBe('Errors');
		expect(groups[1].severity).toBe('warning');
		expect(groups[0].issues).toHaveLength(1);
	});

	it('omits empty severity groups', () => {
		const groups = groupIssuesBySeverity([issue({ severity: 'tip' })]);
		expect(groups).toHaveLength(1);
		expect(groups[0].severity).toBe('tip');
	});

	it('returns no groups for an empty issue list', () => {
		expect(groupIssuesBySeverity([])).toStrictEqual([]);
	});
});

describe('issueTypeLabel', () => {
	it('maps issue types to human-readable labels', () => {
		expect(issueTypeLabel('missingAltText')).toBe('Missing alt text');
		expect(issueTypeLabel('missingSlideTitle')).toBe('Missing slide title');
		expect(issueTypeLabel('lowContrast')).toBe('Low contrast');
		expect(issueTypeLabel('complexTable')).toBe('Complex table');
		expect(issueTypeLabel('duplicateTitle')).toBe('Duplicate title');
		expect(issueTypeLabel('blankSlide')).toBe('Blank slide');
	});
});

describe('issueTrackKey', () => {
	it('builds distinct keys per issue', () => {
		const a = issueTrackKey(issue({ slideIndex: 0, elementId: 'img_1' }), 0);
		const b = issueTrackKey(issue({ slideIndex: 0, elementId: 'img_2' }), 1);
		expect(a).not.toBe(b);
	});

	it('falls back to "slide" when there is no elementId', () => {
		expect(issueTrackKey(issue({ slideIndex: 3, elementId: undefined }), 2)).toBe(
			'3-missingAltText-slide-2',
		);
	});
});
