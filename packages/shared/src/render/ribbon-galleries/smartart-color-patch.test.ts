import type { PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRibbonGallery } from './gallery-registry';
import { smartArtColorPatch } from './smartart-color-patch';

describe('smartArt gallery color edits', () => {
	it('updates node lists and cached colors while preserving connector colors and geometry', () => {
		const data: PptxSmartArtData = {
			nodes: [{ id: 'n1', text: 'One' }],
			colorTransform: {
				fillColors: ['#AAAAAA'],
				lineColors: [],
				roleColors: {
					node1: { fill: ['#AAAAAA'], line: ['#000000'] },
					parChTrans1D2: { fill: ['#123456'], line: ['#654321'] },
				},
			},
			drawingShapes: [
				{
					id: 'reflow-list-n1',
					x: 12,
					y: 24,
					width: 70,
					height: 30,
					text: 'One',
					fillColor: '#AAAAAA',
				},
			],
		};
		const patch = smartArtColorPatch(data, ['#E97132']);
		expect(patch.colorTransform?.roleColors?.node1).toStrictEqual({
			fill: ['#E97132'],
			line: ['#000000'],
		});
		expect(patch.colorTransform?.roleColors?.parChTrans1D2).toStrictEqual(
			data.colorTransform?.roleColors?.parChTrans1D2,
		);
		expect(patch.drawingShapes?.[0]).toMatchObject({
			x: 12,
			y: 24,
			width: 70,
			height: 30,
			fillColor: '#E97132',
		});
		expect(patch.drawingDirty).toBeTruthy();
		expect(data.drawingShapes?.[0].fillColor).toBe('#AAAAAA');
	});

	it('recognizes a saved palette from its parsed colors', () => {
		const descriptor = buildRibbonGallery('smartArtColors', {
			element: {
				id: 'sa',
				type: 'smartArt',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				smartArtData: { nodes: [], colorTransform: { fillColors: ['#E97132'], lineColors: [] } },
			},
		});
		expect(
			descriptor.sections
				.flatMap((section) => section.items)
				.filter((item) => item.applied)
				.map((item) => item.id),
		).toStrictEqual(['monochromatic2']);
	});
});
