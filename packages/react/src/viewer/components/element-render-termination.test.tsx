// @vitest-environment happy-dom
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { getShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { beforeAll, describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

/**
 * Render-termination regression guard for the "Project Atlas" sample deck.
 *
 * Reproduces the exact scenarios from the bundled demo deck (`?sample=1`):
 *   - a decorative `roundRect` grid shape, SELECTED (resize handles + the
 *     round-rect adjustment handle),
 *   - the slide-5 comparison TABLE.
 *
 * A prior report described a synchronous renderer freeze when selecting one of
 * the shapes or rendering the table. This test renders both of those elements
 * through the real {@link ElementRenderer} and asserts the render COMPLETES
 * (and within a generous wall-clock bound) so a geometry / transform / clip-path
 * change can never reintroduce an unbounded render loop for these inputs.
 */

let deck: { slides: PptxSlide[] };

beforeAll(async () => {
	// Build an in-memory deck mirroring the sample: a 3x3 roundRect grid and a
	// 5-row comparison table. Self-contained (no dependency on the binary asset).
	const { handler, data, createSlide } = await PptxHandler.create({
		title: 'Render Termination Fixture',
		width: 12_192_000,
		height: 6_858_000,
	});

	const grid = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	const fills = ['#a5b4fc', '#818cf8', '#6366f1', '#818cf8', '#6366f1', '#f59e0b'];
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			grid.addShape('roundRect', {
				x: 610 + c * 176,
				y: 130 + r * 176,
				width: 150,
				height: 150,
				fill: { type: 'solid', color: fills[(r * 3 + c) % fills.length] },
			});
		}
	}
	data.slides.push(grid.build());

	const head = { color: '#ffffff', bold: true };
	const tableSlide = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	tableSlide.addTable(
		{
			rows: [
				{
					cells: [
						{ text: 'Feature', style: head, fill: { type: 'solid', color: '#4f46e5' } },
						{ text: 'Starter', style: head, fill: { type: 'solid', color: '#4f46e5' } },
						{ text: 'Team', style: head, fill: { type: 'solid', color: '#4f46e5' } },
						{ text: 'Enterprise', style: head, fill: { type: 'solid', color: '#4f46e5' } },
					],
				},
				{ cells: [{ text: 'Projects' }, { text: '3' }, { text: '25' }, { text: 'Unlimited' }] },
				{
					cells: [{ text: 'Collaborators' }, { text: '1' }, { text: '10' }, { text: 'Unlimited' }],
				},
				{ cells: [{ text: 'Export' }, { text: 'PDF' }, { text: 'PDF, PNG' }, { text: 'All' }] },
				{
					cells: [
						{ text: 'Support' },
						{ text: 'Community' },
						{ text: 'Email' },
						{ text: '24 / 7' },
					],
				},
			],
			firstRow: true,
			bandRows: true,
		},
		{ x: 80, y: 200, width: 1120, height: 360 },
	);
	data.slides.push(tableSlide.build());

	const bytes = await handler.save(data.slides);
	const reloaded = new PptxHandler();
	deck = await reloaded.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	);
});

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

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: overrides.element as PptxElement,
		isSelected: true,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: true,
		imageAltText: 'Slide element',
		showResizeHandles: true,
		renderInk: true,
		renderGroups: true,
		adjustmentHandleDescriptor: null,
		onResizePointerDown: vi.fn<() => void>(),
		onAdjustmentPointerDown: vi.fn<() => void>(),
		onInlineEditChange: vi.fn<() => void>(),
		onInlineEditCommit: vi.fn<() => void>(),
		onInlineEditCancel: vi.fn<() => void>(),
		...overrides,
	};
}

describe('elementRenderer render termination (sample deck)', () => {
	it('renders a SELECTED decorative roundRect quickly (no render freeze)', () => {
		const round = deck.slides[0].elements.find((e) => e.shapeType === 'roundRect');
		expect(round).toBeDefined();
		const adj = getShapeAdjustmentHandleDescriptor(round!);
		// A round-rect exposes an adjustment (corner-radius) handle on selection.
		expect(adj).not.toBeNull();

		const started = Date.now();
		act(() => {
			root.render(
				<ElementRenderer {...makeProps({ element: round!, adjustmentHandleDescriptor: adj })} />,
			);
		});
		const elapsed = Date.now() - started;

		// Rendered a real element (container carries the element id).
		expect(container.querySelector(`[data-element-id="${round!.id}"]`)).not.toBeNull();
		// A hang would blow past this by orders of magnitude.
		expect(elapsed).toBeLessThan(4000);
	});

	it('renders the slide-5 table quickly (no render freeze)', () => {
		const table = deck.slides[1].elements.find((e) => e.type === 'table');
		expect(table).toBeDefined();

		const started = Date.now();
		act(() => {
			root.render(
				<ElementRenderer
					{...makeProps({ element: table!, isSelected: false, showResizeHandles: false })}
				/>,
			);
		});
		const elapsed = Date.now() - started;

		expect(container.querySelector('table')).not.toBeNull();
		expect(container.textContent).toContain('Enterprise');
		expect(elapsed).toBeLessThan(4000);
	});
});
