import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	findSmartArtNodeText,
	shouldCommitSmartArtNodeText,
	resolveDrawingShapeNodeId,
	computeInlineEditorRect,
	projectSmartArtViewBoxRect,
} from './smartart-inline-edit';

function node(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function data(...nodes: PptxSmartArtNode[]): PptxSmartArtData {
	return { nodes };
}

function shape(over: Partial<PptxSmartArtDrawingShape> & { id: string }): PptxSmartArtDrawingShape {
	return { x: 0, y: 0, width: 10, height: 10, ...over };
}

describe('findSmartArtNodeText', () => {
	it('returns the node text by id', () => {
		expect(findSmartArtNodeText(data(node('a', 'Alpha'), node('b', 'Beta')), 'b')).toBe('Beta');
	});

	it('returns undefined for an unknown id', () => {
		expect(findSmartArtNodeText(data(node('a', 'Alpha')), 'zzz')).toBeUndefined();
	});
});

describe('shouldCommitSmartArtNodeText', () => {
	const d = data(node('a', 'Alpha'));

	it('is true when the text differs', () => {
		expect(shouldCommitSmartArtNodeText(d, 'a', 'Changed')).toBeTruthy();
	});

	it('is false when the text is identical (no redundant history entry)', () => {
		expect(shouldCommitSmartArtNodeText(d, 'a', 'Alpha')).toBeFalsy();
	});

	it('is false when the node does not exist', () => {
		expect(shouldCommitSmartArtNodeText(d, 'missing', 'anything')).toBeFalsy();
	});
});

describe('resolveDrawingShapeNodeId', () => {
	const nodes = [node('n1', 'One'), node('n2', 'Two')];

	it('matches a reflow shape by its id suffix', () => {
		const shapes = [shape({ id: 'reflow-cycle-n2' })];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBe('n2');
	});

	it('maps positionally when shape and node counts align', () => {
		const shapes = [shape({ id: 's0' }), shape({ id: 's1' })];
		expect(resolveDrawingShapeNodeId(shapes[1], 1, shapes, nodes)).toBe('n2');
	});

	it('falls back to a unique non-empty text match', () => {
		const shapes = [shape({ id: 'x' }), shape({ id: 'y', text: 'Two' }), shape({ id: 'z' })];
		expect(resolveDrawingShapeNodeId(shapes[1], 1, shapes, nodes)).toBe('n2');
	});

	it('returns undefined when no confident match exists', () => {
		const shapes = [shape({ id: 'x' }), shape({ id: 'y' }), shape({ id: 'z' })];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBeUndefined();
	});

	// Arrow connector shapes must never be made editable even when their id
	// suffix coincidentally matches a node id (e.g. reflow-bending-arrow-n1
	// ends with -n1 and would match node n1 without the connector guard).
	it('returns undefined for reflow arrow connector shapes despite a matching id suffix', () => {
		const shapes = [
			shape({ id: 'reflow-bending-n1', shapeType: 'roundRect', text: 'One' }),
			shape({ id: 'reflow-bending-arrow-n1', shapeType: 'rightArrow' }),
			shape({ id: 'reflow-bending-n2', shapeType: 'roundRect', text: 'Two' }),
		];
		expect(resolveDrawingShapeNodeId(shapes[1], 1, shapes, nodes)).toBeUndefined();
	});

	it('correctly resolves content shapes mixed with reflow arrow connectors', () => {
		const shapes = [
			shape({ id: 'reflow-bending-n1', shapeType: 'roundRect', text: 'One' }),
			shape({ id: 'reflow-bending-arrow-n1', shapeType: 'rightArrow' }),
			shape({ id: 'reflow-bending-n2', shapeType: 'roundRect', text: 'Two' }),
		];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBe('n1');
		expect(resolveDrawingShapeNodeId(shapes[2], 2, shapes, nodes)).toBe('n2');
	});

	it('returns undefined for a downArrow connector (bending layout vertical arrow)', () => {
		const shapes = [shape({ id: 'reflow-bending-arrow-n1', shapeType: 'downArrow' })];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBeUndefined();
	});

	it('returns undefined for a process layout rightArrow connector', () => {
		const shapes = [shape({ id: 'reflow-proc-arrow-n1', shapeType: 'rightArrow' })];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBeUndefined();
	});

	// An arrow-type shape WITH text is intentional node content (e.g. an
	// "Opposing Arrows" layout where the arrow shape itself carries the label).
	it('resolves an arrow-shaped content node that carries text', () => {
		const shapes = [shape({ id: 'reflow-rel-n1', shapeType: 'rightArrow', text: 'One' })];
		expect(resolveDrawingShapeNodeId(shapes[0], 0, shapes, nodes)).toBe('n1');
	});
});

describe('computeInlineEditorRect', () => {
	it('projects the node box into container-relative coordinates', () => {
		const rect = computeInlineEditorRect(
			{ left: 130, top: 90, width: 40, height: 24 },
			{ left: 100, top: 50, width: 400, height: 300 },
		);
		expect(rect).toStrictEqual({ left: 30, top: 40, width: 40, height: 24 });
	});
});

describe('projectSmartArtViewBoxRect', () => {
	it('projects at the exact viewport scale', () => {
		expect(
			projectSmartArtViewBoxRect(
				{ left: 50, top: 30, width: 100, height: 60 },
				{ width: 400, height: 300 },
				{ width: 800, height: 600 },
			),
		).toStrictEqual({ left: 100, top: 60, width: 200, height: 120 });
	});

	it('centres horizontal letterboxing with xMidYMid meet', () => {
		expect(
			projectSmartArtViewBoxRect(
				{ left: 50, top: 100, width: 100, height: 50 },
				{ width: 400, height: 400 },
				{ width: 800, height: 400 },
			),
		).toStrictEqual({ left: 250, top: 100, width: 100, height: 50 });
	});

	it('centres vertical letterboxing with xMidYMid meet', () => {
		expect(
			projectSmartArtViewBoxRect(
				{ left: 50, top: 20, width: 100, height: 40 },
				{ width: 400, height: 200 },
				{ width: 400, height: 400 },
			),
		).toStrictEqual({ left: 50, top: 120, width: 100, height: 40 });
	});

	it('rejects invalid source geometry or non-positive viewBox and viewport dimensions', () => {
		const nodeRect = { left: 0, top: 0, width: 10, height: 10 };
		const validViewBox = { width: 100, height: 100 };
		const validViewport = { width: 200, height: 200 };
		expect(
			projectSmartArtViewBoxRect(
				{ ...nodeRect, left: Number.POSITIVE_INFINITY },
				validViewBox,
				validViewport,
			),
		).toBeNull();
		expect(
			projectSmartArtViewBoxRect({ ...nodeRect, width: -1 }, validViewBox, validViewport),
		).toBeNull();
		expect(
			projectSmartArtViewBoxRect(nodeRect, { width: 0, height: 100 }, validViewport),
		).toBeNull();
		expect(
			projectSmartArtViewBoxRect(nodeRect, validViewBox, { width: 200, height: 0 }),
		).toBeNull();
		expect(
			projectSmartArtViewBoxRect(nodeRect, validViewBox, { width: Number.NaN, height: 200 }),
		).toBeNull();
	});

	it('preserves valid negative node coordinates', () => {
		expect(
			projectSmartArtViewBoxRect(
				{ left: -10, top: -5, width: 20, height: 10 },
				{ width: 400, height: 300 },
				{ width: 800, height: 600 },
			),
		).toStrictEqual({ left: -20, top: -10, width: 40, height: 20 });
	});
});
