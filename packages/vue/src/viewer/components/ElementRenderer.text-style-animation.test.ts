import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { PresentationElementStatesKey } from '../composables/presentation-element-states';
import ElementRenderer from './ElementRenderer.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';

function shape(): PptxElement {
	return {
		type: 'shape',
		id: 'sp_1',
		x: 10,
		y: 20,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		text: 'Bold Reveal',
		textSegments: [{ text: 'Bold Reveal', style: { bold: false } }],
	} as PptxElement;
}

function mountWithState(state: ElementAnimationState) {
	const states = ref(new Map<string, ElementAnimationState>([['sp_1', state]]));
	return mount(ElementRenderer, {
		props: { element: shape(), zIndex: 1 },
		global: { provide: { [PresentationElementStatesKey as symbol]: states } },
	});
}

describe('font-style emphasis text-style animation override', () => {
	it('renders a scoped !important override rule while bold is active', () => {
		const wrapper = mountWithState({
			visible: true,
			cssAnimation: undefined,
			textStyle: { bold: true },
		});
		const styleTag = wrapper.find('[data-element-id="sp_1"] style');
		expect(styleTag.exists()).toBeTruthy();
		expect(styleTag.text()).toContain('[data-element-id="sp_1"] [style]');
		expect(styleTag.text()).toContain('font-weight: bold !important');
	});

	it('renders no override style tag when no font-style emphasis is active', () => {
		const wrapper = mount(ElementRenderer, { props: { element: shape(), zIndex: 1 } });
		expect(wrapper.find('[data-element-id="sp_1"] style').exists()).toBeFalsy();
	});

	// PowerPoint animates a table cell, a chart title/label/legend, a SmartArt
	// node caption and a connector caption the same way it animates plain text:
	// the override must NOT be gated on "is this a text/shape element".

	it('renders the override for a table element (a table cell has no text properties)', () => {
		const table: PptxElement = {
			type: 'table',
			id: 'table-1',
			x: 0,
			y: 0,
			width: 200,
			height: 80,
			tableData: { rows: [{ cells: [{ text: 'Evidence cell' }] }], columnWidths: [1] },
		} as PptxElement;
		const states = ref(
			new Map<string, ElementAnimationState>([
				['table-1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
			]),
		);
		const wrapper = mount(ElementRenderer, {
			props: { element: table, zIndex: 1 },
			global: { provide: { [PresentationElementStatesKey as symbol]: states } },
		});
		const styleTag = wrapper.find('[data-element-id="table-1"] style');
		expect(styleTag.exists()).toBeTruthy();
		expect(styleTag.text()).toContain('font-weight: bold !important');
	});

	it('renders the override for a chart element, including the SVG text/tspan fill rule', () => {
		const chart: PptxElement = {
			type: 'chart',
			id: 'chart-1',
			x: 0,
			y: 0,
			width: 400,
			height: 240,
			chartData: {
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [12, 18] }],
			},
		} as PptxElement;
		const states = ref(
			new Map<string, ElementAnimationState>([
				['chart-1', { visible: true, cssAnimation: undefined, textStyle: { color: '#ff0000' } }],
			]),
		);
		const wrapper = mount(ElementRenderer, {
			props: { element: chart, zIndex: 1 },
			global: { provide: { [PresentationElementStatesKey as symbol]: states } },
		});
		const styleTag = wrapper.find('[data-element-id="chart-1"] style');
		expect(styleTag.exists()).toBeTruthy();
		expect(styleTag.text()).toContain('color: #ff0000 !important');
		expect(styleTag.text()).toContain(
			'[data-element-id="chart-1"] text, [data-element-id="chart-1"] tspan { fill: #ff0000 !important; }',
		);
	});

	it('renders the override for a connector caption', () => {
		const connector: PptxElement = {
			type: 'connector',
			id: 'conn-1',
			x: 0,
			y: 0,
			width: 100,
			height: 0,
			shapeType: 'straightConnector1',
			text: 'Label',
			textSegments: [{ text: 'Label', style: { bold: false } }],
		} as PptxElement;
		const states = ref(
			new Map<string, ElementAnimationState>([
				['conn-1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
			]),
		);
		const wrapper = mount(ElementRenderer, {
			props: { element: connector, zIndex: 1 },
			global: { provide: { [PresentationElementStatesKey as symbol]: states } },
		});
		const styleTag = wrapper.find('[data-element-id="conn-1"] style');
		expect(styleTag.exists()).toBeTruthy();
		expect(styleTag.text()).toContain('font-weight: bold !important');
	});

	it('renders the override for a SmartArt node caption', () => {
		const smartArt: PptxElement = {
			type: 'smartArt',
			id: 'dgm-1',
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			smartArtData: undefined,
		} as PptxElement;
		const wrapper = mount(SmartArtRenderer, {
			props: {
				element: smartArt,
				zIndex: 1,
				textStyleOverrideCss: '[data-element-id="dgm-1"] text { fill: red !important; }',
			},
		});
		const styleTag = wrapper.find('[data-element-id="dgm-1"] style');
		expect(styleTag.exists()).toBeTruthy();
		expect(styleTag.text()).toContain('fill: red');
	});
});
