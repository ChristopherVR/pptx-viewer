import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import WordArtText from './WordArtText.vue';

function warpedText(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'wa 1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'Hello',
		textStyle: { textWarpPreset: 'textArchUp', color: '#ff0000', fontSize: 32 },
		...overrides,
	} as PptxElement;
}

describe('wordArtText', () => {
	it('renders an svg with a textPath baseline for a warped element', () => {
		const wrapper = mount(WordArtText, { props: { element: warpedText(), zIndex: 5 } });
		expect(wrapper.find('svg.pptx-vue-wordart').exists()).toBeTruthy();
		expect(wrapper.find('textPath').exists()).toBeTruthy();
		// One defs path per paragraph, id sanitised from the element id ("wa 1" → "wa_1").
		const path = wrapper.find('defs path');
		expect(path.exists()).toBeTruthy();
		expect(path.attributes('id')).toBe('warp-wa_1-0');
		expect(path.attributes('d')?.startsWith('M')).toBeTruthy();
		expect(wrapper.find('textPath').attributes('href')).toBe('#warp-wa_1-0');
	});

	it('applies element-level base font + fill on the <text>', () => {
		const wrapper = mount(WordArtText, { props: { element: warpedText(), zIndex: 0 } });
		const text = wrapper.find('text');
		expect(text.attributes('fill')).toBe('#ff0000');
		expect(text.attributes('font-size')).toBe('32');
	});

	it('renders nothing for a non-warped preset', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textPlain' } }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders nothing when no warp preset is set', () => {
		const wrapper = mount(WordArtText, {
			props: { element: warpedText({ textStyle: {} }), zIndex: 0 },
		});
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders nothing for a non-text element', () => {
		const img = {
			type: 'image',
			id: 'i1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		} as PptxElement;
		const wrapper = mount(WordArtText, { props: { element: img, zIndex: 0 } });
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('emits one baseline path per paragraph', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					textSegments: [
						{ text: 'Line 1', style: {} },
						{ text: '', style: {}, isParagraphBreak: true },
						{ text: 'Line 2', style: {} },
					],
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.findAll('defs path')).toHaveLength(2);
		expect(wrapper.findAll('textPath')).toHaveLength(2);
	});

	it('uses hyperlink colour and underline for hyperlink runs', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					// No element-level colour, so the hyperlink fallback colour applies
					// (mirrors React: element colour, when present, wins over HYPERLINK_COLOR).
					textStyle: { textWarpPreset: 'textArchUp' },
					text: '',
					textSegments: [{ text: 'click', style: { hyperlink: 'https://x.test' } }],
				}),
				zIndex: 0,
			},
		});
		const tspan = wrapper.find('tspan');
		expect(tspan.attributes('fill')).toBe('#0563C1');
		expect(tspan.attributes('text-decoration')).toContain('underline');
	});

	it('maps centre alignment to a mid textPath anchor', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textArchUp', align: 'center' } }),
				zIndex: 0,
			},
		});
		const tp = wrapper.find('textPath');
		expect(tp.attributes('text-anchor')).toBe('middle');
		expect(tp.attributes('startOffset')).toBe('50%');
	});
});
