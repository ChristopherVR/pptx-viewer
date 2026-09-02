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

describe('action settings panel: custom show target', () => {
	const customShows = [
		{ id: 'show-1', name: 'Short Show', slideRIds: ['rId2'] },
		{ id: 'show-2', name: 'Reverse', slideRIds: ['rId4', 'rId3'] },
	];

	it('reveals the custom-show picker as soon as "Custom show" is picked, uncommitted', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element: bare, slideCount: 5, customShows },
		});
		await wrapper.findAll('select')[0].setValue('customShow');

		const picker = wrapper.find('[data-testid="pptx-action-custom-show"]');
		expect(picker.exists()).toBeTruthy();
		expect(wrapper.findAll('[data-testid="pptx-action-custom-show"] option')).toHaveLength(3); // placeholder + 2 shows
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('commits customShowId once a show is picked', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element: bare, slideCount: 5, customShows },
		});
		await wrapper.findAll('select')[0].setValue('customShow');
		await wrapper.find('[data-testid="pptx-action-custom-show"]').setValue('show-2');

		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { action: expect.stringContaining('id=show-2') },
		});
	});

	it('the return-after checkbox commits returnAfter alongside the existing customShowId', async () => {
		const withShow = {
			...bare,
			actionClick: { action: 'ppaction://customshow?id=show-1' },
		};
		const wrapper = mount(ActionSettingsPanel, {
			props: { element: withShow, slideCount: 5, customShows },
		});
		const checkbox = wrapper.find('[data-testid="pptx-action-custom-show-return"]');
		expect(checkbox.exists()).toBeTruthy();
		await checkbox.setValue(true);

		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { action: expect.stringMatching(/id=show-1.*return=true/u) },
		});
	});

	it('the return-after checkbox is a no-op with no customShowId committed yet', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element: bare, slideCount: 5, customShows },
		});
		await wrapper.findAll('select')[0].setValue('customShow');
		await wrapper.find('[data-testid="pptx-action-custom-show-return"]').setValue(true);
		expect(wrapper.emitted('update')).toBeUndefined();
	});
});

describe('action settings panel: openFile / openPresentation', () => {
	it('reuses the url target field for openFile, and commits immediately with no target', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('openFile');
		// Unlike url/slide/customShow, openFile has no "round-trips to none"
		// failure mode, so picking it alone is already a committed action.
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { action: expect.stringContaining('hlinkfile') },
		});

		const target = wrapper.find('input[type="text"]');
		expect(target.exists()).toBeTruthy();
		await target.setValue('C:\\reports\\q3.xlsx');
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { url: 'C:\\reports\\q3.xlsx' },
		});
	});

	it('reuses the url target field for openPresentation', async () => {
		const wrapper = mount(ActionSettingsPanel, { props: { element: bare, slideCount: 5 } });
		await wrapper.findAll('select')[0].setValue('openPresentation');
		await wrapper.find('input[type="text"]').setValue('other-deck.pptx');
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { action: expect.stringContaining('hlinkpres'), url: 'other-deck.pptx' },
		});
	});
});
