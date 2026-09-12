import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, it, expect, vi } from 'vitest';

import {
	findSmartArtNodeText,
	shouldCommitSmartArtNodeText,
	resolveDrawingShapeNodeId,
	computeInlineEditorRect,
	measureSvgViewportRect,
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

describe('measureSvgViewportRect', () => {
	const box = { x: 10, y: 20, width: 40, height: 30 };
	const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
	function graphic(matrix = identity, bounds = box): Element {
		return {
			ownerSVGElement: {},
			getCTM: () => matrix,
			getBBox: () => bounds,
		} as unknown as Element;
	}

	it('includes local viewBox scaling and letterboxing without screen measurement', () => {
		expect(
			measureSvgViewportRect(graphic({ ...identity, a: 2, d: 2, e: 30, f: 75 })),
		).toStrictEqual({
			left: 50,
			top: 115,
			width: 80,
			height: 60,
		});
	});

	it('bounds all four corners after a local rotation or flip', () => {
		expect(
			measureSvgViewportRect(graphic({ a: 0, b: 1, c: -1, d: 0, e: 100, f: 0 })),
		).toStrictEqual({
			left: 50,
			top: 10,
			width: 30,
			height: 40,
		});
		expect(measureSvgViewportRect(graphic({ ...identity, a: -1 }))).toStrictEqual({
			left: -50,
			top: 20,
			width: 40,
			height: 30,
		});
	});

	it('retains zero-size geometry and negative overhang for caller fallback/padding', () => {
		expect(
			measureSvgViewportRect(graphic(identity, { x: -10, y: -20, width: 0, height: 0 })),
		).toStrictEqual({
			left: -10,
			top: -20,
			width: 0,
			height: 0,
		});
	});

	it('crosses nested SVG viewports through the outer local-to-screen matrices', () => {
		const sourceScreen = { a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 200 };
		const screenInverse = {};
		const sourceProduct = vi.fn(() => ({ ...identity, e: 30, f: 50 }));
		const viewportProduct = vi.fn(() => ({ multiply: sourceProduct }));
		const inverse = vi.fn(() => screenInverse);
		const source = {
			ownerSVGElement: {
				ownerSVGElement: {
					getCTM: () => ({ multiply: viewportProduct }),
					getScreenCTM: () => ({ inverse }),
				},
			},
			getCTM: () => identity,
			getScreenCTM: () => sourceScreen,
			getBBox: () => box,
		} as unknown as Element;
		expect(measureSvgViewportRect(source)).toStrictEqual({
			left: 40,
			top: 70,
			width: 40,
			height: 30,
		});
		expect(inverse).toHaveBeenCalledOnce();
		expect(viewportProduct).toHaveBeenCalledWith(screenInverse);
		expect(sourceProduct).toHaveBeenCalledWith(sourceScreen);
	});

	it('rejects unsupported, detached, invalid or unmeasurable graphics', () => {
		expect(measureSvgViewportRect({} as Element)).toBeNull();
		expect(
			measureSvgViewportRect({ getBBox: () => box, getCTM: () => identity } as unknown as Element),
		).toBeNull();
		expect(
			measureSvgViewportRect({
				ownerSVGElement: {},
				getBBox: () => box,
				getCTM: () => null,
			} as unknown as Element),
		).toBeNull();
		expect(measureSvgViewportRect(graphic({ ...identity, a: NaN }))).toBeNull();
		expect(measureSvgViewportRect(graphic(identity, { ...box, width: -1 }))).toBeNull();
		expect(
			measureSvgViewportRect({
				ownerSVGElement: {},
				getCTM: () => identity,
				getBBox: () => {
					throw new Error('not rendered');
				},
			} as unknown as Element),
		).toBeNull();
	});
});
