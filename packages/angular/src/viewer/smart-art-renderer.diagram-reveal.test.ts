/**
 * Staged `p:bldDgm` diagram-build reveal wiring for the Angular SmartArt
 * renderer.
 *
 * Mirrors `smart-art-renderer.test.ts`'s approach (no TestBed harness here):
 * exercises the exact shared-engine call `SmartArtRendererComponent.revealedNodes`
 * makes (`resolveRevealedSmartArtNodes` via the vendored `../internal/shared`
 * barrel) with the same inputs the component passes.
 */
import type { PptxSmartArtDrawingShape, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveRevealedDrawingShapes, resolveRevealedSmartArtNodes } from '../internal/shared';

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

const nodes: PptxSmartArtNode[] = [node('n1', 'Alpha'), node('n2', 'Beta'), node('n3', 'Gamma')];

describe('smartArtRendererComponent diagram build reveal', () => {
	it('reveals every node when no animation state is present', () => {
		const result = resolveRevealedSmartArtNodes(nodes, undefined);
		expect(result.nodes.map((n) => n.id)).toStrictEqual(['n1', 'n2', 'n3']);
	});

	it('falls back to a count-based leading-prefix reveal with no descriptor', () => {
		const result = resolveRevealedSmartArtNodes(nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
		});
		expect(result.nodes.map((n) => n.id)).toStrictEqual(['n1']);
		expect(result.shownCount).toBe(1);
	});

	it('prefers the authored diagramReveal node-id set over the build progress', () => {
		const result = resolveRevealedSmartArtNodes(nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(result.nodes.map((n) => n.id)).toStrictEqual(['n3']);
	});
});

describe('smartArtRendererComponent cached drawing-shape reveal', () => {
	function shape(id: string, text: string): PptxSmartArtDrawingShape {
		return { id, shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 50, text };
	}

	const shapes = [shape('s1', 'Alpha'), shape('s2', 'Beta'), shape('s3', 'Gamma')];

	it('prefers the authored diagramReveal node-id set over a proportional count', () => {
		const result = resolveRevealedDrawingShapes(shapes, nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(result.map((s) => s.id)).toStrictEqual(['s3']);
	});
});
