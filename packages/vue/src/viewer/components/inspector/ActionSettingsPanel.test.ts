import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ActionSettingsPanel from './ActionSettingsPanel.vue';

const element = {
	id: 'shape-1',
	type: 'shape' as const,
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	actionClick: { url: 'https://example.com' },
};

const bare = { ...element, actionClick: undefined };

describe('action settings panel', () => {
	it('edits URL actions through the core action mapping', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element, slideCount: 5 },
		});
		const url = wrapper.find('input[type="url"]');
		await url.setValue('https://openai.com');
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { url: 'https://openai.com' },
		});
	});

	it('reveals the URL input as soon as "Go to URL" is picked', async () => {
		// A target-less url action serialises to an empty action that parses back
		// as "none", so without the pending-type rule the select would snap back
		// and this input would never appear.
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		expect(wrapper.find('input[type="url"]').exists()).toBeFalsy();

		await wrapper.findAll('select')[0].setValue('url');

		expect(wrapper.find('input[type="url"]').exists()).toBeTruthy();
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('round-trips the url once a target is entered', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('url');
		await wrapper.find('input[type="url"]').setValue('https://example.org/');

		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { url: 'https://example.org/' },
		});
		await wrapper.setProps({ element: { ...bare, actionClick: { url: 'https://example.org/' } } });
		expect(wrapper.findAll('select')[0].element.value).toBe('url');
		expect(wrapper.find<HTMLInputElement>('input[type="url"]').element.value).toBe(
			'https://example.org/',
		);
	});

	it('reveals the slide spinner as soon as "Go to Slide" is picked', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[1].setValue('slide');

		expect(wrapper.find('input[type="number"]').exists()).toBeTruthy();
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('writes a zero-based internal slide target', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element: bare, slideCount: 5 },
		});
		await wrapper.findAll('select')[1].setValue('slide');
		await wrapper.find('input[type="number"]').setValue(4);
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionHover: { targetSlideIndex: 3 },
		});
	});

	it('clamps a slide number past the end of the deck', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('slide');
		await wrapper.find('input[type="number"]').setValue(99);
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { targetSlideIndex: 4 },
		});
	});

	it('drops a half-made pick when the inspector moves to another element', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('url');
		expect(wrapper.find('input[type="url"]').exists()).toBeTruthy();

		await wrapper.setProps({ element: { ...bare, id: 'shape-2' } });

		expect(wrapper.find('input[type="url"]').exists()).toBeFalsy();
		expect(wrapper.findAll('select')[0].element.value).toBe('none');
	});

	it('commits a target-free navigation action immediately', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('nextSlide');
		expect(JSON.stringify(wrapper.emitted('update')?.at(-1)?.[0])).toContain('nextslide');
	});
});
