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
	// Default to a loaded deck so the pre-existing behavioural tests below
	// (tapping tabs, badges, etc.) don't need to opt into a non-zero slide
	// count individually; the disabled-gating tests below pass 0 explicitly.
	return mount(MobileBottomBar, { props: { slideCount: 5, ...props } });
}

/** The translated label of each tab, in render order. */
function tabLabels(wrapper: ReturnType<typeof mountBar>): string[] {
	return wrapper
		.findAll('.pptx-vue-mobile-tab')
		.map((tab) => tab.text().replace(/\s+/gu, ' ').trim());
}

describe('mobileBottomBar', () => {
	it('renders the five React destination tabs, in order', () => {
		const wrapper = mountBar();
		expect(tabLabels(wrapper)).toStrictEqual(['Slides', 'Insert', 'Format', 'Comments', 'Notes']);
	});

	it('emits the matching event for each tab tap', async () => {
		const wrapper = mountBar(),
			tabs = wrapper.findAll('.pptx-vue-mobile-tab');
		for (const tab of tabs) {
			await tab.trigger('click');
		}
		expect(wrapper.emitted('slides')).toHaveLength(1);
		expect(wrapper.emitted('insert')).toHaveLength(1);
		expect(wrapper.emitted('format')).toHaveLength(1);
		expect(wrapper.emitted('comments')).toHaveLength(1);
		expect(wrapper.emitted('notes')).toHaveLength(1);
	});

	it('marks only the active sheet tab as pressed', () => {
		const wrapper = mountBar({ activeSheet: 'format' }),
			pressed = wrapper
				.findAll('.pptx-vue-mobile-tab')
				.filter((tab) => tab.attributes('aria-pressed') === 'true');
		expect(pressed).toHaveLength(1);
		expect(pressed[0].text()).toContain('Format');
	});

	it('leaves every tab unpressed when no sheet is open', () => {
		const wrapper = mountBar({ activeSheet: null }),
			pressed = wrapper
				.findAll('.pptx-vue-mobile-tab')
				.filter((tab) => tab.attributes('aria-pressed') === 'true');
		expect(pressed).toHaveLength(0);
	});

	it('renders a comment-count badge when count > 0', () => {
		const wrapper = mountBar({ commentCount: 3 });
		expect(wrapper.get('.pptx-vue-mobile-badge').text()).toBe('3');
	});

	it('caps the comment badge at 99+', () => {
		const wrapper = mountBar({ commentCount: 150 });
		expect(wrapper.get('.pptx-vue-mobile-badge').text()).toBe('99+');
	});

	it('omits the comment badge when count is 0', () => {
		const wrapper = mountBar({ commentCount: 0 });
		expect(wrapper.find('.pptx-vue-mobile-badge').exists()).toBeFalsy();
	});

	it('carries no slide-navigation or zoom controls (those are swipe / pinch)', () => {
		const wrapper = mountBar();
		expect(wrapper.find('button[aria-label="Previous slide"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Next slide"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBeFalsy();
	});

	it('lifts above the keyboard when a keyboard inset is supplied', () => {
		const wrapper = mountBar({ keyboardInset: 120 });
		expect(wrapper.get('.pptx-vue-mobile-bar').attributes('style')).toContain('translateY(-120px)');
	});

	it('disables every tab when no slides are loaded', () => {
		const wrapper = mountBar({ slideCount: 0 }),
			tabs = wrapper.findAll('.pptx-vue-mobile-tab');
		expect(tabs).toHaveLength(5);
		expect(tabs.every((tab) => tab.attributes('disabled') !== undefined)).toBeTruthy();
	});

	it('enables every tab once slides are loaded', () => {
		const wrapper = mountBar({ slideCount: 3 }),
			tabs = wrapper.findAll('.pptx-vue-mobile-tab');
		expect(tabs).toHaveLength(5);
		expect(tabs.every((tab) => tab.attributes('disabled') === undefined)).toBeTruthy();
	});
});
