/** @vitest-environment happy-dom */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function textShape(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		shapeType: 'rect',
		text: 'Bold Reveal',
		textSegments: [{ text: 'Bold Reveal', style: { bold: false, underline: false } }],
	} as PptxElement;
}

function props(overrides: Partial<ElementRendererProps> = {}): ElementRendererProps {
	return {
		element: textShape(),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: false,
		presenting: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: false,
		imageAltText: 'Shape',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandles: [],
		onResizePointerDown: vi.fn(),
		onAdjustmentPointerDown: vi.fn(),
		onInlineEditChange: vi.fn(),
		onInlineEditCommit: vi.fn(),
		onInlineEditCancel: vi.fn(),
		...overrides,
	};
}

describe('font-style emphasis text-style animation override', () => {
	it('renders a scoped !important override rule while bold is active', () => {
		act(() =>
			root.render(
				<ElementRenderer
					{...props({
						animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
					})}
				/>,
			),
		);

		const outer = container.querySelector<HTMLElement>('[data-element-id="shape-1"]');
		expect(outer).not.toBeNull();
		const styleTag = outer?.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="shape-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});

	it('renders an underline override', () => {
		act(() =>
			root.render(
				<ElementRenderer
					{...props({
						animationState: {
							visible: true,
							cssAnimation: undefined,
							textStyle: { underline: true },
						},
					})}
				/>,
			),
		);

		const styleTag = container
			.querySelector<HTMLElement>('[data-element-id="shape-1"]')
			?.querySelector('style');
		expect(styleTag?.textContent).toContain('text-decoration-line: underline !important');
	});

	it('renders no override style tag when no font-style emphasis is active', () => {
		act(() => root.render(<ElementRenderer {...props()} />));

		const styleTag = container
			.querySelector<HTMLElement>('[data-element-id="shape-1"]')
			?.querySelector('style');
		expect(styleTag).toBeNull();
	});

	// PowerPoint animates a table cell, a chart title/label/legend, a SmartArt
	// node caption and a connector caption the same way it animates plain text:
	// the override must NOT be gated on "is this a text/shape element".

	it('renders the override for a table element (a table cell has no text properties)', () => {
		const table: PptxElement = {
			id: 'table-1',
			type: 'table',
			x: 0,
			y: 0,
			width: 200,
			height: 80,
			tableData: {
				rows: [{ cells: [{ text: 'Evidence cell' }] }],
				columnWidths: [1],
			},
		} as PptxElement;

		act(() =>
			root.render(
				<ElementRenderer
					{...props({
						element: table,
						animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
					})}
				/>,
			),
		);

		const styleTag = container
			.querySelector<HTMLElement>('[data-element-id="table-1"]')
			?.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="table-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});

	it('renders the override for a chart element, including the SVG text/tspan fill rule', () => {
		const chart: PptxElement = {
			id: 'chart-1',
			type: 'chart',
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

		act(() =>
			root.render(
				<ElementRenderer
					{...props({
						element: chart,
						animationState: {
							visible: true,
							cssAnimation: undefined,
							textStyle: { color: '#ff0000' },
						},
					})}
				/>,
			),
		);

		const styleTag = container
			.querySelector<HTMLElement>('[data-element-id="chart-1"]')
			?.querySelector('style');
		expect(styleTag?.textContent).toContain('color: #ff0000 !important');
		expect(styleTag?.textContent).toContain(
			'[data-element-id="chart-1"] text, [data-element-id="chart-1"] tspan { fill: #ff0000 !important; }',
		);
	});

	it('renders the override for a connector caption', () => {
		const connector: PptxElement = {
			id: 'conn-1',
			type: 'connector',
			x: 0,
			y: 0,
			width: 100,
			height: 0,
			shapeType: 'straightConnector1',
			text: 'Label',
			textSegments: [{ text: 'Label', style: { bold: false } }],
		} as PptxElement;

		act(() =>
			root.render(
				<ElementRenderer
					{...props({
						element: connector,
						animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
					})}
				/>,
			),
		);

		const styleTag = container
			.querySelector<HTMLElement>('[data-element-id="conn-1"]')
			?.querySelector('style');
		expect(styleTag?.textContent).toContain('[data-element-id="conn-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});
});
