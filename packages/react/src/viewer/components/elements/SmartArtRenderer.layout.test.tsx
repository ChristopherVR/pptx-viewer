import type {
	PptxSmartArtData,
	PptxSmartArtLayoutDefinition,
	SmartArtPptxElement,
	XmlObject,
} from 'pptx-viewer-core';
import { parseSmartArtLayoutDefinition } from 'pptx-viewer-core';
import React from 'react';
/**
 * Regression tests for the SmartArt 2-D fallback path.
 *
 * React used to render this path from a private JSX tree that never looked at
 * the deck's `dgm:layoutDef`, so a diagram with no cached `dsp` drawing came out
 * a different shape in React than in Vue / Angular / Svelte / Vanilla, all of
 * which call the shared `computeSmartArtLayout`. These assert the routing:
 *
 *  - the file's parsed layout definition decides the arrangement (interpreter),
 *  - the cached drawing still wins over recomputation (must not regress),
 *  - the families lifted out of React into shared still render,
 *  - node ids / a11y labels survive on the shared descriptor path.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { SmartArtRenderer } from './SmartArtRenderer';

const localName = (key: string): string => key.split(':').pop() ?? key;

/**
 * Parse a minimal but real `dgm:layoutDef` whose primary algorithm is `cycle`,
 * through the production core parser (the same path a loaded deck takes).
 */
function cycleLayoutDefinition(): PptxSmartArtLayoutDefinition {
	const xml: XmlObject = {
		'@_uniqueId': 'urn:test/layout/basicCycle',
		'dgm:title': { '@_lang': 'en-US', '@_val': 'Basic Cycle' },
		'dgm:layoutNode': {
			'@_name': 'Name0',
			'dgm:alg': {
				'@_type': 'cycle',
				'dgm:param': [
					{ '@_type': 'stAng', '@_val': '0' },
					{ '@_type': 'spanAng', '@_val': '360' },
				],
			},
			'dgm:forEach': {
				'@_name': 'items',
				'@_axis': 'ch',
				'@_ptType': 'node',
				'dgm:layoutNode': { '@_name': 'node', 'dgm:alg': { '@_type': 'tx' } },
			},
		},
	};
	const def = parseSmartArtLayoutDefinition(xml, localName);
	if (!def) {
		throw new Error('test layoutDef failed to parse');
	}
	return def;
}

function makeElement(data: Partial<PptxSmartArtData>): SmartArtPptxElement {
	return {
		id: 'sa_1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'Alpha' },
				{ id: 'n2', text: 'Beta' },
				{ id: 'n3', text: 'Gamma' },
			],
			...data,
		},
	} as SmartArtPptxElement;
}

const render = (el: SmartArtPptxElement): string =>
	renderToStaticMarkup(<SmartArtRenderer element={el} />);

describe('smartArtRenderer - 2-D fallback routes through the shared engine', () => {
	it("obeys the file's dgm:layoutDef instead of the layout-type approximation", () => {
		// `resolvedLayoutType` says list, but the real layout definition in the
		// file is a cycle. The interpreter runs first, so the diagram is a cycle.
		const html = render(
			makeElement({ resolvedLayoutType: 'list', layoutDefinition: cycleLayoutDefinition() }),
		);

		expect(html).toContain('data-layout-family="cycle"');
		expect(html).not.toContain('data-layout-family="list"');
		// A cycle is drawn as circles, never as the stacked list rectangles.
		expect(html).toContain('<circle');
	});

	it('keeps the cached dsp drawing preferred over recomputation', () => {
		const html = render(
			makeElement({
				resolvedLayoutType: 'list',
				layoutDefinition: cycleLayoutDefinition(),
				drawingShapes: [
					{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, shapeType: 'roundRect', text: 'Alpha' },
				],
			}),
		);

		// The layout engine did not run at all: no family marker, and the cached
		// shape's own text is what got painted.
		expect(html).not.toContain('data-layout-family');
		expect(html).toContain('Alpha');
	});

	it('tags every rendered node with its model id and a11y label', () => {
		const html = render(
			makeElement({ resolvedLayoutType: 'list', layoutDefinition: cycleLayoutDefinition() }),
		);

		expect(html).toContain('data-smartart-node-id="n1"');
		expect(html).toContain('data-smartart-node-id="n3"');
		expect(html).toContain('aria-label="Node 1 of 3: Alpha"');
		expect(html).toContain('<title>Node 3 of 3: Gamma</title>');
	});
});

describe('smartArtRenderer - families lifted from React into shared', () => {
	it('draws interlockingGears as cogs, not a radial burst', () => {
		const html = render(makeElement({ layout: 'interlockingGears' }));
		expect(html).toContain('data-layout-family="gear"');
		// A cog is a polygon of 2 vertices per tooth (8 teeth => 16 points).
		const points = /<polygon points="([^"]+)"/u.exec(html)?.[1];
		expect(points?.split(' ')).toHaveLength(16);
	});

	it('draws basicTimeline as dots on an axis with captions off-centre', () => {
		const html = render(makeElement({ layout: 'basicTimeline' }));
		expect(html).toContain('data-layout-family="timeline"');
		// The axis connector is a single path carrying the arrowhead.
		expect(html).toMatch(/<path d="M24,150 L376,150 M370,146 L376,150 L370,154"/u);
	});

	it('draws bendingProcess as a snake grid', () => {
		const html = render(makeElement({ layout: 'bendingProcess' }));
		expect(html).toContain('data-layout-family="bending"');
		expect(html).toContain('<rect');
	});
});

describe('smartArtRenderer - colorsDef @meth="span" colour interpolation', () => {
	it('gradients a 2-colour "Colorful Range" scheme across all nodes', () => {
		// 5 nodes, a 2-colour fill list flagged `meth="span"`: PowerPoint's
		// "Colorful Range" fades smoothly across the nodes instead of alternating
		// between the two colours.
		const html = render(
			makeElement({
				layout: 'list',
				nodes: [
					{ id: 'n1', text: 'A' },
					{ id: 'n2', text: 'B' },
					{ id: 'n3', text: 'C' },
					{ id: 'n4', text: 'D' },
					{ id: 'n5', text: 'E' },
				],
				colorTransform: {
					fillColors: ['#000000', '#ffffff'],
					lineColors: [],
					fillInterpolation: { method: 'span' },
				},
			}),
		);
		const fills = [...html.matchAll(/fill="(#[0-9a-fA-F]{6})"/gu)].map((m) => m[1]);
		expect(fills).toHaveLength(5);
		expect(fills[0]).toBe('#000000');
		expect(fills[4]).toBe('#ffffff');
		// A real gradient, not a 2-colour alternation.
		expect(new Set(fills).size).toBe(5);
	});
});

describe('smartArtRenderer - target labels do not stack on the bullseye centre', () => {
	it('parks each ring caption in the right-hand column', () => {
		const html = render(makeElement({ resolvedLayoutType: 'target' }));
		expect(html).toContain('data-layout-family="target"');
		expect(html).toContain('text-anchor="start"');
		// Three rings share one centre, so three distinct label rows are required.
		const ys = [...html.matchAll(/<tspan x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/gu)].map(
			(m) => m[2],
		);
		expect(new Set(ys).size).toBe(3);
	});
});
