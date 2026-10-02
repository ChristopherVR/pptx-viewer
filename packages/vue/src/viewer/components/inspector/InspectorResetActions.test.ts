/**
 * #398: reset and clear actions share one gating contract
 * (`inspector-reset-actions` in pptx-viewer-shared) across all five bindings.
 */
import { mount } from '@vue/test-utils';
import type { MediaPptxElement, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartSeriesColorOptions from './ChartSeriesColorOptions.vue';
import ImageCropSection from './ImageCropSection.vue';
import ImagePanel from './ImagePanel.vue';
import MediaPropertiesPanel from './MediaPropertiesPanel.vue';
import SlideBackgroundPanel from './SlideBackgroundPanel.vue';

const picture = (extra: object = {}): PptxElement =>
	({ id: 'p', type: 'image', x: 0, y: 0, width: 10, height: 10, ...extra }) as PptxElement;
const media = (extra: Partial<MediaPptxElement> = {}): MediaPptxElement => ({
	type: 'media',
	id: 'm',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	mediaType: 'video',
	...extra,
});

describe('vue inspector reset and clear actions', () => {
	it('reset Picture honours canEdit', () => {
		const el = picture({ imageEffects: { brightness: 5 } });
		const editable = mount(ImagePanel, { props: { element: el } });
		const locked = mount(ImagePanel, { props: { element: el, canEdit: false } });
		const sel = '.pptx-vue-image-panel__reset-picture';
		expect((editable.get(sel).element as HTMLButtonElement).disabled).toBeFalsy();
		expect((locked.get(sel).element as HTMLButtonElement).disabled).toBeTruthy();
	});

	it('reset Crop zeroes the insets', async () => {
		const wrapper = mount(ImageCropSection, { props: { element: picture() } });
		await wrapper.get('.pptx-vue-image-crop__reset').trigger('click');
		expect(wrapper.emitted('update')?.[0]).toStrictEqual([
			{ cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 },
		]);
		const locked = mount(ImageCropSection, { props: { element: picture(), canEdit: false } });
		expect(
			(locked.get('.pptx-vue-image-crop__reset').element as HTMLButtonElement).disabled,
		).toBeTruthy();
	});

	it('reset trim exists only for editable trimmed media and zeroes both ends', async () => {
		const find = (w: ReturnType<typeof mount>) =>
			w.findAll('button').find((b) => b.text() === 'Reset trim');
		expect(
			find(mount(MediaPropertiesPanel, { props: { element: media(), canEdit: true } })),
		).toBeUndefined();
		expect(
			find(
				mount(MediaPropertiesPanel, {
					props: { element: media({ trimStartMs: 500 }), canEdit: false },
				}),
			),
		).toBeUndefined();
		const wrapper = mount(MediaPropertiesPanel, {
			props: { element: media({ trimEndMs: 500 }), canEdit: true },
		});
		await find(wrapper)!.trigger('click');
		expect(wrapper.emitted('update')?.at(-1)).toStrictEqual([{ trimStartMs: 0, trimEndMs: 0 }]);
	});

	it('clear series colour is shown per coloured series and emits clearColor', async () => {
		const wrapper = mount(ChartSeriesColorOptions, {
			props: {
				series: [
					{ name: 'S1', values: [1], color: '#ff0000' },
					{ name: 'S2', values: [1] },
				],
			},
		});
		const clears = wrapper.findAll('.pptx-vue-chart-clear');
		expect(clears).toHaveLength(1);
		await clears[0].trigger('click');
		expect(wrapper.emitted('clearColor')?.[0]).toStrictEqual([0]);
		const locked = mount(ChartSeriesColorOptions, {
			props: { series: [{ name: 'S1', values: [1], color: '#ff0000' }], canEdit: false },
		});
		expect(locked.find('.pptx-vue-chart-clear').exists()).toBeFalsy();
	});

	it('clear Background is disabled when not editable', () => {
		const slide = {
			id: 's',
			elements: [],
			backgroundPattern: { preset: 'x' },
		} as unknown as PptxSlide;
		const wrapper = mount(SlideBackgroundPanel, { props: { slide, canEdit: false } });
		const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear Background');
		expect((clear!.element as HTMLButtonElement).disabled).toBeTruthy();
	});
});
