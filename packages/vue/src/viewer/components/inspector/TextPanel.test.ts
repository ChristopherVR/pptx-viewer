import { mount } from '@vue/test-utils';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import TextPanel from './TextPanel.vue';

function textEl(textStyle?: TextStyle): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		textStyle,
	} as PptxElement;
}

describe('textPanel', () => {
	it('shows a muted note for elements without text properties', () => {
		const wrapper = mount(TextPanel, {
			props: { element: { type: 'image', id: 'i1' } as PptxElement },
		});
		expect(wrapper.find('.pptx-vue-text-muted').exists()).toBeTruthy();
		expect(wrapper.find('select').exists()).toBeFalsy();
	});

	it('renders current font size and color', () => {
		const wrapper = mount(TextPanel, {
			props: { element: textEl({ fontSize: 24, color: '#112233', fontFamily: 'Georgia' }) },
		});
		expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('24');
		expect((wrapper.find('input[type="color"]').element as HTMLInputElement).value).toBe('#112233');
		expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('Georgia');
	});

	it('emits a full merged textStyle patch when size changes', async () => {
		const wrapper = mount(TextPanel, {
			props: { element: textEl({ bold: true, color: '#000000' }) },
		});
		const num = wrapper.find('input[type="number"]');
		(num.element as HTMLInputElement).value = '32';
		await num.trigger('input');

		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch).toStrictEqual({ textStyle: { bold: true, color: '#000000', fontSize: 32 } });
	});

	it('toggles bold against current textStyle', async () => {
		const wrapper = mount(TextPanel, { props: { element: textEl({ bold: true }) } });
		const boldBtn = wrapper.findAll('.pptx-vue-text-toggle')[0];
		await boldBtn.trigger('click');

		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch).toStrictEqual({ textStyle: { bold: false } });
	});

	it('emits align and vAlign field names', async () => {
		const wrapper = mount(TextPanel, { props: { element: textEl({}) } });
		const buttons = wrapper.findAll('.pptx-vue-text-toggle');
		// toggles: B I U S | Left Center Right Justify | Top Middle Bottom
		await buttons[5].trigger('click'); // Center
		await buttons[9].trigger('click'); // Middle

		const events = wrapper.emitted('update');
		expect(events?.[0]?.[0]).toStrictEqual({ textStyle: { align: 'center' } });
		expect(events?.[1]?.[0]).toStrictEqual({ textStyle: { vAlign: 'middle' } });
	});

	it('pushes a committed text colour onto the injected recent-colours list and offers it back', async () => {
		const recent = ref<string[]>(['#112233']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mount(TextPanel, {
			props: { element: textEl({ color: '#000000' }) },
			global: { provide: { [RecentColorsKey as symbol]: { recent, push } } },
		});

		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeTruthy();

		const color = wrapper.find('input[type="color"]');
		await color.setValue('#00ff00');
		expect(recent.value[0]).toBe('#00ff00');
	});
});
