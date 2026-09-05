import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { PresentationElementStatesKey } from '../state/presentation-element-states-context';
import ElementRenderer from './ElementRenderer.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function shape(): PptxElement {
	return {
		type: 'shape',
		id: 'sp_1',
		x: 10,
		y: 10,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		text: 'Bold Reveal',
		textSegments: [{ text: 'Bold Reveal', style: { bold: false } }],
	} as unknown as PptxElement;
}

function mountWithState(state?: ElementAnimationState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const map = new Map<string, ElementAnimationState>(state ? [['sp_1', state]] : []);
	const context = new Map<unknown, unknown>([[PresentationElementStatesKey, () => map]]);
	mounted = mount(ElementRenderer, {
		target,
		props: { element: shape(), mediaDataUrls: new Map<string, string>(), zIndex: 1 },
		context,
	});
	flushSync();
	const node = target.querySelector<HTMLElement>('[data-element-id="sp_1"]');
	expect(node).not.toBeNull();
	return node as HTMLElement;
}

/** Mount an arbitrary element (table/chart/smartArt/connector) with animation state. */
function mountElementWithState(el: PptxElement, state: ElementAnimationState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const map = new Map<string, ElementAnimationState>([[el.id, state]]);
	const context = new Map<unknown, unknown>([[PresentationElementStatesKey, () => map]]);
	mounted = mount(ElementRenderer, {
		target,
		props: { element: el, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
		context,
	});
	flushSync();
	return target;
}

describe('font-style emphasis text-style animation override', () => {
	it('renders a scoped !important override rule while bold is active', () => {
		const node = mountWithState({
			visible: true,
			cssAnimation: undefined,
			textStyle: { bold: true },
		});
		const styleTag = node.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="sp_1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});

	it('renders no override style tag when no font-style emphasis is active', () => {
		const node = mountWithState();
		expect(node.querySelector('style')).toBeNull();
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
		} as unknown as PptxElement;
		const target = mountElementWithState(table, {
			visible: true,
			cssAnimation: undefined,
			textStyle: { bold: true },
		});
		const styleTag = target.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="table-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
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
		} as unknown as PptxElement;
		const target = mountElementWithState(chart, {
			visible: true,
			cssAnimation: undefined,
			textStyle: { color: '#ff0000' },
		});
		const styleTag = target.querySelector('style');
		expect(styleTag?.textContent).toContain('color: #ff0000 !important');
		expect(styleTag?.textContent).toContain(
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
		} as unknown as PptxElement;
		const target = mountElementWithState(connector, {
			visible: true,
			cssAnimation: undefined,
			textStyle: { bold: true },
		});
		const styleTag = target.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="conn-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
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
		} as unknown as PptxElement;
		const target = mountElementWithState(smartArt, {
			visible: true,
			cssAnimation: undefined,
			textStyle: { italic: true },
		});
		const styleTag = target.querySelector('style');
		expect(styleTag?.textContent).toContain('font-style: italic !important');
	});
});
