import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { MobileActiveSheet } from '../composables/useMobileChrome';
import MobileBottomBar from './MobileBottomBar.vue';

function mountBar(
	props: Partial<{
		slideCount: number;
		activeSheet: MobileActiveSheet;
		commentCount: number;
		keyboardInset: number;
	}> = {},
) {
	// Default to a loaded deck so the behavioural tests below (tapping tabs,
	// badges, etc.) don't need to opt into a non-zero slide count individually;
	// the disabled-gating tests below pass 0 explicitly.
	return mount(MobileBottomBar, { props: { slideCount: 5, ...props } });
}

/** The tabs render inside the shared element's open shadow root. */
function tabs(wrapper: ReturnType<typeof mountBar>): HTMLButtonElement[] {
	return [...((wrapper.element as HTMLElement).shadowRoot?.querySelectorAll('button') ?? [])];
}

/** The translated label of each tab, in render order. */
function tabLabels(wrapper: ReturnType<typeof mountBar>): string[] {
	return tabs(wrapper).map((tab) => tab.querySelector('span')?.textContent ?? '');
}

describe('mobileBottomBar', () => {
	it('renders the five React destination tabs, in order', () => {
		const wrapper = mountBar();
		expect(tabLabels(wrapper)).toStrictEqual(['Slides', 'Insert', 'Format', 'Comments', 'Notes']);
	});

	it('emits the matching event for each tab tap', () => {
		const wrapper = mountBar();
		for (const tab of tabs(wrapper)) {
			tab.click();
		}
		expect(wrapper.emitted('slides')).toHaveLength(1);
		expect(wrapper.emitted('insert')).toHaveLength(1);
		expect(wrapper.emitted('format')).toHaveLength(1);
		expect(wrapper.emitted('comments')).toHaveLength(1);
		expect(wrapper.emitted('notes')).toHaveLength(1);
	});

	it('marks only the active sheet tab as pressed', () => {
		const pressed = tabs(mountBar({ activeSheet: 'format' })).filter(
			(tab) => tab.getAttribute('aria-pressed') === 'true',
		);
		expect(pressed).toHaveLength(1);
		expect(pressed[0].textContent).toContain('Format');
	});

	it('leaves every tab unpressed when no sheet is open', () => {
		const pressed = tabs(mountBar({ activeSheet: null })).filter(
			(tab) => tab.getAttribute('aria-pressed') === 'true',
		);
		expect(pressed).toHaveLength(0);
	});

	it('renders a comment-count badge when count > 0', () => {
		const comments = tabs(mountBar({ commentCount: 3 }))[3];
		expect(comments.querySelector<HTMLElement>('.badge')?.hidden).toBeFalsy();
		expect(comments.querySelector('.badge')?.textContent).toBe('3');
	});

	it('caps the comment badge at 99+', () => {
		expect(tabs(mountBar({ commentCount: 150 }))[3].querySelector('.badge')?.textContent).toBe(
			'99+',
		);
	});

	it('omits the comment badge when count is 0', () => {
		const badge = tabs(mountBar({ commentCount: 0 }))[3].querySelector<HTMLElement>('.badge');
		expect(badge?.hidden).toBeTruthy();
	});

	it('carries no slide-navigation or zoom controls (those are swipe / pinch)', () => {
		const names = tabs(mountBar()).map((tab) => tab.getAttribute('aria-label'));
		expect(names).not.toContain('Previous slide');
		expect(names).not.toContain('Next slide');
		expect(names).not.toContain('Zoom in');
	});

	it('lifts above the keyboard when a keyboard inset is supplied', () => {
		const wrapper = mountBar({ keyboardInset: 120 });
		expect(wrapper.element.getAttribute('style')).toContain('translateY(-120px)');
	});

	it('disables every tab when no slides are loaded', () => {
		const all = tabs(mountBar({ slideCount: 0 }));
		expect(all).toHaveLength(5);
		expect(all.every((tab) => tab.disabled)).toBeTruthy();
	});

	it('enables every tab once slides are loaded', () => {
		const all = tabs(mountBar({ slideCount: 3 }));
		expect(all).toHaveLength(5);
		expect(all.every((tab) => !tab.disabled)).toBeTruthy();
	});
});
