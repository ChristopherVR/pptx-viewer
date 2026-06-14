import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ConnectorRenderer from './ConnectorRenderer.vue';

function connector(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'connector',
		id: 'cxn 1',
		x: 10,
		y: 20,
		width: 200,
		height: 0,
		shapeStyle: { strokeColor: '#ff0000', strokeWidth: 3 },
		...overrides,
	} as PptxElement;
}

describe('connectorRenderer', () => {
	it('renders an svg line with the stroke colour and width', () => {
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 1 } });
		const line = wrapper.get('line');
		expect(line.attributes('stroke')).toBe('#ff0000');
		expect(line.attributes('stroke-width')).toBe('3');
	});

	it('spans the bounding box, mirrored by flip flags', () => {
		const plain = mount(ConnectorRenderer, {
			props: { element: connector({ width: 100, height: 40 }), zIndex: 0 },
		});
		const l1 = plain.get('line');
		expect(l1.attributes('x1')).toBe('0');
		expect(l1.attributes('x2')).toBe('100');

		const flipped = mount(ConnectorRenderer, {
			props: { element: connector({ width: 100, height: 40, flipHorizontal: true }), zIndex: 0 },
		});
		const l2 = flipped.get('line');
		expect(l2.attributes('x1')).toBe('100');
		expect(l2.attributes('x2')).toBe('0');
	});

	it('adds an end-arrow marker when configured', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({ shapeStyle: { connectorEndArrow: 'triangle' } }),
				zIndex: 0,
			},
		});
		const line = wrapper.get('line');
		expect(line.attributes('marker-end')).toContain('url(#');
		// id is sanitised from the element id ("cxn 1" → "cxn_1")
		expect(wrapper.find('marker#cxn_1-end').exists()).toBeTruthy();
	});

	it('omits markers when no arrows are set', () => {
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 0 } });
		expect(wrapper.find('marker').exists()).toBeFalsy();
		expect(wrapper.get('line').attributes('marker-end')).toBeUndefined();
	});
});
