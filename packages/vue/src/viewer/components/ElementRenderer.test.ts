import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';

function mountEl(element: PptxElement) {
	return mount(ElementRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
}

describe('elementRenderer', () => {
	it('renders a text element with its content and position', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 't1',
			x: 5,
			y: 6,
			width: 100,
			height: 40,
			text: 'Hello world',
		} as PptxElement);
		expect(wrapper.text()).toContain('Hello world');
		const root = wrapper.get('[data-element-id="t1"]');
		expect(root.attributes('style')).toContain('left: 5px');
		expect(root.attributes('style')).toContain('top: 6px');
	});

	it('renders rich text segments as styled runs', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 't2',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [
				{ text: 'Bold', style: { bold: true } },
				{ text: ' plain', style: {} },
			],
		} as PptxElement);
		const spans = wrapper.findAll('span');
		expect(spans.length).toBeGreaterThanOrEqual(2);
		expect(spans[0].attributes('style')).toContain('font-weight: bold');
		expect(wrapper.text()).toContain('Bold');
		expect(wrapper.text()).toContain('plain');
	});

	it('renders a picture element as an <img> from imageData', () => {
		const wrapper = mountEl({
			type: 'picture',
			id: 'p1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AAAA',
		} as PptxElement);
		const img = wrapper.get('img');
		expect(img.attributes('src')).toBe('data:image/png;base64,AAAA');
	});

	it('recurses into group children', () => {
		const wrapper = mountEl({
			type: 'group',
			id: 'g1',
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			children: [{ type: 'text', id: 'c1', x: 0, y: 0, width: 50, height: 20, text: 'child' }],
		} as PptxElement);
		expect(wrapper.find('[data-element-id="c1"]').exists()).toBeTruthy();
		expect(wrapper.text()).toContain('child');
	});

	it('renders a placeholder for not-yet-ported types', () => {
		const wrapper = mountEl({
			type: 'chart',
			id: 'ch1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement);
		expect(wrapper.find('.pptx-vue-placeholder').text()).toBe('Chart');
	});
});
