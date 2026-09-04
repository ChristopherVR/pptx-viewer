/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own unrelated locals; merging across them would hurt readability. */
import { mount } from '@vue/test-utils';
import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { SmartArtNodeEditContext } from '../composables/smartart-node-edit';
import { SmartArtNodeEditKey } from '../composables/smartart-node-edit';
import SmartArtRenderer from './SmartArtRenderer.vue';

/** Mount with an injected node-edit context (commit spy + canEdit gate). */
function mountEditable(
	data: PptxSmartArtData,
	opts: { canEdit?: boolean; elementOverrides?: Partial<PptxElement> } = {},
): { wrapper: ReturnType<typeof mount>; commit: ReturnType<typeof vi.fn> } {
	const commit = vi.fn();
	const ctx: SmartArtNodeEditContext = {
		canEdit: () => opts.canEdit ?? true,
		commit,
	};
	const wrapper = mount(SmartArtRenderer, {
		props: { element: smartArt(data, opts.elementOverrides), zIndex: 0 },
		attachTo: document.body,
		global: { provide: { [SmartArtNodeEditKey as symbol]: ctx } },
	});
	return { wrapper, commit };
}

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

	// Regression: the chrome style decision comes from the shared
	// `buildChromeStyle` (`pptx-viewer-shared`), the same function
	// Angular/Svelte/Vanilla call directly, rather than a local reimplementation.
	it('defaults the outline width to 1px when outlineWidth is omitted', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [],
					drawingShapes: [shape({ id: 's1' })],
					chrome: { outlineColor: '#00ff00' },
				}),
				zIndex: 0,
			},
		});
		const chrome = wrapper.find('.pptx-vue-smartart-chrome');
		expect(chrome.attributes('style')).toContain('border: 1px solid #00ff00');
		expect(chrome.attributes('style')).not.toContain('background-color');
	});

	it('applies no background/border when chrome is absent', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({ nodes: [], drawingShapes: [shape({ id: 's1' })] }),
				zIndex: 0,
			},
		});
		const style = wrapper.find('.pptx-vue-smartart-chrome').attributes('style') ?? '';
		expect(style).not.toContain('background-color');
		expect(style).not.toContain('border:');
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

// Regression: `colorsDef @meth="span"` ("Colorful Range" quick styles) was
// parsed into `colorTransform.fillInterpolation` but never reached the layout
// engine at any of the five bindings' render call sites, so a 2-colour range
// alternated instead of gradienting. `SmartArtRenderer.vue` now goes through
// the shared `computeSmartArtElementLayout`, which derives the interpolation
// from `smartArtData.colorTransform` itself.
describe('smartArtRenderer colour interpolation (colorsDef @meth="span")', () => {
	it('gradients a 2-colour "Colorful Range" scheme across all nodes', () => {
		const nodes = [node('1', 'A'), node('2', 'B'), node('3', 'C'), node('4', 'D'), node('5', 'E')];
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes,
					colorTransform: {
						fillColors: ['#000000', '#ffffff'],
						lineColors: [],
						fillInterpolation: { method: 'span' },
					},
				}),
				zIndex: 0,
			},
		});
		const fills = wrapper.findAll('rect').map((r) => r.attributes('fill'));
		expect(fills).toHaveLength(5);
		expect(fills[0]).toBe('#000000');
		expect(fills[4]).toBe('#ffffff');
		expect(new Set(fills).size).toBe(5);
	});
});

describe('smartArtRenderer inline node editing', () => {
	const data: PptxSmartArtData = { nodes: [node('1', 'Alpha'), node('2', 'Beta')] };

	it('exposes editable node groups (data-node-id) only when a context allows it', () => {
		const { wrapper } = mountEditable(data, { canEdit: true });
		const editable = wrapper.findAll('g[data-node-id]');
		expect(editable).toHaveLength(2);
		expect(editable[0]?.attributes('data-node-id')).toBe('1');
		expect(editable[1]?.attributes('data-node-id')).toBe('2');
	});

	it('does not expose editable groups when no edit context is provided', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt(data), zIndex: 0 },
		});
		expect(wrapper.find('.pptx-vue-smartart-editable').exists()).toBeFalsy();
		expect(wrapper.find('textarea').exists()).toBeFalsy();
	});

	it('does not expose editable groups when the context disables editing', () => {
		const { wrapper } = mountEditable(data, { canEdit: false });
		expect(wrapper.find('.pptx-vue-smartart-editable').exists()).toBeFalsy();
	});

	it('double-clicking a node opens an inline editor seeded with the node text', async () => {
		const { wrapper } = mountEditable(data, { canEdit: true });
		const group = wrapper.findAll('g[data-node-id]')[0];
		await group?.trigger('dblclick');
		const editor = wrapper.find('textarea.pptx-vue-smartart-node-editor');
		expect(editor.exists()).toBeTruthy();
		expect((editor.element as HTMLTextAreaElement).value).toBe('Alpha');
	});

	it('commits the edited text via the injected context on Enter', async () => {
		const { wrapper, commit } = mountEditable(data, { canEdit: true });
		await wrapper.findAll('g[data-node-id]')[0]?.trigger('dblclick');
		const editor = wrapper.find('textarea.pptx-vue-smartart-node-editor');
		await editor.setValue('Renamed');
		await editor.trigger('keydown', { key: 'Enter' });
		expect(commit).toHaveBeenCalledWith('dgm 1', '1', 'Renamed');
		// Editor closes after commit.
		expect(wrapper.find('textarea.pptx-vue-smartart-node-editor').exists()).toBeFalsy();
	});

	it('skips the commit when the text is unchanged (no history churn)', async () => {
		const { wrapper, commit } = mountEditable(data, { canEdit: true });
		await wrapper.findAll('g[data-node-id]')[0]?.trigger('dblclick');
		const editor = wrapper.find('textarea.pptx-vue-smartart-node-editor');
		await editor.trigger('keydown', { key: 'Enter' });
		expect(commit).not.toHaveBeenCalled();
	});

	it('cancels on Escape without committing', async () => {
		const { wrapper, commit } = mountEditable(data, { canEdit: true });
		await wrapper.findAll('g[data-node-id]')[0]?.trigger('dblclick');
		const editor = wrapper.find('textarea.pptx-vue-smartart-node-editor');
		await editor.setValue('Discarded');
		await editor.trigger('keydown', { key: 'Escape' });
		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.find('textarea.pptx-vue-smartart-node-editor').exists()).toBeFalsy();
	});

	// G8 (OpenXML parity audit, D3): a:graphicFrameLocks/@noDrilldown was
	// parsed but never enforced - a node was still double-click editable on a
	// locked SmartArt.
	it('does not open the node editor on double-click when noDrilldown is set', async () => {
		const { wrapper } = mountEditable(data, {
			canEdit: true,
			elementOverrides: { locks: { noDrilldown: true } } as Partial<PptxElement>,
		});
		expect(wrapper.find('.pptx-vue-smartart-editable').exists()).toBeFalsy();
	});
});

