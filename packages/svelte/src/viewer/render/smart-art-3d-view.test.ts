/**
 * `buildSmartArt3DViewModel` tests: the 3D model is built from the same
 * geometry the SVG `SmartArtView` draws, so the cached `dsp:` drawing (with
 * the deck's theme fills) wins over the layout engine when present.
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArt3DViewModel } from './smart-art-3d-view';

function smartArtElement(data: PptxSmartArtData | undefined): PptxElement {
	return {
		id: 'sa-1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: data,
	} as unknown as PptxElement;
}

const nodes = [
	{ id: 'n1', text: 'One' },
	{ id: 'n2', text: 'Two' },
];

describe('buildSmartArt3DViewModel', () => {
	it('returns undefined for a non-smartArt element or an empty diagram', () => {
		expect(buildSmartArt3DViewModel({ id: 's', type: 'shape' } as PptxElement)).toBeUndefined();
		expect(
			buildSmartArt3DViewModel(
				smartArtElement({ layoutType: 'list', nodes: [] } as unknown as PptxSmartArtData),
			),
		).toBeUndefined();
	});

	it('falls back to the layout engine without a cached drawing', () => {
		const model = buildSmartArt3DViewModel(
			smartArtElement({ layoutType: 'list', nodes } as unknown as PptxSmartArtData),
		);
		expect(model?.meshes.length).toBeGreaterThan(0);
	});

	it('builds from the cached drawing (its geometry and theme fills) when the element has one', () => {
		const data = {
			layoutType: 'list',
			nodes,
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
		const model = buildSmartArt3DViewModel(smartArtElement(data));
		expect(model?.meshes.map((m) => m.fill)).toStrictEqual(['#4472C4', '#ED7D31']);
		expect(model?.meshes.map((m) => m.text)).toStrictEqual(['One', 'Two']);
		expect(model?.meshes[0].halfWidth).toBeCloseTo(200, 3);
	});
});
