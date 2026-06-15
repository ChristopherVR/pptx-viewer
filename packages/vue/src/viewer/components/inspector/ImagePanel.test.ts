import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ImagePanel from './ImagePanel.vue';

function imageEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function shapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 'sh 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

describe('imagePanel', () => {
	it('shows a muted note for non-image elements', () => {
		const wrapper = mount(ImagePanel, { props: { element: shapeEl() } });
		expect(wrapper.find('.pptx-vue-image-panel__note').exists()).toBeTruthy();
		expect(wrapper.find('input').exists()).toBeFalsy();
	});

	it('renders alt text and emits a shallow patch on input', async () => {
		const wrapper = mount(ImagePanel, {
			props: { element: imageEl({ altText: 'hello' } as Partial<PptxElement>) },
		});
		const input = wrapper.get('input[type="text"]');
		expect((input.element as HTMLInputElement).value).toBe('hello');

		await input.setValue('logo');
		const events = wrapper.emitted('update');
		expect(events).toBeTruthy();
		expect(events?.at(-1)?.[0]).toStrictEqual({ altText: 'logo' });
	});

	it('emits the full merged imageEffects sub-object on brightness change', async () => {
		const wrapper = mount(ImagePanel, {
			props: {
				element: imageEl({ imageEffects: { contrast: 25 } } as Partial<PptxElement>),
			},
		});
		const brightness = wrapper.get('input[type="range"]');
		await brightness.setValue('40');

		const events = wrapper.emitted('update');
		expect(events?.at(-1)?.[0]).toStrictEqual({ imageEffects: { contrast: 25, brightness: 40 } });
	});

	it('reflects existing effect values on the sliders', () => {
		const wrapper = mount(ImagePanel, {
			props: {
				element: imageEl({
					imageEffects: { brightness: -30, contrast: 10, saturation: 50 },
				} as Partial<PptxElement>),
			},
		});
		const ranges = wrapper.findAll('input[type="range"]');
		expect((ranges[0].element as HTMLInputElement).value).toBe('-30');
		expect((ranges[1].element as HTMLInputElement).value).toBe('10');
		expect((ranges[2].element as HTMLInputElement).value).toBe('50');
	});

	it('hides reset until effects exist and clears them when clicked', async () => {
		const without = mount(ImagePanel, { props: { element: imageEl() } });
		expect(without.find('.pptx-vue-image-panel__reset').exists()).toBeFalsy();

		const withFx = mount(ImagePanel, {
			props: { element: imageEl({ imageEffects: { brightness: 5 } } as Partial<PptxElement>) },
		});
		const reset = withFx.get('.pptx-vue-image-panel__reset');
		await reset.trigger('click');
		const events = withFx.emitted('update');
		expect(events?.at(-1)?.[0]).toStrictEqual({ imageEffects: undefined });
	});
});
