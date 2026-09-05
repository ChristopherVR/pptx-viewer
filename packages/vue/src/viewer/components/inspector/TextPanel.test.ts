import { mount } from '@vue/test-utils';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import { ThemeColorMapKey } from '../../composables/theme-color-map-context';
import TextPanel from './TextPanel.vue';

const OFFICE_THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

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
			props: {
				element: textEl({
					fontSize: 48.1 * (96 / 72),
					color: '#112233',
					fontFamily: 'Georgia',
				}),
			},
		});
		const size = wrapper.find('input[type="number"]').element as HTMLInputElement;
		expect(size.value).toBe('48.1');
		expect(size.step).toBe('any');
		expect((wrapper.find('input[type="color"]').element as HTMLInputElement).value).toBe('#112233');
		expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('Georgia');
	});

	it('emits a full merged textStyle patch when size changes', async () => {
		const element = textEl({ bold: true, color: '#000000' });
		element.textSegments = [{ text: 'Hello', style: { fontSize: 16, italic: true } }];
		const wrapper = mount(TextPanel, { props: { element } });
		const num = wrapper.find('input[type="number"]');
		(num.element as HTMLInputElement).value = '48.1';
		await num.trigger('input');

		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.textStyle).toMatchObject({ bold: true, color: '#000000' });
		expect(patch.textStyle?.fontSize).toBeCloseTo(48.1 * (96 / 72));
		expect(patch.textSegments?.[0]?.style).toMatchObject({ italic: true });
		expect(patch.textSegments?.[0]?.style.fontSize).toBeCloseTo(48.1 * (96 / 72));
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

describe('textPanel theme colour picker', () => {
	it('commits both the resolved hex and the ref on a theme swatch click', async () => {
		const wrapper = mount(TextPanel, {
			props: { element: textEl({ color: '#000000' }) },
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});
		const accent1 = wrapper.get('button[title="Accent 1"]');
		await accent1.trigger('click');
		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.textStyle).toMatchObject({ color: '#4472c4', colorRef: { scheme: 'accent1' } });
	});

	it('clears a previously-stored ref when the native colour input changes', async () => {
		const wrapper = mount(TextPanel, {
			props: {
				element: textEl({ color: '#4472c4', colorRef: { scheme: 'accent1' } }),
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});
		const color = wrapper.find('input[type="color"]');
		await color.setValue('#ff0000');
		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch.textStyle?.colorRef).toBeFalsy();
	});
});
