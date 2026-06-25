import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import SlideBackgroundPanel from './SlideBackgroundPanel.vue';

function slide(over: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', elements: [], ...over } as PptxSlide;
}

describe('slideBackgroundPanel', () => {
	it('emits a backgroundColor patch on colour change', async () => {
		const wrapper = mount(SlideBackgroundPanel, { props: { slide: slide() } });
		const input = wrapper.get('input[type="color"]');
		(input.element as HTMLInputElement).value = '#ff0000';
		await input.trigger('change');
		expect(wrapper.emitted('update')?.[0]).toStrictEqual([{ backgroundColor: '#ff0000' }]);
	});

	it('shows Replace Image and a preview when a background image is set', () => {
		const wrapper = mount(SlideBackgroundPanel, {
			props: { slide: slide({ backgroundImage: 'data:image/png;base64,AAAA' }) },
		});
		expect(wrapper.text()).toContain('Replace Image');
		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,AAAA');
	});

	it('emits an undefined backgroundImage patch when removing the image', async () => {
		const wrapper = mount(SlideBackgroundPanel, {
			props: { slide: slide({ backgroundImage: 'data:image/png;base64,AAAA' }) },
		});
		await wrapper.get('button[title="Remove background image"]').trigger('click');
		expect(wrapper.emitted('update')?.[0]).toStrictEqual([{ backgroundImage: undefined }]);
	});

	it('shows Clear Background only when a background exists and clears all fields', async () => {
		const empty = mount(SlideBackgroundPanel, { props: { slide: slide() } });
		expect(empty.text()).not.toContain('Clear Background');

		const wrapper = mount(SlideBackgroundPanel, {
			props: { slide: slide({ backgroundColor: '#123456' }) },
		});
		const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear Background');
		expect(clear).toBeDefined();
		await clear!.trigger('click');
		expect(wrapper.emitted('update')?.[0]).toStrictEqual([
			{ backgroundColor: undefined, backgroundImage: undefined, backgroundGradient: undefined },
		]);
	});

	it('disables controls when canEdit is false', () => {
		const wrapper = mount(SlideBackgroundPanel, {
			props: { slide: slide(), canEdit: false },
		});
		expect((wrapper.get('input[type="color"]').element as HTMLInputElement).disabled).toBeTruthy();
	});
});
