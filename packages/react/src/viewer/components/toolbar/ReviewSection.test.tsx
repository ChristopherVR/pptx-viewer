import { registerPptxWebControls } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReviewSection } from './ReviewSection';
import type { ReviewSectionProps } from './ReviewSection';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
registerPptxWebControls();
const cleanups: (() => void)[] = [];
afterEach(() => {
	cleanups.splice(0).forEach((cleanup) => cleanup());
});

function mount(props: Partial<ReviewSectionProps> = {}) {
	const el = document.createElement('div');
	document.body.append(el);
	const root = createRoot(el);
	const initial: ReviewSectionProps = {
		canEdit: true,
		spellCheckEnabled: false,
		onSetSpellCheckEnabled: vi.fn(),
		...props,
	};
	const update = (next: Partial<ReviewSectionProps>) =>
		act(() => root.render(<ReviewSection {...initial} {...next} />));
	update({});
	cleanups.push(() => {
		act(() => root.unmount());
		el.remove();
	});
	const host = (id: string) =>
		el.querySelector<HTMLElement>(`[data-ribbon-control="review.${id}"]`)!;
	const button = (id: string) => host(id).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
	return { el, update, host, button };
}

describe('review shared commands', () => {
	it('routes every supported command to its native callback', () => {
		const spelling = vi.fn(),
			comments = vi.fn(),
			compare = vi.fn(),
			accessibility = vi.fn(),
			language = vi.fn();
		const view = mount({
			onSetSpellCheckEnabled: spelling,
			onToggleComments: comments,
			onCompare: compare,
			onOpenAccessibilityCheck: accessibility,
			onSetLanguage: language,
		});
		act(() => {
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
		});
		expect(spelling).toHaveBeenCalledExactlyOnceWith(true);
		expect(accessibility).toHaveBeenCalledOnce();
		expect(language).toHaveBeenCalledOnce();
		expect(compare).toHaveBeenCalledOnce();
		expect(comments).toHaveBeenCalledTimes(2);
		expect(view.el.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(7);
		expect(
			view.host('ink.hideInk').closest('[data-ribbon-group]')?.getAttribute('data-ribbon-group'),
		).toBe('review.ink');
	});

	it('keeps focused buttons, controlled state and independent instances through updates', () => {
		const callback = vi.fn();
		const first = mount({ onToggleComments: callback, onCompare: callback });
		const second = mount();
		first.button('proofing.spelling').focus();
		first.update({
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
		act(() => first.button('compare.compare').click());
		expect(callback).not.toHaveBeenCalled();
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
			expect(first.button(id).disabled).toBeTruthy();
		}
		first.update({ slideCommentCount: 0 });
		expect(first.host('comments.newComment').hasAttribute('badge')).toBeFalsy();
	});
});