describe('smartArtRenderer accessibility', () => {
	it('labels the diagram container as an image with a description', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [node('1', 'Alpha'), node('2', 'Beta')],
					resolvedLayoutType: 'list',
				}),
				zIndex: 0,
			},
		});
		const chrome = wrapper.get('.pptx-vue-smartart-chrome');
		expect(chrome.attributes('role')).toBe('img');
		const label = chrome.attributes('aria-label') ?? '';
		expect(label).toContain('List SmartArt diagram');
		expect(label).toContain('Alpha');
		expect(label).toContain('Beta');
	});

	it('labels each fallback node group with its position and text', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt({
					nodes: [node('1', 'Alpha'), node('2', 'Beta')],
					resolvedLayoutType: 'list',
				}),
				zIndex: 0,
			},
		});
		const groups = wrapper.findAll('g[data-node-id]');
		expect(groups[0].attributes('aria-label')).toBe('Node 1 of 2: Alpha');
		// A <title> mirrors the aria-label for SVG assistive tech.
		expect(groups[0].find('title').text()).toBe('Node 1 of 2: Alpha');
	});

	it('omits the image role when there is no smartArtData', () => {
		const wrapper = mount(SmartArtRenderer, {
			props: { element: smartArt(undefined), zIndex: 0 },
		});
		expect(wrapper.get('.pptx-vue-smartart-chrome').attributes('role')).toBeUndefined();
	});
});

/**
 * The shared layout descriptor's OPTIONAL paint / placement fields. This
 * template used to hardcode `fill="white"` and anchor circle labels on
 * `cx`/`cy`, so a target caption sat on the bullseye instead of beside it and a
 * timeline caption sat on its dot instead of above / below the axis.
 */
describe('smartArtRenderer fallback label + connector paint', () => {
	const three = [node('n1', 'One'), node('n2', 'Two'), node('n3', 'Three')];

	function mountFallback(resolvedLayoutType: 'target' | 'timeline' | 'gear') {
		return mount(SmartArtRenderer, {
			props: { element: smartArt({ nodes: three, resolvedLayoutType }), zIndex: 0 },
		});
	}

	it('parks a target leader caption beside the ring in the node colour', () => {
		const label = mountFallback('target').findAll('svg text')[0]!;
		// Not the circle centre (cx = 160): the descriptor's textX / textAnchor.
		expect(label.attributes('x')).toBe('310');
		expect(label.attributes('text-anchor')).toBe('start');
		expect(label.attributes('fill')).toBe('#3b82f6');
		expect(label.find('tspan').attributes('y')).toBe('13');
	});

	it('stacks timeline captions above and below the axis', () => {
		const labels = mountFallback('timeline').findAll('svg text');
		// First caption sits ABOVE its dot: last baseline on textY.
		expect(labels[0]!.attributes('dominant-baseline')).toBe('auto');
		expect(labels[0]!.find('tspan').attributes('y')).toBe('110');
		// Second alternates BELOW: first line's top on textY.
		expect(labels[1]!.attributes('dominant-baseline')).toBe('hanging');
		expect(labels[1]!.find('tspan').attributes('y')).toBe('190');
	});

	it('applies the node text style (gear hubs are bold)', () => {
		expect(mountFallback('gear').findAll('svg text')[0]!.attributes('font-weight')).toBe('700');
	});

	it('paints timeline stems in their own node colour, not the default grey', () => {
		const paths = mountFallback('timeline').findAll('svg path');
		// The axis keeps the descriptor's own 2px full-opacity stroke...
		expect(paths[0]!.attributes('stroke')).toBe('#94a3b8');
		expect(paths[0]!.attributes('stroke-width')).toBe('2');
		expect(paths[0]!.attributes('opacity')).toBe('1');
		// ...and each stem is drawn in its node's colour.
		expect(paths[1]!.attributes('stroke')).toBe('#3b82f6');
		expect(paths[1]!.attributes('stroke-width')).toBe('1');
	});
});
