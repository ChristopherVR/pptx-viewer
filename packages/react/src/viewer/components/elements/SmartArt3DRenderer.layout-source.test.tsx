// @vitest-environment happy-dom
/**
 * `SmartArt3DRenderer` builds its model through the shared
 * `resolveSmartArt3DLayout`, so an element carrying a cached `dsp:` drawing
 * gets the same geometry and theme fills the SVG renderer draws (the old
 * direct `computeSmartArtElementLayout` call re-ran the layout engine and
 * could change both the moment the 3D scene switched on).
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const resolveSmartArt3DLayout = vi.hoisted(() => vi.fn());

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		resolveSmartArt3DLayout: (...args: Parameters<typeof actual.resolveSmartArt3DLayout>) => {
			resolveSmartArt3DLayout(...args);
			return actual.resolveSmartArt3DLayout(...args);
		},
	};
});

const { SmartArt3DRenderer } = await import('./SmartArt3DRenderer');

const data = {
	layoutType: 'list',
	nodes: [
		{ id: 'n1', text: 'One' },
		{ id: 'n2', text: 'Two' },
	],
	drawingShapes: [
		{
			id: 'a',
			shapeType: 'roundRect',
			x: 0,
			y: 0,
			width: 400,
			height: 140,
			fillColor: '#4472C4',
			text: 'One',
		},
		{
			id: 'b',
			shapeType: 'roundRect',
			x: 0,
			y: 160,
			width: 400,
			height: 140,
			fillColor: '#ED7D31',
			text: 'Two',
		},
	],
} as unknown as PptxSmartArtData;

const element = {
	id: 'sa-1',
	type: 'smartArt',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	smartArtData: data,
} as unknown as PptxElement;

afterEach(() => {
	document.body.innerHTML = '';
	resolveSmartArt3DLayout.mockClear();
});

describe('smartArt3DRenderer layout source', () => {
	it('resolves the 3D layout from the element data (cached drawing first)', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		await act(async () => {
			root.render(<SmartArt3DRenderer element={element} />);
		});
		expect(resolveSmartArt3DLayout).toHaveBeenCalledOnce();
		const [source, nodes, box] = resolveSmartArt3DLayout.mock.calls[0] as [
			PptxSmartArtData,
			PptxSmartArtData['nodes'],
			{ width: number; height: number },
		];
		expect(source).toBe(data);
		expect(nodes).toBe(data.nodes);
		expect(box).toStrictEqual({ width: 400, height: 300 });
		await act(async () => {
			root.unmount();
		});
	});
});
