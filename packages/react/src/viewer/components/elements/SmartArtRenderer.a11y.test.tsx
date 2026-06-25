import type { PptxSmartArtData, SmartArtPptxElement } from 'pptx-viewer-core';
import React from 'react';
/**
 * Render-path tests for SmartArt accessibility wiring and per-node style.
 *
 * These render the SVG to static markup and assert that the shared a11y
 * view-model surfaces as `role="img"` + `aria-label` on the container and a
 * per-node `aria-label` + `<title>` on each node group, and that a node's
 * `style` override (fill / font colour / bold / italic) shows up on canvas.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { SmartArtRenderer } from './SmartArtRenderer';

function makeElement(data: Partial<PptxSmartArtData>): SmartArtPptxElement {
	return {
		id: 'sa_1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			resolvedLayoutType: 'list',
			nodes: [
				{ id: 'n1', text: 'Alpha' },
				{ id: 'n2', text: 'Beta' },
			],
			...data,
		},
	} as SmartArtPptxElement;
}

function render(el: SmartArtPptxElement): string {
	return renderToStaticMarkup(<SmartArtRenderer element={el} />);
}

describe('smartArtRenderer - container accessibility', () => {
	it('puts role="img" and a descriptive aria-label on the container', () => {
		const html = render(makeElement({ resolvedLayoutType: 'list' }));
		expect(html).toContain('role="img"');
		expect(html).toMatch(/aria-label="List SmartArt diagram with 2 nodes: Alpha; Beta"/u);
	});

	it('describes an empty diagram without listing nodes', () => {
		const html = render(makeElement({ nodes: [{ id: 'n1', text: '' }] }));
		expect(html).toMatch(/aria-label="List SmartArt diagram with no nodes"/u);
	});
});

describe('smartArtRenderer - per-node accessibility', () => {
	it('labels each node group and emits an SVG <title> per node', () => {
		const html = render(makeElement({}));
		expect(html).toContain('aria-label="Node 1 of 2: Alpha"');
		expect(html).toContain('aria-label="Node 2 of 2: Beta"');
		expect(html).toContain('<title>Node 1 of 2: Alpha</title>');
	});

	it('tags node groups with the model node id', () => {
		const html = render(makeElement({}));
		expect(html).toContain('data-smartart-node-id="n1"');
		expect(html).toContain('data-smartart-node-id="n2"');
	});
});

describe('smartArtRenderer - per-node style override', () => {
	it('honours fillColor on the node shape', () => {
		const html = render(
			makeElement({
				nodes: [
					{ id: 'n1', text: 'Alpha', style: { fillColor: '#ff0000' } },
					{ id: 'n2', text: 'Beta' },
				],
			}),
		);
		expect(html).toContain('fill="#ff0000"');
	});

	it('honours fontColor / bold / italic on the node text', () => {
		const html = render(
			makeElement({
				nodes: [
					{
						id: 'n1',
						text: 'Alpha',
						style: { fontColor: '#00ff00', bold: true, italic: true },
					},
				],
			}),
		);
		expect(html).toMatch(/fill="#00ff00"/u);
		expect(html).toMatch(/font-weight="700"/u);
		expect(html).toMatch(/font-style="italic"/u);
	});

	it('honours lineColor as the node stroke', () => {
		const html = render(
			makeElement({
				style: 'intense',
				nodes: [{ id: 'n1', text: 'Alpha', style: { lineColor: '#123456' } }],
			}),
		);
		expect(html).toContain('stroke="#123456"');
	});

	it('falls back to the palette colour when no style is set', () => {
		const html = render(makeElement({ colorScheme: 'colorful1' }));
		// First palette colour for colorful1 is #3b82f6.
		expect(html).toContain('fill="#3b82f6"');
	});
});

describe('smartArtRenderer - drawing shape accessibility', () => {
	it('labels drawing-shape node groups and emits a <title>', () => {
		const html = render(
			makeElement({
				drawingShapes: [
					{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, shapeType: 'roundRect', text: 'Alpha' },
					{
						id: 'ds2',
						x: 0,
						y: 60,
						width: 100,
						height: 50,
						shapeType: 'roundRect',
						text: 'Beta',
					},
				],
			}),
		);
		expect(html).toContain('aria-label="Node 1 of 2: Alpha"');
		expect(html).toContain('<title>Node 1 of 2: Alpha</title>');
		expect(html).toContain('data-smartart-node-id="n1"');
	});
});

describe('smartArtRenderer - process layout style', () => {
	it('applies node style in the process renderer', () => {
		const html = render(
			makeElement({
				resolvedLayoutType: 'process',
				nodes: [
					{ id: 'p1', text: 'Step', style: { fillColor: '#abcdef' } },
					{ id: 'p2', text: 'Next' },
				],
			}),
		);
		expect(html).toContain('fill="#abcdef"');
		expect(html).toContain('aria-label="Node 1 of 2: Step"');
	});
});
