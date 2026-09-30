import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReviewSection from './ReviewSection.vue';

registerPptxWebControls();
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
function mountReview(overrides: Record<string, unknown> = {}) {
	const wrapper = mount(ReviewSection, {
		attachTo: document.body,
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
	cleanups.push(() => wrapper.unmount());
	const host = (id: string) =>
		wrapper.element.querySelector<HTMLElement>(`[data-ribbon-control="review.${id}"]`)!;
	const button = (id: string) => host(id).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
	return { wrapper, host, button };
}

describe('review shared commands', () => {
	it('renders all seven groups and routes the supported native callbacks', () => {
		const spelling = vi.fn(),
			comments = vi.fn(),
			compare = vi.fn(),
			accessibility = vi.fn(),
			language = vi.fn();
		const view = mountReview({
			onSetSpellCheckEnabled: spelling,
			onToggleComments: comments,
			onCompare: compare,
			onOpenAccessibilityCheck: accessibility,
			onSetLanguage: language,
		});
		for (const id of [
			'proofing.spelling',
			'accessibility.check',
			'language.language',
			'compare.compare',
			'comments.newComment',
			'comments.showComments',
		]) {
			view.button(id).click();
		}
		expect(spelling).toHaveBeenCalledExactlyOnceWith(true);
		expect(accessibility).toHaveBeenCalledOnce();
		expect(language).toHaveBeenCalledOnce();
		expect(compare).toHaveBeenCalledOnce();
		expect(comments).toHaveBeenCalledTimes(2);
		expect(view.wrapper.element.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(7);
		expect(
			view.host('ink.hideInk').closest('[data-ribbon-group]')?.getAttribute('data-ribbon-group'),
		).toBe('review.ink');
	});

	it('updates controlled state and preserves focus without affecting another instance', async () => {
		const callback = vi.fn();
		const first = mountReview({ onCompare: callback });
		const second = mountReview();
		first.button('proofing.spelling').focus();
		await first.wrapper.setProps({
			spellCheckEnabled: true,
			isCommentsPanelOpen: true,
			slideCommentCount: 5,
			canEdit: false,
		});
		expect(first.host('proofing.spelling')).toBe(document.activeElement);
		expect(first.button('proofing.spelling').getAttribute('aria-pressed')).toBe('true');
		expect(second.button('proofing.spelling').getAttribute('aria-pressed')).toBe('false');
		expect(first.host('comments.newComment').getAttribute('badge')).toBe('5');
		expect(first.button('comments.newComment').getAttribute('aria-expanded')).toBe('true');
		first.button('compare.compare').click();
		expect(callback).not.toHaveBeenCalled();
		await first.wrapper.setProps({ slideCommentCount: 0 });
		expect(first.host('comments.newComment').hasAttribute('badge')).toBeFalsy();
	});

	it('keeps unsupported commands disabled', () => {
		const view = mountReview();
		for (const id of [
			'proofing.thesaurus',
			'language.translate',
			'compare.markAllRead',
			'comments.delete',
			'comments.previous',
			'comments.next',
			'protect.readOnly',
			'protect.restrictPermission',
			'ink.hideInk',
		]) {
			expect(view.button(id).disabled).toBeTruthy();
		}
	});
});
