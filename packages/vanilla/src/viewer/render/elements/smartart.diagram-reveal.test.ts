import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderSmartArtElement } from './smartart';

/**
 * Staged `p:bldDgm` diagram-build reveal wiring (vanilla port of the React
 * `SmartArtRenderer.diagram-reveal.test.tsx` coverage).
 */
function makeContext(animationState?: ElementAnimationState): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
		presentationStates: animationState ? new Map([['sa-1', animationState]]) : undefined,
	};
	return context;
}

function fallbackElement(): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa-1',
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
	} as PptxElement;
}

function revealedIds(el: HTMLElement | SVGElement | null): string[] {
	if (!el) {
		return [];
	}
	return Array.from(el.querySelectorAll('[data-smartart-node-id]')).map(
		(g) => (g as HTMLElement).dataset.smartartNodeId ?? '',
	);
}

describe('renderSmartArtElement - staged diagram build reveal', () => {
	it('reveals every node when no animation state is present', () => {
		const el = renderSmartArtElement(fallbackElement(), 0, makeContext());
		expect(revealedIds(el)).toStrictEqual(['n1', 'n2', 'n3']);
	});

	it('falls back to a count-based leading-prefix reveal with no descriptor', () => {
		const el = renderSmartArtElement(
			fallbackElement(),
			0,
			makeContext({
				visible: true,
				cssAnimation: undefined,
				build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
			}),
		);
		expect(revealedIds(el)).toStrictEqual(['n1']);
	});

	it('prefers the authored diagramReveal node-id set over the build progress', () => {
		const el = renderSmartArtElement(
			fallbackElement(),
			0,
			makeContext({
				visible: true,
				cssAnimation: undefined,
				build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
				diagramReveal: {
					mode: 'byOne',
					descriptor: { background: true, nodeIds: new Set(['n3']) },
				},
			}),
		);
		expect(revealedIds(el)).toStrictEqual(['n3']);
	});

	it('labels a partially revealed node by its OWN id, not by render position', () => {
		const el = renderSmartArtElement(
			fallbackElement(),
			0,
			makeContext({
				visible: true,
				cssAnimation: undefined,
				diagramReveal: {
					mode: 'byOne',
					descriptor: { background: true, nodeIds: new Set(['n3']) },
				},
			}),
		);
		const node = el?.querySelector<SVGGElement>('[data-smartart-node-id="n3"]');
		// Position 0 of the revealed subset is Gamma; a positional lookup read
		// the label of the FIRST full-diagram node (Alpha) onto it.
		expect(node?.getAttribute('aria-label')).toContain('Gamma');
		expect(node?.getAttribute('aria-label')).not.toContain('Alpha');
	});
});

describe('renderSmartArtElement - staged diagram build reveal (cached drawing shapes)', () => {
	function drawingShapesElement(): PptxElement {
		return {
			type: 'smartArt',
			id: 'sa-1',
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
			},
		} as PptxElement;
	}

	it('prefers the authored diagramReveal node-id set over a proportional shape-count guess', () => {
		const el = renderSmartArtElement(
			drawingShapesElement(),
			0,
			makeContext({
				visible: true,
				cssAnimation: undefined,
				build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
				diagramReveal: {
					mode: 'byOne',
					descriptor: { background: true, nodeIds: new Set(['n3']) },
				},
			}),
		);
		expect(revealedIds(el)).toStrictEqual(['n3']);
	});

	it('labels a partially revealed drawing shape by its node id, not by render position', () => {
		const el = renderSmartArtElement(
			drawingShapesElement(),
			0,
			makeContext({
				visible: true,
				cssAnimation: undefined,
				diagramReveal: {
					mode: 'byOne',
					descriptor: { background: true, nodeIds: new Set(['n3']) },
				},
			}),
		);
		const node = el?.querySelector<SVGGElement>('[data-smartart-node-id="n3"]');
		expect(node?.getAttribute('aria-label')).toContain('Gamma');
		expect(node?.getAttribute('aria-label')).not.toContain('Alpha');
	});
});
