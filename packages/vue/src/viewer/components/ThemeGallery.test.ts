import { mount } from '@vue/test-utils';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ThemeGallery from './ThemeGallery.vue';

describe('themeGallery', () => {
	it('renders nothing when closed', () => {
		const wrapper = mount(ThemeGallery, { props: { open: false } });
		expect(wrapper.find('[aria-label="Theme gallery"]').exists()).toBeFalsy();
	});

	it('renders a thumbnail per built-in preset when open', () => {
		const wrapper = mount(ThemeGallery, { props: { open: true }, attachTo: document.body });
		const gallery = document.querySelector('[aria-label="Theme gallery"]');
		const titles = gallery
			? [...gallery.querySelectorAll('button[title]')].map((b) => b.getAttribute('title'))
			: [];
		// One button per preset (+ the Close button has no title).
		expect(titles).toContain('Office');
		expect(titles).toHaveLength(THEME_PRESETS.length);
		wrapper.unmount();
	});

	it('emits apply with the chosen preset', async () => {
		const wrapper = mount(ThemeGallery, { props: { open: true }, attachTo: document.body });
		const office = document.querySelector(
			'[aria-label="Theme gallery"] button[title="Office"]',
		) as HTMLButtonElement | null;
		office?.click();
		await wrapper.vm.$nextTick();
		const applied = wrapper.emitted('apply')?.[0]?.[0] as { id: string } | undefined;
		expect(applied?.id).toBe('office');
		wrapper.unmount();
	});
});
