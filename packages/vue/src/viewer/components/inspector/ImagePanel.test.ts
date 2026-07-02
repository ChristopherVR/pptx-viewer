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

	it('relays the full merged imageEffects sub-object on brightness change', async () => {
		const wrapper = mount(ImagePanel, {
			props: {
				element: imageEl({ imageEffects: { contrast: 25 } } as Partial<PptxElement>),
			},
		});
		// The brightness slider lives in the child ImageAdjustmentsPanel; its
		// first range input is Brightness. ImagePanel relays the child's patch.
		const brightness = wrapper.get('.pptx-vue-image-adjust__slider input[type="range"]');
		await brightness.setValue('40');

		const events = wrapper.emitted('update');
		expect(events?.at(-1)?.[0]).toStrictEqual({ imageEffects: { contrast: 25, brightness: 40 } });
	});

	it('toggles grayscale into the merged imageEffects sub-object', async () => {
		const wrapper = mount(ImagePanel, {
			props: {
				element: imageEl({ imageEffects: { contrast: 10 } } as Partial<PptxElement>),
			},
		});
		const grayscale = wrapper.get('.pptx-vue-image-panel__grayscale');
		await grayscale.setValue(true);

		const events = wrapper.emitted('update');
		expect(events?.at(-1)?.[0]).toStrictEqual({ imageEffects: { contrast: 10, grayscale: true } });
	});

	it('hides Reset Picture until an effect or crop exists and clears everything when clicked', async () => {
		const clean = mount(ImagePanel, { props: { element: imageEl() } });
		expect(clean.find('.pptx-vue-image-panel__reset-picture').exists()).toBeFalsy();

		const dirty = mount(ImagePanel, {
			props: { element: imageEl({ imageEffects: { brightness: 5 } } as Partial<PptxElement>) },
		});
		const reset = dirty.get('.pptx-vue-image-panel__reset-picture');
		await reset.trigger('click');
		const events = dirty.emitted('update');
		expect(events?.at(-1)?.[0]).toStrictEqual({
			imageEffects: undefined,
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
	});
});
