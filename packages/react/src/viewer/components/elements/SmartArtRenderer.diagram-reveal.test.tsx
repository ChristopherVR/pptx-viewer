import type { PptxSmartArtData, SmartArtPptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React from 'react';
/**
 * Staged `p:bldDgm` diagram-build reveal wiring.
 *
 * Covers both reveal paths `resolveRevealedSmartArtNodes` picks between:
 *  - the AUTHORED per-node `p:graphicEl/@id` set (`animationState.diagramReveal`),
 *    which may reveal nodes out of document-list order (reverse-order builds);
 *  - the count-based `revealedSmartArtNodeCount` fallback when no descriptor
 *    is present, which reveals a leading prefix of the node list.
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
				{ id: 'n3', text: 'Gamma' },
			],
			...data,
		},
	} as SmartArtPptxElement;
}

function render(el: SmartArtPptxElement, animationState?: ElementAnimationState): string {
	return renderToStaticMarkup(<SmartArtRenderer element={el} animationState={animationState} />);
}

describe('smartArtRenderer - staged diagram build reveal', () => {
	it('reveals every node when no animation state is present', () => {
		const html = render(makeElement({}));
		expect(html).toContain('data-smartart-node-id="n1"');
		expect(html).toContain('data-smartart-node-id="n2"');
		expect(html).toContain('data-smartart-node-id="n3"');
	});

	it('falls back to a count-based leading-prefix reveal with no descriptor', () => {
		const html = render(makeElement({}), {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
		});
		expect(html).toContain('data-smartart-node-id="n1"');
		expect(html).not.toContain('data-smartart-node-id="n2"');
		expect(html).not.toContain('data-smartart-node-id="n3"');
	});

	it('prefers the authored diagramReveal node-id set over the build progress', () => {
		// A "Reverse Order" build fires n3 first: the authored set must reveal
		// n3, not the count-based leading-prefix guess (which would show n1).
		const html = render(makeElement({}), {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(html).not.toContain('data-smartart-node-id="n1"');
		expect(html).not.toContain('data-smartart-node-id="n2"');
		expect(html).toContain('data-smartart-node-id="n3"');
	});

	it('reveals every node once the diagramReveal set spans the whole diagram', () => {
		const html = render(makeElement({}), {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 1 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n1', 'n2', 'n3']) },
			},
		});
		expect(html).toContain('data-smartart-node-id="n1"');
		expect(html).toContain('data-smartart-node-id="n2"');
		expect(html).toContain('data-smartart-node-id="n3"');
	});
});

describe('smartArtRenderer - staged diagram build reveal (cached drawing shapes)', () => {
	function drawingShapesElement(): SmartArtPptxElement {
		return makeElement({
			drawingShapes: [
				{ id: 's1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 50, text: 'Alpha' },
				{ id: 's2', shapeType: 'roundRect', x: 0, y: 60, width: 100, height: 50, text: 'Beta' },
				{ id: 's3', shapeType: 'roundRect', x: 0, y: 120, width: 100, height: 50, text: 'Gamma' },
			],
		});
	}

	it('prefers the authored diagramReveal node-id set over a proportional shape-count guess', () => {
		// A "Reverse Order" build fires n3 first: the cached-drawing path must
		// reveal the shape for n3, not the leading-prefix guess (s1).
		const html = render(drawingShapesElement(), {
			visible: true,
			cssAnimation: undefined,
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(html).not.toContain('data-smartart-node-id="n1"');
		expect(html).not.toContain('data-smartart-node-id="n2"');
		expect(html).toContain('data-smartart-node-id="n3"');
	});
});
