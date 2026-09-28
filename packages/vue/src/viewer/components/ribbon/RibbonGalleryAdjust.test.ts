import { mount } from '@vue/test-utils';
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, nextTick, shallowRef } from 'vue';

import {
	dispatchRibbonGalleryResult,
	RibbonGalleryHostKey,
} from '../../composables/useRibbonGalleryHost';
import type { RibbonGalleryHost } from '../../composables/useRibbonGalleryHost';
import { createRibbonPropsFixture } from './ribbon-props-fixture';
import RibbonGallery from './RibbonGallery.vue';
import RibbonToolbar from './RibbonToolbar.vue';

/**
 * Picture Format > Adjust: the Corrections, Color and Artistic Effects
 * dropdown galleries over a real picture, through the real shared galleries.
 */
function picture(): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: {},
	} as unknown as PptxElement;
}

function makeHost() {
	const element = shallowRef<PptxElement | null>(picture());
	const updateElement = vi.fn((id: string, patch: Partial<PptxElement>) => {
		if (element.value?.id === id) {
			element.value = { ...element.value, ...patch } as PptxElement;
		}
	});
	const host: RibbonGalleryHost = {
		context: computed(() => ({ element: element.value, themeColorMap: { accent1: '#156082' } })),
		dispatch: (result) =>
			dispatchRibbonGalleryResult(result, { updateElement, applyTheme: vi.fn() }),
	};
	return { host, element, updateElement };
}

const CONTROLS = {
	pictureCorrections: 'pictureFormat.adjust.corrections',
	pictureColor: 'pictureFormat.adjust.color',
	pictureArtisticEffects: 'pictureFormat.adjust.artisticEffects',
} as const;

describe('picture adjust galleries', () => {
	it.each([
		['pictureCorrections', 'soften50', 'sharpenSoften', { amount: -50000 }],
		['pictureColor', 'saturation200', 'colorSaturation', { sat: 200000 }],
		['pictureColor', 'recolorGrayscale', 'grayscale', true],
		['pictureArtisticEffects', 'paintStrokes', 'artisticEffect', 'paintStrokes'],
	] as const)(
		'%s pick %s updates imageEffects.%s and marks the tile',
		async (gallery, item, key, value) => {
			const { host, element, updateElement } = makeHost();
			const wrapper = mount(RibbonGallery, {
				props: { gallery, control: CONTROLS[gallery], mode: 'dropdown' },
				global: { provide: { [RibbonGalleryHostKey as symbol]: host } },
				attachTo: document.body,
			});
			const trigger = wrapper.get(`[data-ribbon-gallery="${gallery}"]`);
			expect(trigger.attributes('disabled')).toBeUndefined();
			await trigger.trigger('click');
			const popup = wrapper.get(`[data-ribbon-gallery-popup="${gallery}"]`);
			expect(popup.find('svg').exists()).toBeTruthy();
			await popup.get(`[data-gallery-item="${item}"]`).trigger('click');
			expect(updateElement).toHaveBeenCalledOnce();
			expect(updateElement.mock.calls[0][0]).toBe('p1');
			const effects = (element.value as { imageEffects?: PptxImageEffects }).imageEffects;
			expect(effects?.[key as keyof PptxImageEffects]).toStrictEqual(value);
			await nextTick();
			await wrapper.get(`[data-ribbon-gallery="${gallery}"]`).trigger('click');
			expect(wrapper.get(`[data-gallery-item="${item}"]`).attributes('aria-pressed')).toBe('true');
			wrapper.unmount();
		},
	);

	it('mounts the Adjust group on the Picture Format tab', () => {
		const wrapper = mount(RibbonToolbar, {
			props: createRibbonPropsFixture({
				toolbarSection: 'pictureFormat',
				selectedElement: picture(),
			}),
		});
		expect(wrapper.find('[data-ribbon-group="pictureFormat.adjust"]').exists()).toBeTruthy();
		for (const control of Object.values(CONTROLS)) {
			expect(wrapper.find(`[data-ribbon-control="${control}"]`).exists()).toBeTruthy();
		}
		wrapper.unmount();
	});
});
