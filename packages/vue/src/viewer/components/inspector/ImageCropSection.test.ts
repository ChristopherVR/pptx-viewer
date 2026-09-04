import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ImageCropSection from './ImageCropSection.vue';

/**
 * G7 (OpenXML parity audit, D3): `a:picLocks/@noCrop` was parsed and
 * round-tripped but never enforced - the crop sliders and reset button
 * stayed live/draggable regardless of the lock.
 */
function imageEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('imageCropSection with a:picLocks/@noCrop', () => {
	it('disables every crop slider and the reset button when noCrop is set', () => {
		const wrapper = mount(ImageCropSection, {
			props: { element: imageEl({ locks: { noCrop: true } } as Partial<PptxElement>) },
		});
		const sliders = wrapper.findAll('input[type="range"]');
		expect(sliders.length).toBeGreaterThan(0);
		for (const slider of sliders) {
			expect((slider.element as HTMLInputElement).disabled).toBeTruthy();
		}
		expect(
			(wrapper.get('.pptx-vue-image-crop__reset').element as HTMLButtonElement).disabled,
		).toBeTruthy();
	});

	it('ignores a slider input event while locked (defence in depth)', async () => {
		const wrapper = mount(ImageCropSection, {
			props: { element: imageEl({ locks: { noCrop: true } } as Partial<PptxElement>) },
		});
		await wrapper.get('input[type="range"]').setValue('40');
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('leaves the sliders enabled on an unlocked picture', () => {
		const wrapper = mount(ImageCropSection, { props: { element: imageEl() } });
		for (const slider of wrapper.findAll('input[type="range"]')) {
			expect((slider.element as HTMLInputElement).disabled).toBeFalsy();
		}
	});
});
