import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { commitSmartArtNodeFill, commitSmartArtNodeText } from './smartart-node-commit';

function element(smartArtData: PptxSmartArtData): PptxElement {
	return {
		id: 'sa1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData,
	} as PptxElement;
}

const data = (overrides: Partial<PptxSmartArtData> = {}): PptxSmartArtData => ({
	nodes: [
		{ id: 'a', text: 'Alpha' },
		{ id: 'b', text: 'Beta' },
	],
	layout: 'list',
	...overrides,
});

describe('commitSmartArtNodeText', () => {
	it('returns the data with the node text set', () => {
		const next = commitSmartArtNodeText(element(data()), 'a', 'Edited');
		expect(next?.nodes.find((node) => node.id === 'a')?.text).toBe('Edited');
	});

	it('returns null when the text did not change', () => {
		expect(commitSmartArtNodeText(element(data()), 'a', 'Alpha')).toBeNull();
	});

	it('returns null for an element that is not a SmartArt', () => {
		expect(
			commitSmartArtNodeText({ id: 'x', type: 'text' } as unknown as PptxElement, 'a', 'x'),
		).toBeNull();
	});

	it('rebuilds drawing shapes a structural edit cleared', () => {
		const next = commitSmartArtNodeText(element(data({ drawingShapes: [] })), 'a', 'Edited');
		expect((next?.drawingShapes ?? []).length).toBeGreaterThan(0);
	});
});

describe('commitSmartArtNodeFill', () => {
	it('records the fill on the node', () => {
		const next = commitSmartArtNodeFill(element(data()), 'b', '#ff0000');
		expect(next?.nodes.find((node) => node.id === 'b')?.style?.fillColor).toBe('#ff0000');
	});

	it('returns null for a node that is not in the diagram', () => {
		expect(commitSmartArtNodeFill(element(data()), 'missing', '#ff0000')).toBeNull();
	});
});
