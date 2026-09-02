import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { STROKE_DASH_OPTIONS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import StrokePanel from './StrokePanel.vue';

function shapeEl(shapeStyle?: ShapeStyle): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	} as PptxElement;
}

describe('strokePanel', () => {
	it('shows a muted note for elements without shape properties', () => {
		const wrapper = mount(StrokePanel, {
			props: { element: { type: 'chart', id: 'c1' } as PptxElement },
		});
		expect(wrapper.find('.pptx-vue-stroke-muted').exists()).toBeTruthy();
		expect(wrapper.find('input[type="color"]').exists()).toBeFalsy();
	});

	it('renders current stroke values from shapeStyle', () => {
		const wrapper = mount(StrokePanel, {
			props: { element: shapeEl({ strokeColor: '#ff0000', strokeWidth: 3, strokeDash: 'dash' }) },
		});
		expect((wrapper.find('input[type="color"]').element as HTMLInputElement).value).toBe('#ff0000');
		expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('3');
		expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('dash');
	});

	it('emits a full merged shapeStyle patch when color changes', async () => {
		const wrapper = mount(StrokePanel, {
			props: { element: shapeEl({ strokeWidth: 2, fillColor: '#abcdef' } as ShapeStyle) },
		});
		const color = wrapper.find('input[type="color"]');
		(color.element as HTMLInputElement).value = '#00ff00';
		await color.trigger('input');

		const events = wrapper.emitted('update');
		expect(events).toBeTruthy();
		const patch = events?.[0]?.[0] as Partial<PptxElement>;
		expect(patch).toStrictEqual({
			shapeStyle: { strokeWidth: 2, fillColor: '#abcdef', strokeColor: '#00ff00' },
		});
	});

	it('emits a clamped numeric strokeWidth', async () => {
		const wrapper = mount(StrokePanel, { props: { element: shapeEl({}) } });
		const num = wrapper.find('input[type="number"]');
		(num.element as HTMLInputElement).value = '-5';
		await num.trigger('input');

		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		expect(patch).toStrictEqual({ shapeStyle: { strokeWidth: 0 } });
	});

	it('emits the selected strokeDash value', async () => {
		const wrapper = mount(StrokePanel, { props: { element: shapeEl({}) } });
		const select = wrapper.find('select');
		await select.setValue('sysDot');

		const patch = wrapper.emitted('update')?.at(-1)?.[0] as Partial<PptxElement>;
		expect(patch).toStrictEqual({ shapeStyle: { strokeDash: 'sysDot' } });
	});

	it('offers the full shared dash-pattern catalogue, in shared order', () => {
		const wrapper = mount(StrokePanel, { props: { element: shapeEl({}) } });
		const values = wrapper
			.findAll('select option')
			.map((o) => (o.element as HTMLOptionElement).value);
		expect(values).toStrictEqual(STROKE_DASH_OPTIONS.map((o) => o.value));
	});
});
