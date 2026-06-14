import { mount } from '@vue/test-utils';
import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SmartArtRenderer from './SmartArtRenderer.vue';

function smartArt(data?: PptxSmartArtData, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'smartArt',
		id: 'dgm 1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: data,
		...overrides,
	} as PptxElement;
}

function shape(over: Partial<PptxSmartArtDrawingShape> & { id: string }): PptxSmartArtDrawingShape {
	return {
		shapeType: 'roundRect',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		...over,
	};
}

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

describe('smartArtRenderer', () => {
	it('renders one <g> shape group per decomposed drawing shape', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 0, y: 0 }),
			shape({ id: 's2', x: 0, y: 70 }),
			shape({ id: 's3', x: 0, y: 140 }),
		];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [], drawingShapes: shapes }),
				zIndex: 1,
			},
		});
		expect(wrapper.findAll('svg g')).toHaveLength(3);
		// Each shape (roundRect) renders a <rect>.
		expect(wrapper.findAll('rect')).toHaveLength(3);
	});

	it('renders shape text content', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', text: 'Plan' }),
			shape({ id: 's2', x: 0, y: 70, text: 'Build' }),
		];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [], drawingShapes: shapes }),
				zIndex: 0,
			},
		});
		const texts = wrapper.findAll('text').map((t) => t.text());
		expect(texts).toContain('Plan');
		expect(texts).toContain('Build');
	});

	it('renders an ellipse for ellipse-type shapes', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [],
					drawingShapes: [shape({ id: 's1', shapeType: 'ellipse', text: 'Round' })],
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('ellipse').exists()).toBeTruthy();
		expect(wrapper.find('rect').exists()).toBeFalsy();
	});

	it('falls back to a stacked node-text list when no drawing shapes exist', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [node('1', 'Alpha'), node('2', 'Beta')] }),
				zIndex: 0,
			},
		});
		// No SVG when there are no drawing shapes.
		expect(wrapper.find('svg').exists()).toBeFalsy();
		const blocks = wrapper.findAll('.pptx-vue-smartart-block');
		expect(blocks).toHaveLength(2);
		expect(wrapper.text()).toContain('Alpha');
		expect(wrapper.text()).toContain('Beta');
	});

	it('flattens nested nodes into the fallback list', () => {
		const root: PptxSmartArtNode = {
			id: '1',
			text: 'Root',
			children: [node('2', 'Child A'), node('3', 'Child B')],
		};
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt({ nodes: [root] }), zIndex: 0 },
		});
		expect(wrapper.findAll('.pptx-vue-smartart-block')).toHaveLength(3);
		expect(wrapper.text()).toContain('Child A');
	});

	it('renders a placeholder when the element carries no smartArtData', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt(undefined), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-smartart-placeholder').text()).toBe('SmartArt');
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders a placeholder when there are zero nodes and zero shapes', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt({ nodes: [] }), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-smartart-placeholder').exists()).toBeTruthy();
	});

	it('applies chrome background and outline', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [],
					drawingShapes: [shape({ id: 's1' })],
					chrome: { backgroundColor: '#f0f0f0', outlineColor: '#333', outlineWidth: 2 },
				}),
				zIndex: 0,
			},
		});
		const chrome = wrapper.find('.pptx-vue-smartart-chrome');
		expect(chrome.attributes('style')).toContain('background-color: #f0f0f0');
		expect(chrome.attributes('style')).toContain('border: 2px solid #333');
	});
});
