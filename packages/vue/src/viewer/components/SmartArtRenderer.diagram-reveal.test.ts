import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SmartArtRenderer from './SmartArtRenderer.vue';

/**
 * Staged `p:bldDgm` diagram-build reveal wiring (Vue port of the React
 * `SmartArtRenderer.diagram-reveal.test.tsx` coverage).
 */

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function smartArt(data: PptxSmartArtData): PptxElement {
	return {
		type: 'smartArt',
		id: 'dgm1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: data,
	} as PptxElement;
}

function mountWith(nodes: PptxSmartArtNode[], animationState?: ElementAnimationState) {
	return mount(SmartArtRenderer, {
		props: {
			element: smartArt({ resolvedLayoutType: 'list', nodes }),
			zIndex: 0,
			animationState,
		},
	});
}

describe('smartArtRenderer - staged diagram build reveal', () => {
	const nodes = [node('n1', 'Alpha'), node('n2', 'Beta'), node('n3', 'Gamma')];

	it('reveals every node when no animation state is present', () => {
		const wrapper = mountWith(nodes);
		expect(wrapper.find('[data-smartart-node-id="n1"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-smartart-node-id="n2"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-smartart-node-id="n3"]').exists()).toBeTruthy();
	});

	it('falls back to a count-based leading-prefix reveal with no descriptor', () => {
		const wrapper = mountWith(nodes, {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
		});
		expect(wrapper.find('[data-smartart-node-id="n1"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-smartart-node-id="n2"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-smartart-node-id="n3"]').exists()).toBeFalsy();
	});

	it('prefers the authored diagramReveal node-id set over the build progress', () => {
		const wrapper = mountWith(nodes, {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(wrapper.find('[data-smartart-node-id="n1"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-smartart-node-id="n2"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-smartart-node-id="n3"]').exists()).toBeTruthy();
	});
});

describe('smartArtRenderer - staged diagram build reveal (cached drawing shapes)', () => {
	it('prefers the authored diagramReveal node-id set over a proportional shape-count guess', () => {
		const nodes = [node('n1', 'Alpha'), node('n2', 'Beta'), node('n3', 'Gamma')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					resolvedLayoutType: 'list',
					nodes,
					drawingShapes: [
						{ id: 's1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 50, text: 'Alpha' },
						{ id: 's2', shapeType: 'roundRect', x: 0, y: 60, width: 100, height: 50, text: 'Beta' },
						{
							id: 's3',
							shapeType: 'roundRect',
							x: 0,
							y: 120,
							width: 100,
							height: 50,
							text: 'Gamma',
						},
					],
				}),
				zIndex: 0,
				animationState: {
					visible: true,
					cssAnimation: undefined,
					build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
					diagramReveal: {
						mode: 'byOne',
						descriptor: { background: true, nodeIds: new Set(['n3']) },
					},
				},
			},
		});
		expect(wrapper.find('[data-smartart-node-id="n1"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-smartart-node-id="n2"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-smartart-node-id="n3"]').exists()).toBeTruthy();
	});
});
