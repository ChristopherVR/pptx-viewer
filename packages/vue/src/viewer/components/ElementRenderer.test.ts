import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { FieldContextKey } from '../composables/field-context';
import ElementRenderer from './ElementRenderer.vue';

function mountEl(element: PptxElement) {
	return mount(ElementRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
}

function mountElWithFieldContext(element: PptxElement, ctx: FieldSubstitutionContext) {
	return mount(ElementRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
		global: { provide: { [FieldContextKey as symbol]: () => ctx } },
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

	it('substitutes a slide-number field run from the injected field context', () => {
		const element = {
			type: 'text',
			id: 'tf',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [
				{ text: 'Page ', style: {} },
				{ text: '0', style: {}, fieldType: 'slidenum' },
			],
		} as PptxElement;
		expect(mountElWithFieldContext(element, { slideNumber: 9 }).text()).toContain('Page 9');
		// No context -> raw field text is left untouched.
		expect(mountEl(element).text()).toContain('Page 0');
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

	it('renders a video media element with controls from mediaData', () => {
		const wrapper = mountEl({
			type: 'media',
			id: 'm1',
			x: 0,
			y: 0,
			width: 320,
			height: 180,
			mediaType: 'video',
			mediaData: 'data:video/mp4;base64,AAAA',
		} as PptxElement);
		const video = wrapper.get('video');
		expect(video.attributes('src')).toBe('data:video/mp4;base64,AAAA');
	});

	it('renders an audio media element from mediaData', () => {
		const wrapper = mountEl({
			type: 'media',
			id: 'm2',
			x: 0,
			y: 0,
			width: 420,
			height: 64,
			mediaType: 'audio',
			mediaData: 'data:audio/mpeg;base64,AAAA',
		} as PptxElement);
		expect(wrapper.get('audio').attributes('src')).toBe('data:audio/mpeg;base64,AAAA');
	});

	it('falls back to the poster frame when a media element has no playable source', () => {
		const wrapper = mountEl({
			type: 'media',
			id: 'm3',
			x: 0,
			y: 0,
			width: 320,
			height: 180,
			mediaType: 'video',
			posterFrameData: 'data:image/png;base64,BBBB',
		} as PptxElement);
		expect(wrapper.find('video').exists()).toBeFalsy();
		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,BBBB');
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

	it('renders a defensive placeholder for unknown element types', () => {
		// Every real PptxElement type now has a dedicated renderer; the generic
		// placeholder is only reached defensively for an unrecognised `type`.
		const wrapper = mountEl({
			type: 'futureType',
			id: 'x1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement);
		expect(wrapper.find('.pptx-vue-placeholder').text()).toBe('futureType');
	});
});
