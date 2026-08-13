import { mount } from '@vue/test-utils';
import type { RenderParagraph } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SlideTextBlock from './SlideTextBlock.vue';

/** Build a minimal single-run paragraph, overriding spacing fields under test. */
function para(overrides: Partial<RenderParagraph> = {}): RenderParagraph {
	return {
		runs: [{ text: 'hello', style: {} }],
		bulletStyle: {},
		segmentIndices: [],
		...overrides,
	};
}

describe('slideTextBlock - per-paragraph spacing', () => {
	it('applies line-height, margin-top and margin-bottom from the paragraph model', () => {
		const wrapper = mount(SlideTextBlock, {
			props: {
				paragraphs: [para({ lineHeight: 1.5, spaceBeforePx: 12, spaceAfterPx: 8 })],
				textStyle: {},
			},
		});
		const p = wrapper.get('p.pptx-vue-para');
		const style = p.attributes('style') ?? '';
		expect(style).toContain('line-height: 1.5');
		// The browser collapses the margin longhands into the shorthand
		// (top right bottom [left]) => top=12, right=0, bottom=8, left=0.
		expect(style).toContain('margin: 12px 0px 8px');
	});

	it('supports an exact-pt line-height string', () => {
		const wrapper = mount(SlideTextBlock, {
			props: { paragraphs: [para({ lineHeight: '18pt' })], textStyle: {} },
		});
		expect(wrapper.get('p.pptx-vue-para').attributes('style')).toContain('line-height: 18pt');
	});

	it('omits line-height and zeroes margins when the paragraph has no own spacing', () => {
		const wrapper = mount(SlideTextBlock, {
			props: { paragraphs: [para()], textStyle: {} },
		});
		const style = wrapper.get('p.pptx-vue-para').attributes('style') ?? '';
		expect(style).not.toContain('line-height');
		// All four margins are zero => collapsed to the single-value shorthand.
		expect(style).toContain('margin: 0px');
	});
});

describe('slideTextBlock - hyperlink and inline equation runs', () => {
	it('renders a hyperlinked run as a safe anchor', () => {
		// Before `ParagraphRun` carried a hyperlink, this binding painted linked
		// text as an ordinary span: the link was silently gone from the DOM.
		const wrapper = mount(SlideTextBlock, {
			props: {
				paragraphs: [
					para({
						runs: [
							{ text: 'See ', style: {} },
							{
								text: 'the docs',
								style: {},
								hyperlink: {
									url: 'https://example.com',
									href: 'https://example.com',
									tooltip: 'Docs',
								},
							},
						],
					}),
				],
				textStyle: {},
			},
		});
		const link = wrapper.get('a.pptx-vue-link');
		expect(link.attributes('href')).toBe('https://example.com');
		expect(link.attributes('rel')).toBe('noopener noreferrer');
		expect(link.attributes('title')).toBe('Docs');
		expect(link.text()).toBe('the docs');
		expect(wrapper.findAll('a')).toHaveLength(1);
	});

	it('renders an inline equation run as MathML between the runs around it', () => {
		const wrapper = mount(SlideTextBlock, {
			props: {
				paragraphs: [
					para({
						runs: [
							{ text: 'Given ', style: {} },
							{
								text: '',
								style: {},
								equation: { xml: { 'm:oMath': { 'm:r': { 'm:t': 'x' } } }, number: '1' },
							},
							{ text: ' holds', style: {} },
						],
					}),
				],
				textStyle: {},
			},
		});
		expect(wrapper.get('.pptx-vue-inline-equation .pptx-vue-equation').html()).toContain(
			'<mi>x</mi>',
		);
		expect(wrapper.get('.pptx-vue-equation-number').text()).toBe('(1)');
		// The prose on either side survives, which the wholesale "delegate the
		// whole element to EquationRenderer" path destroyed.
		expect(wrapper.text()).toContain('Given');
		expect(wrapper.text()).toContain('holds');
	});
});
