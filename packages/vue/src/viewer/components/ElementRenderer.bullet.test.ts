import { mount } from '@vue/test-utils';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';

/**
 * Build a text element from raw segments. Mirrors the core slide-load shape:
 * paragraphs are separated by bare `"\n"` text segments, and each bulleted
 * paragraph begins with a dedicated bullet segment carrying `bulletInfo`.
 */
function textElement(segments: TextSegment[], overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'txt-1',
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		textSegments: segments,
		...overrides,
	} as PptxElement;
}

function mountEl(element: PptxElement) {
	return mount(ElementRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0 },
	});
}

describe('elementRenderer - bulleted lists', () => {
	it('renders a "•" character bullet glyph before its text', () => {
		const el = textElement([
			{ text: '• ', style: {}, bulletInfo: { char: '•' } },
			{ text: 'First item', style: {} },
		]);
		const wrapper = mountEl(el);
		const bullets = wrapper.findAll('.pptx-vue-bullet');
		expect(bullets).toHaveLength(1);
		expect(bullets[0].text()).toBe('•');
		// The marker text is rendered separately from the run text, not doubled.
		expect(wrapper.find('.pptx-vue-text').text()).toContain('First item');
	});

	it('renders auto-numbered markers (1. / 2.) for an arabic numbered list', () => {
		const el = textElement([
			{
				text: '1.',
				style: {},
				bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 0 },
			},
			{ text: 'Alpha', style: {} },
			{ text: '\n', style: {} },
			{
				text: '2.',
				style: {},
				bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 1 },
			},
			{ text: 'Beta', style: {} },
		]);
		const wrapper = mountEl(el);
		const markers = wrapper.findAll('.pptx-vue-bullet').map((b) => b.text());
		expect(markers).toStrictEqual(['1.', '2.']);
	});

	it('renders no glyph when bulletInfo.none is set (buNone)', () => {
		const el = textElement([{ text: 'Plain paragraph', style: {}, bulletInfo: { none: true } }]);
		const wrapper = mountEl(el);
		expect(wrapper.find('.pptx-vue-bullet').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-text').text()).toContain('Plain paragraph');
	});

	it('suppresses the bullet for an empty paragraph (no visible text)', () => {
		const el = textElement([{ text: '', style: {}, bulletInfo: { char: '•' } }]);
		const wrapper = mountEl(el);
		expect(wrapper.find('.pptx-vue-bullet').exists()).toBeFalsy();
	});

	it('applies per-paragraph marginLeft from paragraphIndents (hanging indent)', () => {
		const el = textElement(
			[
				{ text: '• ', style: {}, bulletInfo: { char: '•' } },
				{ text: 'Level 0', style: {} },
				{ text: '\n', style: {} },
				{ text: '• ', style: {}, bulletInfo: { char: '•' } },
				{ text: 'Level 1', style: {} },
			],
			{ paragraphIndents: [{ marginLeft: 0 }, { marginLeft: 40, indent: -18 }] },
		);
		const wrapper = mountEl(el);
		const paras = wrapper.findAll('.pptx-vue-para');
		expect(paras).toHaveLength(2);
		// First paragraph: no explicit margin (serializes to a 0 margin shorthand).
		expect(paras[0].attributes('style') ?? '').not.toContain('40px');
		// Second paragraph: explicit hanging indent applied. jsdom collapses the
		// four longhand margins to the `margin` shorthand, with margin-left last.
		const style = paras[1].attributes('style') ?? '';
		expect(style).toContain('0px 0px 0px 40px');
		expect(style).toContain('text-indent: -18px');
	});

	it('falls back to per-level indent from paragraphLevel when no explicit indents', () => {
		const el = textElement([
			{ text: '• ', style: {}, bulletInfo: { char: '•' }, paragraphLevel: 2 },
			{ text: 'Nested', style: {} },
		]);
		const wrapper = mountEl(el);
		const para = wrapper.find('.pptx-vue-para');
		// jsdom collapses the longhand margins to the shorthand (left = 36px).
		expect(para.attributes('style') ?? '').toContain('0px 0px 0px 36px');
	});

	it('applies bullet colour and font from bulletInfo to the marker span', () => {
		const el = textElement([
			{
				text: '• ',
				style: {},
				bulletInfo: { char: '►', color: '#ff0000', fontFamily: 'Wingdings' },
			},
			{ text: 'Coloured', style: {} },
		]);
		const wrapper = mountEl(el);
		const bullet = wrapper.find('.pptx-vue-bullet');
		const style = bullet.attributes('style') ?? '';
		expect(bullet.text()).toBe('►');
		expect(style).toContain('color: #ff0000');
		expect(style).toContain('font-family: Wingdings');
	});

	it('renders a resolved picture bullet at its DrawingML size', () => {
		const el = textElement([
			{
				text: '',
				style: { fontSize: 16 },
				bulletInfo: {
					imageDataUrl: 'data:image/png;base64,iVBOR',
					imageRelId: 'rId5',
					sizePercent: 150,
				},
			},
			{ text: 'Picture item', style: {} },
		]);
		const wrapper = mountEl(el);
		const image = wrapper.find('.pptx-vue-bullet-image');
		expect(image.attributes('src')).toBe('data:image/png;base64,iVBOR');
		expect(image.attributes('alt')).toBe('Bullet');
		expect(image.attributes('style')).toContain('width: 24px');
		expect(image.attributes('style')).toContain('height: 24px');
	});

	it('renders an accessible fallback for an unresolved picture relationship', () => {
		const el = textElement([
			{ text: '', style: {}, bulletInfo: { imageRelId: 'rId5' } },
			{ text: 'Fallback item', style: {} },
		]);
		const wrapper = mountEl(el);
		const bullet = wrapper.find('.pptx-vue-bullet');
		expect(wrapper.find('.pptx-vue-bullet-image').exists()).toBeFalsy();
		expect(bullet.text()).toBe('•');
		expect(bullet.attributes('aria-label')).toBe('Bullet');
	});
});
