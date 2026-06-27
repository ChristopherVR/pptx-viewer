import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { GALLERY_THEME_PRESETS } from './theme-gallery-presets';
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
		// One button per gallery preset (+ the Close button has no title).
		// The gallery mirrors React's exact 10-theme set and order.
		expect(titles).toStrictEqual([
			'Office',
			'Facet',
			'Integral',
			'Ion',
			'Retrospect',
			'Organic',
			'Wisp',
			'Berlin',
			'Slice',
			'Dividend',
		]);
		expect(titles).toHaveLength(GALLERY_THEME_PRESETS.length);
		expect(GALLERY_THEME_PRESETS).toHaveLength(10);
		// React adds wisp/berlin/slice/dividend and omits core's slate/metropolitan.
		expect(titles).toContain('Wisp');
		expect(titles).toContain('Berlin');
		expect(titles).toContain('Slice');
		expect(titles).toContain('Dividend');
		expect(titles).not.toContain('Slate');
		expect(titles).not.toContain('Metropolitan');
		wrapper.unmount();
	});

	it('emits apply with the chosen preset after selecting then applying', async () => {
		const wrapper = mount(ThemeGallery, { props: { open: true }, attachTo: document.body });
		// Select-then-apply (mirrors React): click the thumbnail, then Apply.
		const office = document.querySelector(
			'[aria-label="Theme gallery"] button[title="Office"]',
		) as HTMLButtonElement | null;
		office?.click();
		await wrapper.vm.$nextTick();
		// Clicking a thumbnail only selects it; nothing is applied yet.
		expect(wrapper.emitted('apply')).toBeFalsy();
		const apply = [...document.querySelectorAll('[aria-label="Theme gallery"] button')].find(
			(b) => b.textContent?.trim() === 'Apply',
		) as HTMLButtonElement | undefined;
		apply?.click();
		await wrapper.vm.$nextTick();
		const applied = wrapper.emitted('apply')?.[0]?.[0] as { id: string } | undefined;
		expect(applied?.id).toBe('office');
		wrapper.unmount();
	});
});
