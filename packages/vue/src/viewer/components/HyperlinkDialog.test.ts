import { mount } from '@vue/test-utils';
import type { PptxAction, PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import HyperlinkDialog from './HyperlinkDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

function element(actionClick?: PptxAction): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		actionClick,
	} as PptxElement;
}

function urlInput(): HTMLInputElement {
	const input = document.body.querySelector<HTMLInputElement>('input[type="url"]');
	if (!input) {
		throw new Error('url input not found');
	}
	return input;
}

function clickButton(label: string): void {
	const btn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
		(b) => b.textContent?.trim() === label,
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	btn.click();
}

describe('hyperlinkDialog', () => {
	it('prefills the current URL and tooltip when opened', () => {
		mount(HyperlinkDialog, {
			props: {
				open: true,
				element: element({ url: 'https://existing.test', tooltip: 'Go there' }),
			},
			attachTo: document.body,
		});
		expect(urlInput().value).toBe('https://existing.test');
		const tooltipInput = document.body.querySelector<HTMLInputElement>('input[type="text"]');
		expect(tooltipInput?.value).toBe('Go there');
	});

	it('emits a save patch that sets actionClick.url on Apply', async () => {
		const wrapper = mount(HyperlinkDialog, {
			props: { open: true, element: element() },
			attachTo: document.body,
		});

		const input = urlInput();
		input.value = 'https://new.test';
		input.dispatchEvent(new Event('input'));
		await wrapper.vm.$nextTick();

		clickButton('Apply');
		await wrapper.vm.$nextTick();

		const saved = wrapper.emitted('save');
		expect(saved).toHaveLength(1);
		const patch = saved?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.actionClick?.url).toBe('https://new.test');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('emits a clearing patch (actionClick: undefined) on Remove link', async () => {
		const wrapper = mount(HyperlinkDialog, {
			props: {
				open: true,
				element: element({ url: 'https://existing.test' }),
			},
			attachTo: document.body,
		});

		clickButton('Remove link');
		await wrapper.vm.$nextTick();

		const saved = wrapper.emitted('save');
		expect(saved).toHaveLength(1);
		const patch = saved?.[0]?.[0] as Partial<PptxElement>;
		expect('actionClick' in patch).toBeTruthy();
		expect(patch.actionClick).toBeUndefined();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('treats an emptied URL as a clear on Apply', async () => {
		const wrapper = mount(HyperlinkDialog, {
			props: {
				open: true,
				element: element({ url: 'https://existing.test' }),
			},
			attachTo: document.body,
		});

		const input = urlInput();
		input.value = '';
		input.dispatchEvent(new Event('input'));
		await wrapper.vm.$nextTick();

		clickButton('Apply');
		await wrapper.vm.$nextTick();

		const patch = wrapper.emitted('save')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.actionClick).toBeUndefined();
	});

	it('emits the OOXML jump verb when a navigation action type is chosen', async () => {
		const wrapper = mount(HyperlinkDialog, {
			props: { open: true, element: element() },
			attachTo: document.body,
		});

		// The action-type selector drives the emitted action: pick "Next Slide".
		const select = document.body.querySelector<HTMLSelectElement>('select');
		if (!select) {
			throw new Error('action-type select not found');
		}
		select.value = 'nextSlide';
		select.dispatchEvent(new Event('change'));
		await wrapper.vm.$nextTick();

		clickButton('Apply');
		await wrapper.vm.$nextTick();

		const patch = wrapper.emitted('save')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.actionClick?.action).toBe('ppaction://hlinkshowjump?jump=nextslide');
	});

	it('prefills a slide-jump action as the "Go to Slide" type', () => {
		mount(HyperlinkDialog, {
			props: {
				open: true,
				element: element({ action: 'ppaction://hlinksldjump', targetSlideIndex: 2 }),
			},
			attachTo: document.body,
		});
		const select = document.body.querySelector<HTMLSelectElement>('select');
		expect(select?.value).toBe('slide');
	});
});
