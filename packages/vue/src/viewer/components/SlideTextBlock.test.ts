import { mount } from '@vue/test-utils';
import type { RenderParagraph } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SlideTextBlock from './SlideTextBlock.vue';

/** Build a minimal single-run paragraph, overriding spacing fields under test. */
function para(overrides: Partial<RenderParagraph> = {}): RenderParagraph {
	return {
		runs: [{ text: 'hello', style: {} }],
		bulletStyle: {},
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
