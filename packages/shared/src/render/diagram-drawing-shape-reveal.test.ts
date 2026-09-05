import type { PptxSmartArtDrawingShape, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	resolveRevealedDrawingShapeNodeIds,
	resolveRevealedDrawingShapes,
} from './diagram-drawing-shape-reveal';

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function shape(id: string, text: string): PptxSmartArtDrawingShape {
	return {
		id,
		shapeType: 'roundRect',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
	};
}

// 1:1 positional mapping: shapes.length === nodes.length, so
// `resolveDrawingShapeNodeId` maps by index.
const nodes = [node('n1', 'Alpha'), node('n2', 'Beta'), node('n3', 'Gamma')];
const shapes = [shape('s1', 'Alpha'), shape('s2', 'Beta'), shape('s3', 'Gamma')];

describe('resolveRevealedDrawingShapes', () => {
	it('reveals every shape when no animation state is present', () => {
		expect(resolveRevealedDrawingShapes(shapes, nodes, undefined)).toStrictEqual(shapes);
	});

	it('falls back to a proportional count-based prefix with no descriptor', () => {
		const result = resolveRevealedDrawingShapes(shapes, nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.3 },
		});
		expect(result.map((s) => s.id)).toStrictEqual(['s1']);
	});

	it('prefers the authored diagramReveal node-id set, in document order, over the build progress', () => {
		const result = resolveRevealedDrawingShapes(shapes, nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 0.2 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n3']) },
			},
		});
		expect(result.map((s) => s.id)).toStrictEqual(['s3']);
	});

	it('always keeps a shape with no resolvable node id (structural chrome)', () => {
		const chromeShape = shape('bg', ''); // no text, not a rightArrow etc: falls through to "no match"
		const withChrome = [...shapes, chromeShape];
		const result = resolveRevealedDrawingShapes(withChrome, nodes, {
			build: { kind: 'diagram', mode: 'byOne', progress: 1 },
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n1']) },
			},
		});
		// n1 -> s1 kept; s2/s3 excluded; the unmapped 4-shape mismatch (index 3,
		// no corresponding 4th node) has no positional match and no text match,
		// so it is treated as chrome and always kept.
		expect(result.map((s) => s.id)).toStrictEqual(['s1', 'bg']);
	});

	it('returns an empty array when there are no shapes', () => {
		expect(resolveRevealedDrawingShapes([], nodes, undefined)).toStrictEqual([]);
	});
});

describe('resolveRevealedDrawingShapeNodeIds', () => {
	it('maps every shape by position when the whole diagram is revealed', () => {
		expect(resolveRevealedDrawingShapeNodeIds(shapes, shapes, nodes)).toStrictEqual([
			'n1',
			'n2',
			'n3',
		]);
	});

	it('keeps the FULL-list mapping for a partially revealed subset', () => {
		// Shapes whose text is ambiguous (two identical labels), so the text
		// fallback cannot rescue a positional mis-map: resolving over the revealed
		// subset alone would tag the lone revealed shape with n1.
		const twins = [node('n1', 'Same'), node('n2', 'Same'), node('n3', 'Gamma')];
		const twinShapes = [shape('s1', 'Same'), shape('s2', 'Same'), shape('s3', 'Gamma')];
		const revealed = resolveRevealedDrawingShapes(twinShapes, twins, {
			diagramReveal: {
				mode: 'byOne',
				descriptor: { background: true, nodeIds: new Set(['n2']) },
			},
		});
		expect(revealed.map((s) => s.id)).toStrictEqual(['s2']);
		expect(resolveRevealedDrawingShapeNodeIds(twinShapes, revealed, twins)).toStrictEqual(['n2']);
	});

	it('resolves a shape it was not handed in the full list within the revealed list', () => {
		const foreign = [shape('x1', 'Gamma')];
		expect(resolveRevealedDrawingShapeNodeIds(shapes, foreign, nodes)).toStrictEqual(['n3']);
	});
});
