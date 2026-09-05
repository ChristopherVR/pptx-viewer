import type { SmartArtPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArtView } from './smartart-view';

/**
 * Staged `p:bldDgm` diagram-build reveal wiring (Svelte port of the React
 * `SmartArtRenderer.diagram-reveal.test.tsx` coverage).
 */
function makeElement(): SmartArtPptxElement {
	return {
		id: 'sa1',
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
		},
	} as SmartArtPptxElement;
}

function nodeIds(view: ReturnType<typeof buildSmartArtView>): string[] {
	return view.kind === 'layout' ? view.layout.nodes.map((n) => n.nodeId ?? '') : [];
}

describe('buildSmartArtView - staged diagram build reveal', () => {
	it('reveals every node when no animation state is present', () => {
		expect(nodeIds(buildSmartArtView(makeElement()))).toStrictEqual(['n1', 'n2', 'n3']);
	});

	it('falls back to a count-based leading-prefix reveal with no descriptor', () => {
		const view = buildSmartArtView(makeElement(), {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
		});
		expect(nodeIds(view)).toStrictEqual(['n1']);
	});

	it('prefers the authored diagramReveal node-id set over the build progress', () => {
		const view = buildSmartArtView(makeElement(), {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(nodeIds(view)).toStrictEqual(['n3']);
	});
});

describe('buildSmartArtView - staged diagram build reveal (cached drawing shapes)', () => {
	function drawingShapesElement(): SmartArtPptxElement {
		const el = makeElement();
		return {
			...el,
			smartArtData: {
				...el.smartArtData,
				drawingShapes: [
					{ id: 's1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 50, text: 'Alpha' },
					{ id: 's2', shapeType: 'roundRect', x: 0, y: 60, width: 100, height: 50, text: 'Beta' },
					{ id: 's3', shapeType: 'roundRect', x: 0, y: 120, width: 100, height: 50, text: 'Gamma' },
				],
			},
		} as SmartArtPptxElement;
	}

	function shapeIds(view: ReturnType<typeof buildSmartArtView>): string[] {
		return view.kind === 'drawing' ? view.shapes.map((s) => s.nodeId ?? '') : [];
	}

	it('prefers the authored diagramReveal node-id set over a proportional shape-count guess', () => {
		const view = buildSmartArtView(drawingShapesElement(), {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(shapeIds(view)).toStrictEqual(['n3']);
	});
});
