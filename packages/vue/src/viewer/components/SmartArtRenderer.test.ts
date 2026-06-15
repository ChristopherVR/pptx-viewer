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

	it('falls back to an SVG layout when no drawing shapes exist', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [node('1', 'Alpha'), node('2', 'Beta')] }),
				zIndex: 0,
			},
		});
		// SVG fallback is rendered
		expect(wrapper.find('svg').exists()).toBeTruthy();
		// Node text is visible in SVG <text> elements
		const texts = wrapper.findAll('text').map((t) => t.text());
		expect(texts).toContain('Alpha');
		expect(texts).toContain('Beta');
	});

	it('renders positioned SVG shapes (not just a text list) for the fallback', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [node('1', 'Alpha'), node('2', 'Beta')] }),
				zIndex: 0,
			},
		});
		// Should have <rect> elements since default is list layout
		expect(wrapper.find('rect').exists()).toBeTruthy();
		// No plain block-list divs
		expect(wrapper.find('.pptx-vue-smartart-block').exists()).toBeFalsy();
	});

	it('flattens nested nodes into the SVG fallback', () => {
		const root: PptxSmartArtNode = {
			id: '1',
			text: 'Root',
			children: [node('2', 'Child A'), node('3', 'Child B')],
		};
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt({ nodes: [root] }), zIndex: 0 },
		});
		// All three nodes should appear as SVG text
		const texts = wrapper.findAll('text').map((t) => t.text());
		expect(texts.some((t) => t.includes('Root'))).toBeTruthy();
		expect(texts.some((t) => t.includes('Child A'))).toBeTruthy();
		expect(texts.some((t) => t.includes('Child B'))).toBeTruthy();
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

	// ── Layout family dispatch via resolvedLayoutType ────────────────────────────

	it('renders cycle layout as circle elements when resolvedLayoutType is cycle', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [node('1', 'A'), node('2', 'B'), node('3', 'C')],
					resolvedLayoutType: 'cycle',
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.find('circle').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('cycle');
	});

	it('renders process layout as polygon elements when resolvedLayoutType is process', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [node('1', 'Step 1'), node('2', 'Step 2')],
					resolvedLayoutType: 'process',
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('polygon').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('process');
	});

	it('renders hierarchy layout as rect elements with connector paths', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'CEO' },
			{ id: '2', text: 'VP Eng', parentId: '1' },
			{ id: '3', text: 'VP Mktg', parentId: '1' },
		];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, resolvedLayoutType: 'hierarchy' }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('rect').exists()).toBeTruthy();
		// Connectors between parent and two children
		expect(wrapper.findAll('path').length).toBeGreaterThanOrEqual(2);
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('hierarchy');
	});

	it('renders matrix layout as a grid of rect elements', () => {
		const nodes = [node('1', 'Q1'), node('2', 'Q2'), node('3', 'Q3'), node('4', 'Q4')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, resolvedLayoutType: 'matrix' }),
				zIndex: 0,
			},
		});
		expect(wrapper.findAll('rect')).toHaveLength(4);
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('matrix');
	});

	it('renders relationship/radial layout as circles with connectors', () => {
		const nodes = [node('1', 'Core'), node('2', 'Sat A'), node('3', 'Sat B')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, resolvedLayoutType: 'relationship' }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('circle').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('radial');
	});

	// ── Layout family dispatch via named layout preset ────────────────────────────

	it('renders pyramid layout as polygon elements via named layout basicPyramid', () => {
		const nodes = [node('1', 'Top'), node('2', 'Middle'), node('3', 'Bottom')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, layout: 'basicPyramid' }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('polygon').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('pyramid');
	});

	it('renders venn layout as overlapping semi-transparent circles', () => {
		const nodes = [node('1', 'Set A'), node('2', 'Set B'), node('3', 'Set C')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, layout: 'basicVenn' }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('circle').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('venn');
	});

	it('renders funnel layout via named layout basicFunnel', () => {
		const nodes = [node('1', 'Top'), node('2', 'Mid'), node('3', 'Bottom')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes, layout: 'basicFunnel' }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('polygon').exists()).toBeTruthy();
		expect(wrapper.find('svg').attributes('data-layout-family')).toBe('funnel');
	});

	it('node text is rendered in all fallback SVG layouts', () => {
		const nodes = [node('1', 'Alpha'), node('2', 'Beta'), node('3', 'Gamma')];
		for (const resolvedLayoutType of ['list', 'process', 'cycle', 'matrix'] as const) {
			const wrapper = mount(SmartArtRenderer, {
				props: {
					element: smartArt({ nodes, resolvedLayoutType }),
					zIndex: 0,
				},
			});
			const textContent = wrapper.text();
			expect(textContent).toContain('Alpha');
			expect(textContent).toContain('Beta');
			expect(textContent).toContain('Gamma');
		}
	});
});
