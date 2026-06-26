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

describe('elementRenderer per-run text effects', () => {
	it('applies a gradient text fill via background-clip to a run', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 'fx-fill',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [
				{ text: 'Gradient', style: { textFillGradient: 'linear-gradient(red, blue)' } },
			],
		} as PptxElement);
		const span = wrapper.findAll('span').find((s) => s.text().includes('Gradient'));
		const style = span?.attributes('style') ?? '';
		// The gradient fill is applied via the background-clip:text technique.
		// jsdom's CSS parser folds the camelCase background-clip into the
		// `background` shorthand (dropping the -webkit-* props on serialisation),
		// so we assert on the gradient and the clip `text` token that survive.
		expect(style).toContain('linear-gradient(red, blue)');
		expect(style).toContain('text');
	});

	it('applies an outer text-shadow to a run', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 'fx-shadow',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [
				{
					text: 'Shadowed',
					style: {
						textShadowColor: '#000000',
						textShadowBlur: 4,
						textShadowOffsetX: 2,
						textShadowOffsetY: 3,
					},
				},
			],
		} as PptxElement);
		const span = wrapper.findAll('span').find((s) => s.text().includes('Shadowed'));
		expect(span?.attributes('style')).toContain('text-shadow');
	});

	it('applies a glow + blur filter chain to a run', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 'fx-filter',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [
				{
					text: 'Glowing',
					style: { textGlowColor: '#ffff00', textGlowRadius: 6, textBlurRadius: 2 },
				},
			],
		} as PptxElement);
		const span = wrapper.findAll('span').find((s) => s.text().includes('Glowing'));
		const style = span?.attributes('style') ?? '';
		expect(style).toContain('drop-shadow');
		expect(style).toContain('blur(2px)');
	});

	it('leaves a plain run free of effect styles', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 'fx-plain',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [{ text: 'Plain', style: {} }],
		} as PptxElement);
		const span = wrapper.findAll('span').find((s) => s.text().includes('Plain'));
		const style = span?.attributes('style') ?? '';
		expect(style).not.toContain('text-shadow');
		expect(style).not.toContain('filter');
		expect(style).not.toContain('background-clip');
	});

	it('injects a duotone <filter> and keeps the url(#) shape filter reference', () => {
		const wrapper = mountEl({
			type: 'shape',
			id: 'dt1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeType: 'rect',
			shapeStyle: { dagDuotone: { color1: '#112233', color2: '#aabbcc' } },
		} as unknown as PptxElement);
		// The hidden SVG <filter> backing the duotone effect is injected with the
		// id that matches the CSS url(#) reference.
		const filterEl = wrapper.find('filter#dag-duotone-dt1');
		expect(filterEl.exists()).toBeTruthy();
		// The shape box keeps the url(#dag-duotone-dt1) filter reference.
		const shape = wrapper.get('[data-element-id="dt1"]');
		expect(shape.attributes('style')).toContain('url(#dag-duotone-dt1)');
	});

	it('renders no duotone <filter> for a shape without dagDuotone', () => {
		const wrapper = mountEl({
			type: 'shape',
			id: 'dt2',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#ff0000' },
		} as unknown as PptxElement);
		expect(wrapper.find('filter').exists()).toBeFalsy();
		const shape = wrapper.get('[data-element-id="dt2"]');
		expect(shape.attributes('style') ?? '').not.toContain('url(#dag-duotone');
	});

	it('applies the text-body 3D scene transform to the text block', () => {
		const wrapper = mountEl({
			type: 'text',
			id: 'fx-scene',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			text: 'Scene',
			textStyle: {
				textBodyScene3d: { cameraPreset: 'perspectiveAbove' },
			},
		} as unknown as PptxElement);
		const block = wrapper.find('.pptx-vue-text');
		const style = block.attributes('style') ?? '';
		expect(style).toContain('perspective');
		expect(style).toContain('rotateX');
	});
});
