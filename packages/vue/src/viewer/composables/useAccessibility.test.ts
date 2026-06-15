// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useAccessibility } from './useAccessibility';

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

describe('useAccessibility', () => {
	it('flags an image lacking alt text as a missing-alt-text issue', () => {
		const slides = ref<PptxSlide[]>([slide([titleText(), imageWithoutAlt()])]);
		const { issues, issueCount } = useAccessibility(slides);

		const altIssue = issues.value.find((i) => i.type === 'missingAltText');
		expect(altIssue).toBeDefined();
		expect(altIssue?.severity).toBe('error');
		expect(altIssue?.slideIndex).toBe(0);
		expect(altIssue?.elementId).toBe('img_1');
		expect(issueCount.value).toBeGreaterThanOrEqual(1);
	});

	it('reports no missing-alt issue once alt text is present', () => {
		const withAlt = {
			...imageWithoutAlt(),
			altText: 'A descriptive caption',
		} as PptxElement;
		const slides = ref<PptxSlide[]>([slide([titleText(), withAlt])]);
		const { issues } = useAccessibility(slides);

		expect(issues.value.some((i) => i.type === 'missingAltText')).toBeFalsy();
	});

	it('recomputes reactively when slides change', () => {
		const slides = ref<PptxSlide[]>([slide([titleText()])]);
		const { issueCount } = useAccessibility(slides);
		const before = issueCount.value;

		slides.value = [slide([titleText(), imageWithoutAlt()])];
		expect(issueCount.value).toBeGreaterThan(before);
	});

	it('sorts issues by slide index then severity', () => {
		const slides = ref<PptxSlide[]>([
			slide([titleText('t0'), imageWithoutAlt('img_a')]),
			slide([titleText('t1'), imageWithoutAlt('img_b')]),
		]);
		const { issues } = useAccessibility(slides);

		for (let i = 1; i < issues.value.length; i++) {
			expect(issues.value[i].slideIndex).toBeGreaterThanOrEqual(issues.value[i - 1].slideIndex);
		}
	});
});
