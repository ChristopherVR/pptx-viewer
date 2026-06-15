import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { convertOmmlToMathMl } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import EquationRenderer from './EquationRenderer.vue';

function mountEq(element: PptxElement) {
	return mount(EquationRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 3 },
	});
}

/** Build a text element carrying a single equation segment. */
function equationElement(
	equationXml: Record<string, unknown>,
	equationNumber?: string,
): PptxElement {
	return {
		type: 'text',
		id: 'eq1',
		x: 10,
		y: 20,
		width: 200,
		height: 50,
		textSegments: [{ text: '', style: {}, equationXml, equationNumber }],
	} as PptxElement;
}

describe('equationRenderer', () => {
	it('mounts and positions the wrapper via getContainerStyle', () => {
		const wrapper = mountEq(equationElement({ 'm:oMath': { 'm:r': { 'm:t': 'x' } } }));
		const root = wrapper.get('[data-element-id="eq1"]');
		expect(root.attributes('style')).toContain('left: 10px');
		expect(root.attributes('style')).toContain('top: 20px');
		expect(root.attributes('style')).toContain('z-index: 3');
	});

	it('emits <math> MathML markup for a simple identifier', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
		// The pure converter (what the component injects) wraps output in <math>.
		const converted = convertOmmlToMathMl(omml);
		expect(converted).toContain('<math');
		expect(converted).toContain('Math/MathML');
		expect(converted).toContain('<mi>x</mi>');

		// The mounted component renders the converted MathML into the DOM. Note:
		// happy-dom lacks a real MathML namespace, so DOMPurify drops the outer
		// <math> shell in tests while preserving the inner MathML elements; in a
		// real browser the <math> root is retained.
		const wrapper = mountEq(equationElement(omml));
		expect(wrapper.html()).toContain('<mi>x</mi>');
		expect(wrapper.find('.pptx-vue-equation').exists()).toBeTruthy();
	});

	it('renders a fraction as <mfrac>', () => {
		const wrapper = mountEq(
			equationElement({
				'm:oMath': {
					'm:f': {
						'm:num': { 'm:r': { 'm:t': 'a' } },
						'm:den': { 'm:r': { 'm:t': 'b' } },
					},
				},
			}),
		);
		const html = wrapper.html();
		expect(html).toContain('<mfrac>');
		expect(html).toContain('<mi>a</mi>');
		expect(html).toContain('<mi>b</mi>');
	});

	it('renders a superscript as <msup>', () => {
		const wrapper = mountEq(
			equationElement({
				'm:oMath': {
					'm:sSup': {
						'm:e': { 'm:r': { 'm:t': 'x' } },
						'm:sup': { 'm:r': { 'm:t': '2' } },
					},
				},
			}),
		);
		expect(wrapper.html()).toContain('<msup>');
	});

	it('renders a numbered equation with the number on both sides', () => {
		const wrapper = mountEq(equationElement({ 'm:oMath': { 'm:r': { 'm:t': 'x' } } }, '1'));
		expect(wrapper.find('.pptx-vue-equation-numbered').exists()).toBeTruthy();
		expect(wrapper.find('.pptx-vue-equation-number').text()).toBe('(1)');
	});

	it('renders nothing meaningful when the element has no equation segments', () => {
		const wrapper = mountEq({
			type: 'text',
			id: 'plain',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			textSegments: [{ text: 'hello', style: {} }],
		} as PptxElement);
		expect(wrapper.find('.pptx-vue-equation').exists()).toBeFalsy();
		// wrapper itself still mounts (caller decides whether to render it)
		expect(wrapper.find('[data-element-id="plain"]').exists()).toBeTruthy();
	});
});
