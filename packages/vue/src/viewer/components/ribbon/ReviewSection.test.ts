import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ReviewSection from './ReviewSection.vue';

function mountReview(overrides: Record<string, unknown> = {}) {
	return mount(ReviewSection, {
		props: {
			canEdit: true,
			spellCheckEnabled: false,
			onSetSpellCheckEnabled: () => {},
			onToggleComments: () => {},
			onCompare: () => {},
			onOpenAccessibilityCheck: () => {},
			onSetLanguage: () => {},
			...overrides,
		},
	});
}

/**
 * ReviewSection: the Review ribbon tab.
 *
 * Asserted by rendered label because the way this tab drifts is by shipping
 * two thirds of it: a Review tab missing Thesaurus, Translate or the whole
 * Protect group is shorter than the reference, so no layout spec objects.
 */
describe('reviewSection', () => {
	it('offers every group the reference offers', () => {
		const text = mountReview().text();
		for (const control of [
			'Spelling',
			'Thesaurus',
			'Check Accessibility',
			'Translate',
			'Language',
			'Mark All as Read',
			'Compare',
			'Comments',
			'Delete',
			'Previous',
			'Next',
			'Show Comments',
			'Always Open Read-Only',
			'Restrict Permission',
			'Hide Ink',
		]) {
			expect(text).toContain(control);
		}
	});

	it('renders the not-yet-backed commands inert rather than omitting them', () => {
		const wrapper = mountReview();
		const inert = wrapper
			.findAll('button')
			.filter((b) => b.attributes('disabled') !== undefined)
			.map((b) => b.text());
		for (const label of [
			'Thesaurus',
			'Translate',
			'Mark All as Read',
			'Always Open Read-Only',
			'Hide Ink',
		]) {
			expect(inert).toContain(label);
		}
	});

	it('routes Show Comments to the comments panel', async () => {
		const onToggleComments = vi.fn();
		const wrapper = mountReview({ onToggleComments });
		const button = wrapper.findAll('button').find((b) => b.text() === 'Show Comments');
		await button?.trigger('click');
		expect(onToggleComments).toHaveBeenCalledOnce();
	});
});
