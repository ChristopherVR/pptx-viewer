// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import FillPanel from './FillPanel.vue';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle: { fillMode: 'solid', fillColor: '#00aa55', fillOpacity: 1 },
		...overrides,
	} as PptxElement;
}

function media(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'media',
		id: 'md 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxElement> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxElement>;
}

describe('fillPanel', () => {
	it('shows the muted note for non-shape elements', () => {
		const wrapper = mount(FillPanel, { props: { element: media() } });
		expect(wrapper.text()).toContain('No fill options');
		expect(wrapper.find('select').exists()).toBeFalsy();
	});

	it('emits the full merged shapeStyle when fill mode changes', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const select = wrapper.find('select');
		await select.setValue('none');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'none', fillColor: '#00aa55', fillOpacity: 1 },
		});
	});

	it('emits the full merged shapeStyle when color changes', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const color = wrapper.find('input[type="color"]');
		await color.setValue('#123456');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'solid', fillColor: '#123456', fillOpacity: 1 },
		});
	});

	it('stores opacity as a 0-1 fraction from the 0-100 slider', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const range = wrapper.find('input[type="range"]');
		await range.setValue('40');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'solid', fillColor: '#00aa55', fillOpacity: 0.4 },
		});
	});
});
