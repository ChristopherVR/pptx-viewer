import { mount } from '@vue/test-utils';
import type { ContentPartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ContentPartRenderer from './ContentPartRenderer.vue';
import ElementRenderer from './ElementRenderer.vue';

/**
 * Vue had no `contentPart` branch at all: the element fell through to the
 * "unsupported" placeholder, and `ElementRenderer.test.ts` asserted that as the
 * expected outcome. Now that real PowerPoint ink reaches the InkML decoder
 * (`e2e/fixtures/ink-contentpart.pptx`), that placeholder is what a user would
 * actually have seen on any inked slide.
 */
const inked = (): ContentPartPptxElement =>
	({
		id: 'cp1',
		type: 'contentPart',
		x: 0,
		y: 0,
		width: 340,
		height: 128,
		inkStrokes: [
			{ path: 'M 0 64 L 8 85 L 16 104', color: '#E81123', width: 1.89, opacity: 1 },
			{ path: 'M 255 64 L 267 119', color: '#0078D7', width: 3.78, opacity: 1 },
		],
	}) as ContentPartPptxElement;

describe('contentPart renderer (vue)', () => {
	it('paints one SVG path per ink stroke, with the InkML brush colour and width', () => {
		const wrapper = mount(ContentPartRenderer, { props: { element: inked(), zIndex: 3 } });
		const paths = wrapper.findAll('path');
		expect(paths).toHaveLength(2);
		expect(paths[0].attributes('stroke')).toBe('#E81123');
		expect(paths[0].attributes('stroke-width')).toBe('1.89');
		expect(paths[1].attributes('stroke')).toBe('#0078D7');
		expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 340 128');
	});

	it('falls back to the labelled box when the part decoded no strokes', () => {
		const bare = { ...inked(), inkStrokes: undefined } as ContentPartPptxElement;
		const wrapper = mount(ContentPartRenderer, { props: { element: bare, zIndex: 1 } });
		expect(wrapper.findAll('path')).toHaveLength(0);
		expect(wrapper.find('.pptx-vue-contentpart-fallback').exists()).toBeTruthy();
	});

	it('is reached from ElementRenderer instead of the unsupported placeholder', () => {
		const wrapper = mount(ElementRenderer, {
			props: { element: inked(), zIndex: 2, slideWidth: 960, slideHeight: 540 },
		});
		expect(wrapper.find('.pptx-vue-unsupported').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-contentpart').exists()).toBeTruthy();
		expect(wrapper.findAll('path').length).toBeGreaterThan(0);
	});
});
